import { Database } from "bun:sqlite";
import { afterAll, expect, mock, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// src/db/index.ts opens its connection at import time, so the path has to be
// set before that module is pulled in — hence the dynamic imports below.
const DB_PATH = `${process.env.TMPDIR ?? "/tmp"}/examensradar-scraper-test-${crypto.randomUUID()}.db`;
process.env.DATABASE_PATH = DB_PATH;

const setup = new Database(DB_PATH);
setup.run("PRAGMA journal_mode = WAL");
migrate(drizzle(setup), { migrationsFolder: "./drizzle/migrations" });

const {
	claimScrapeChange,
	createJpa,
	ensureScrapeState,
	recordScrapeError,
	recordScrapeSuccess,
} = await import("../db/index.ts");
const { checkJpa } = await import("./scraper.ts");
const { queueResultsNotifications } = await import("./notify-results.ts");

const realFetch = globalThis.fetch;

afterAll(() => {
	globalThis.fetch = realFetch;
	setup.close();
	for (const suffix of ["", "-wal", "-shm"]) {
		Bun.file(`${DB_PATH}${suffix}`)
			.delete()
			.catch(() => {});
	}
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
		push: 0,
		mail: 0,
		total: 0,
	}));

test("first scrape stores a baseline and never notifies", async () => {
	const jpa = await scrapableJpa();
	const notify = notifyMock();

	serveHtml(page("Ergebnisse Mai 2026"));
	await checkJpa(jpa, notify);

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
	await checkJpa(jpa, notify);
	await checkJpa(jpa, notify);

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
	expect(outcome).toEqual({ status: "queued", push: 0, mail: 0, total: 0 });
});
