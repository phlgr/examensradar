import { afterAll, expect, mock, test } from "bun:test";
// Shared test DB and the captured-mail transport — see src/test-setup.ts.
import { sentMails } from "../test-setup.ts";

const {
	addEmailSubscription,
	claimScrapeChange,
	confirmSubscriber,
	createJpa,
	ensureScrapeState,
	upsertPendingSubscriber,
	recordScrapeError,
	recordScrapeSuccess,
	resetScrapeState,
} = await import("../db/index.ts");
const { checkJpa } = await import("./scraper.ts");
const { queueResultsNotifications } = await import("./notify-results.ts");

const realFetch = globalThis.fetch;

afterAll(() => {
	globalThis.fetch = realFetch;
});

const serveHtml = (html: string) => {
	globalThis.fetch = mock(
		async () => new Response(html),
	) as unknown as typeof fetch;
};

const page = (content: string) =>
	`<html><body><article id="main">${content}</article></body></html>`;

const scrapableJpa = () =>
	createJpa({
		name: "Test-JPA",
		slug: `scraper-test-${crypto.randomUUID()}`,
		scrapeUrl: "https://example.org/aktuelles",
		scrapeSelector: "article#main",
	});

const notifyMock = () =>
	mock(async () => ({
		status: "queued" as const,
		mail: 0,
		total: 0,
	}));

test("first scrape stores a baseline and never notifies", async () => {
	const jpa = await scrapableJpa();
	const notify = notifyMock();

	serveHtml(page("Ergebnisse Mai 2026"));
	const outcome = await checkJpa(jpa, notify);

	expect(outcome.result).toBe("baseline");
	expect(notify).not.toHaveBeenCalled();
	const state = await ensureScrapeState(jpa.id);
	expect(state.contentHash).not.toBeNull();
	expect(state.lastChangedAt).toBeNull();
});

test("unchanged content notifies nobody", async () => {
	const jpa = await scrapableJpa();
	const notify = notifyMock();

	serveHtml(page("nichts Neues"));
	await checkJpa(jpa, notify);
	await checkJpa(jpa, notify);

	expect(notify).not.toHaveBeenCalled();
});

test("changed content notifies exactly once", async () => {
	const jpa = await scrapableJpa();
	const notify = notifyMock();

	serveHtml(page("alte Meldung"));
	await checkJpa(jpa, notify);

	serveHtml(page("Neue Ergebnisse!"));
	expect((await checkJpa(jpa, notify)).result).toBe("notified");
	expect((await checkJpa(jpa, notify)).result).toBe("unchanged");

	expect(notify).toHaveBeenCalledTimes(1);
	const state = await ensureScrapeState(jpa.id);
	expect(state.lastChangedAt).not.toBeNull();
});

test("a vanished selector records an error instead of notifying", async () => {
	const jpa = await scrapableJpa();
	const notify = notifyMock();

	serveHtml(page("Basislinie"));
	await checkJpa(jpa, notify);

	// Site relaunch: the watched section is gone, the page is full of new HTML.
	serveHtml("<html><body><main>alles neu</main></body></html>");
	await checkJpa(jpa, notify);
	await checkJpa(jpa, notify);

	expect(notify).not.toHaveBeenCalled();
	const state = await ensureScrapeState(jpa.id);
	expect(state.errorCount).toBe(2);
	expect(state.lastError).toContain("selector matched nothing");
});

test("a reset baseline turns the next differing content into a new baseline, not a notification", async () => {
	const jpa = await scrapableJpa();
	const notify = notifyMock();

	serveHtml(page("Inhalt unter altem Selektor"));
	await checkJpa(jpa, notify);

	// What the admin update mutation does when scrape config changes: the old
	// hash describes nothing anymore, so the state is dropped.
	await resetScrapeState(jpa.id);

	serveHtml(page("völlig anderer Inhalt unter neuem Selektor"));
	expect((await checkJpa(jpa, notify)).result).toBe("baseline");
	expect(notify).not.toHaveBeenCalled();
});

test("claimScrapeChange lets exactly one concurrent claim win", async () => {
	const jpa = await scrapableJpa();
	await ensureScrapeState(jpa.id);

	expect(await claimScrapeChange(jpa.id, null, "baseline")).toBe(true);
	expect(await claimScrapeChange(jpa.id, null, "other")).toBe(false);

	const claims = await Promise.all([
		claimScrapeChange(jpa.id, "baseline", "next-a"),
		claimScrapeChange(jpa.id, "baseline", "next-b"),
	]);
	expect(claims.filter(Boolean)).toHaveLength(1);
});

test("errors accumulate until a success resets them", async () => {
	const jpa = await scrapableJpa();
	await ensureScrapeState(jpa.id);

	await recordScrapeError(jpa.id, "HTTP 503");
	await recordScrapeError(jpa.id, "HTTP 503");
	let state = await ensureScrapeState(jpa.id);
	expect(state.errorCount).toBe(2);

	await recordScrapeSuccess(jpa.id);
	state = await ensureScrapeState(jpa.id);
	expect(state.errorCount).toBe(0);
	expect(state.lastError).toBeNull();
});

test("a published change mails confirmed subscribers once, through the real fan-out", async () => {
	const jpa = await scrapableJpa();

	const confirmed = await upsertPendingSubscriber(
		"confirmed@example.org",
		null,
	);
	await addEmailSubscription(confirmed.id, jpa.id);
	await confirmSubscriber(confirmed.confirmToken);

	// Never clicked the confirm link — must not be mailed.
	const pending = await upsertPendingSubscriber("pending@example.org", null);
	await addEmailSubscription(pending.id, jpa.id);

	const mailsTo = () =>
		sentMails.filter((mail) => mail.subject === `Neue Ergebnisse: ${jpa.name}`);

	serveHtml(page("alte Meldung"));
	expect((await checkJpa(jpa)).result).toBe("baseline");

	serveHtml(page("Neue Ergebnisse!"));
	expect(await checkJpa(jpa)).toEqual({
		result: "notified",
		mail: 1,
	});
	expect((await checkJpa(jpa)).result).toBe("unchanged");

	// The fan-out runs detached from checkJpa; give it a moment to drain.
	for (let i = 0; i < 50 && mailsTo().length === 0; i++) await Bun.sleep(10);
	await Bun.sleep(50);

	expect(mailsTo().map((mail) => mail.to)).toEqual(["confirmed@example.org"]);
	expect(mailsTo()[0].headers?.["List-Unsubscribe-Post"]).toBe(
		"List-Unsubscribe=One-Click",
	);
});

test("queueResultsNotifications respects the notifications pause", async () => {
	const jpa = await scrapableJpa();
	const outcome = await queueResultsNotifications({
		...jpa,
		notificationsDisabled: true,
	});
	expect(outcome).toEqual({ status: "disabled" });
});

test("queueResultsNotifications with no subscribers queues nothing", async () => {
	const jpa = await scrapableJpa();
	const outcome = await queueResultsNotifications(jpa);
	expect(outcome).toEqual({ status: "queued", mail: 0, total: 0 });
});
