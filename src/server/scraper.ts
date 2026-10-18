import {
	claimScrapeBaseline,
	claimScrapeChange,
	ensureScrapeState,
	getScrapableJpas,
	recordScrapeError,
	recordScrapeSuccess,
} from "@/db";
import {
	type Extraction,
	extractContent,
	fetchPage,
	hashContent,
} from "@/lib/scraper";
import { queueResultsNotifications } from "./notify-results";

const DEFAULT_INTERVAL_MS = 5 * 60_000;

type Jpa = Awaited<ReturnType<typeof getScrapableJpas>>[number];
type Notify = typeof queueResultsNotifications;

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
	notify: Notify = queueResultsNotifications,
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

	if (!extraction.matched) {
		const message = `selector matched nothing: ${jpa.scrapeSelector}`;
		await recordScrapeError(jpa.id, message);
		console.error(`[scraper] ${jpa.slug}: ${message}`);
		return { result: "error", message };
	}

	const hash = hashContent(extraction.content);

	if (hash === state.contentHash) {
		await recordScrapeSuccess(jpa.id);
		return { result: "unchanged" };
	}

	const claimed =
		state.contentHash === null
			? await claimScrapeBaseline(jpa.id, hash)
			: await claimScrapeChange(jpa.id, state.contentHash, hash);
	if (!claimed) {
		console.log(`[scraper] ${jpa.slug}: change already claimed elsewhere`);
		return { result: "already-claimed" };
	}

	if (state.contentHash === null) {
		console.log(`[scraper] ${jpa.slug}: baseline stored`);
		return { result: "baseline" };
	}

	const outcome = await notify(jpa);
	console.log(
		outcome.status === "disabled"
			? `[scraper] ${jpa.slug}: changed, but notifications are paused`
			: `[scraper] ${jpa.slug}: changed — queued ${outcome.mail} mail`,
	);
	return outcome.status === "disabled"
		? { result: "paused" }
		: { result: "notified", mail: outcome.mail };
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
		} catch (error) {
			console.error("[scraper] cycle crashed", error);
		} finally {
			cycleInFlight = false;
		}
	};

	console.log(`[scraper] started, checking every ${intervalMs / 1000}s`);
	void tick();
	setInterval(tick, intervalMs);
}
