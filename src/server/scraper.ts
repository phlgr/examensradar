import {
	claimScrapeBaseline,
	claimScrapeChange,
	ensureScrapeState,
	getScrapableJpas,
	recordScrapeError,
	recordScrapeSuccess,
	recordSelectorMatch,
} from "@/db";
import {
	type Extraction,
	extractContent,
	fetchPage,
	hashContent,
} from "@/lib/scraper";
import { kickMailOutbox } from "./mail-outbox";

const DEFAULT_INTERVAL_MS = 5 * 60_000;

type Jpa = Awaited<ReturnType<typeof getScrapableJpas>>[number];

/**
 * Baseline of a JPA whose selector has never matched: nothing is published
 * yet, so the first match is a release, not a silent baseline.
 */
const ABSENT_HASH = "absent";

export type CheckOutcome =
	| { result: "not-configured" }
	| { result: "error"; message: string }
	| { result: "unchanged" }
	| { result: "already-claimed" }
	| { result: "baseline" }
	| { result: "paused" }
	| { result: "notified"; mail: number };

export async function checkJpa(
	jpa: Jpa,
	kick: () => void = kickMailOutbox,
): Promise<CheckOutcome> {
	if (!jpa.scrapeUrl || !jpa.scrapeSelector)
		return { result: "not-configured" };

	const state = await ensureScrapeState(jpa.id);

	let extraction: Extraction;
	try {
		const html = await fetchPage(jpa.scrapeUrl);
		extraction = extractContent(html, jpa.scrapeSelector);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await recordScrapeError(jpa.id, message);
		console.error(`[scraper] ${jpa.slug}: check failed: ${message}`);
		return { result: "error", message };
	}

	if (extraction.matched) {
		await recordSelectorMatch(jpa.id);
	} else if (state.contentHash !== null) {
		// Removal is not a release. Keeping the last hash also means identical
		// content reappearing is not news.
		await recordScrapeSuccess(jpa.id);
		return { result: "unchanged" };
	}

	const hash = extraction.matched
		? hashContent(extraction.content)
		: ABSENT_HASH;

	if (hash === state.contentHash) {
		await recordScrapeSuccess(jpa.id);
		return { result: "unchanged" };
	}

	if (state.contentHash === null) {
		if (!(await claimScrapeBaseline(jpa.id, hash))) {
			console.log(`[scraper] ${jpa.slug}: change already claimed elsewhere`);
			return { result: "already-claimed" };
		}
		console.log(`[scraper] ${jpa.slug}: baseline stored`);
		return { result: "baseline" };
	}

	const claim = await claimScrapeChange(jpa.id, state.contentHash, hash, {
		notify: !jpa.notificationsDisabled,
	});
	switch (claim.kind) {
		case "lost":
			console.log(`[scraper] ${jpa.slug}: change already claimed elsewhere`);
			return { result: "already-claimed" };
		case "paused":
			console.log(
				`[scraper] ${jpa.slug}: changed, but notifications are paused`,
			);
			return { result: "paused" };
		case "queued":
			console.log(`[scraper] ${jpa.slug}: changed — queued ${claim.mail} mail`);
			kick();
			return { result: "notified", mail: claim.mail };
	}
}

async function runScrapeCycle(): Promise<void> {
	const jpas = await getScrapableJpas();
	await Promise.all(jpas.map((jpa) => checkJpa(jpa)));
}

let started = false;

export function startScraper(): void {
	if (started) return;
	started = true;

	const intervalMs =
		Number(process.env.SCRAPE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

	let cycleInFlight = false;
	const tick = async () => {
		if (cycleInFlight) return;
		cycleInFlight = true;
		try {
			await runScrapeCycle();
			kickMailOutbox();
		} catch (error) {
			console.error("[scraper] cycle crashed", error);
		} finally {
			cycleInFlight = false;
		}
	};

	console.log(`[scraper] started, checking every ${intervalMs / 1000}s`);
	kickMailOutbox();
	void tick();
	setInterval(tick, intervalMs);
}
