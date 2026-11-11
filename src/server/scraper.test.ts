import { afterAll, expect, mock, test } from "bun:test";
import {
	claimScrapeBaseline,
	claimScrapeChange,
	createJpa,
	dropScrapeBaseline,
	ensureScrapeState,
	recordScrapeError,
	recordScrapeSuccess,
} from "../db/index.ts";
import { checkJpa } from "./scraper.ts";

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

test("first scrape stores a baseline and never notifies", async () => {
	const jpa = await scrapableJpa();
	const kick = mock(() => {});

	serveHtml(page("Ergebnisse Mai 2026"));
	const outcome = await checkJpa(jpa, kick);

	expect(outcome.result).toBe("baseline");
	expect(kick).not.toHaveBeenCalled();
	const state = await ensureScrapeState(jpa.id);
	expect(state.contentHash).not.toBeNull();
	expect(state.lastChangedAt).toBeNull();
});

test("unchanged content notifies nobody", async () => {
	const jpa = await scrapableJpa();
	const kick = mock(() => {});

	serveHtml(page("nichts Neues"));
	await checkJpa(jpa, kick);
	await checkJpa(jpa, kick);

	expect(kick).not.toHaveBeenCalled();
});

test("changed content notifies exactly once", async () => {
	const jpa = await scrapableJpa();
	const kick = mock(() => {});

	serveHtml(page("alte Meldung"));
	await checkJpa(jpa, kick);

	serveHtml(page("Neue Ergebnisse!"));
	expect((await checkJpa(jpa, kick)).result).toBe("notified");
	expect((await checkJpa(jpa, kick)).result).toBe("unchanged");

	expect(kick).toHaveBeenCalledTimes(1);
	const state = await ensureScrapeState(jpa.id);
	expect(state.lastChangedAt).not.toBeNull();
});

test("a vanished selector records an error instead of notifying", async () => {
	const jpa = await scrapableJpa();
	const kick = mock(() => {});

	serveHtml(page("Basislinie"));
	await checkJpa(jpa, kick);

	serveHtml("<html><body><main>alles neu</main></body></html>");
	await checkJpa(jpa, kick);
	await checkJpa(jpa, kick);

	expect(kick).not.toHaveBeenCalled();
	const state = await ensureScrapeState(jpa.id);
	expect(state.errorCount).toBe(2);
	expect(state.lastError).toContain("selector matched nothing");
});

test("a reset baseline turns the next differing content into a new baseline, not a notification", async () => {
	const jpa = await scrapableJpa();
	const kick = mock(() => {});

	serveHtml(page("Inhalt unter altem Selektor"));
	await checkJpa(jpa, kick);

	await dropScrapeBaseline(jpa.id);

	serveHtml(page("völlig anderer Inhalt unter neuem Selektor"));
	expect((await checkJpa(jpa, kick)).result).toBe("baseline");
	expect(kick).not.toHaveBeenCalled();
});

test("baseline and change claims each let exactly one concurrent claim win", async () => {
	const jpa = await scrapableJpa();
	await ensureScrapeState(jpa.id);

	expect(await claimScrapeBaseline(jpa.id, "baseline")).toBe(true);
	expect(await claimScrapeBaseline(jpa.id, "other")).toBe(false);

	const claims = await Promise.all([
		claimScrapeChange(jpa.id, "baseline", "next-a", { notify: true }),
		claimScrapeChange(jpa.id, "baseline", "next-b", { notify: true }),
	]);
	expect(claims.filter((claim) => claim.kind === "queued")).toHaveLength(1);
	expect(claims.filter((claim) => claim.kind === "lost")).toHaveLength(1);
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
