import {
	claimScrapeChange,
	ensureScrapeState,
	getScrapableJpas,
	recordScrapeError,
	recordScrapeSuccess,
} from "@/db";
import { extractContent, fetchPage, hashContent } from "@/lib/scraper";
import { queueResultsNotifications } from "./notify-results";

const DEFAULT_INTERVAL_MS = 5 * 60_000;

type Jpa = Awaited<ReturnType<typeof getScrapableJpas>>[number];
type Notify = typeof queueResultsNotifications;

/**
 * One JPA, one check: fetch → narrow → hash → compare against the stored
 * baseline. Every downstream effect of "the content changed" sits behind the
 * compare-and-swap in claimScrapeChange, so overlapping instances (during a
 * zero-downtime deploy) cannot fan the same publication out twice.
 */
export async function checkJpa(
	jpa: Jpa,
	notify: Notify = queueResultsNotifications,
): Promise<void> {
	if (!jpa.scrapeUrl || !jpa.scrapeSelector) return;

	const state = await ensureScrapeState(jpa.id);

	let content: string | null;
	try {
		const html = await fetchPage(jpa.scrapeUrl);
		// The selector is admin-entered and may be syntactically invalid — that
		// must land in lastError, not kill the cycle.
		content = extractContent(html, jpa.scrapeSelector);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await recordScrapeError(jpa.id, message);
		console.error(`[scraper] ${jpa.slug}: check failed: ${message}`);
		return;
	}

	if (content === null) {
		const message = `selector matched nothing: ${jpa.scrapeSelector}`;
		await recordScrapeError(jpa.id, message);
		console.error(`[scraper] ${jpa.slug}: ${message}`);
		return;
	}

	const hash = hashContent(content);

	if (hash === state.contentHash) {
		await recordScrapeSuccess(jpa.id);
		return;
	}

	const claimed = await claimScrapeChange(jpa.id, state.contentHash, hash);
	if (!claimed) {
		console.log(`[scraper] ${jpa.slug}: change already claimed elsewhere`);
		return;
	}

	if (state.contentHash === null) {
		// First observation ever — we cannot know whether this content is news,
		// so it only becomes the baseline. Notifying here would mass-push a false
		// positive on every fresh deployment.
		console.log(`[scraper] ${jpa.slug}: baseline stored`);
		return;
	}

	const outcome = await notify(jpa);
	console.log(
		outcome.status === "disabled"
			? `[scraper] ${jpa.slug}: changed, but notifications are paused`
			: `[scraper] ${jpa.slug}: changed — queued ${outcome.push} push, ${outcome.mail} mail`,
	);
}

async function runScrapeCycle(): Promise<void> {
	const jpas = await getScrapableJpas();
	await Promise.all(jpas.map((jpa) => checkJpa(jpa)));
}

let started = false;

/**
 * Boots the polling loop (idempotent). Opt-in via SCRAPER_ENABLED=true so dev
 * servers and one-off scripts never poll the JPAs or notify anyone by
 * accident; production sets the variable.
 */
export function startScraper(): void {
	if (started) return;

	if (process.env.SCRAPER_ENABLED !== "true") {
		console.log("[scraper] disabled — set SCRAPER_ENABLED=true to enable");
		return;
	}
	started = true;

	const intervalMs =
		Number(process.env.SCRAPE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

	let running = false;
	const tick = async () => {
		// A cycle that outlives the interval (slow JPA site, long ntfy backoff)
		// must not get another stacked on top of it.
		if (running) return;
		running = true;
		try {
			await runScrapeCycle();
		} catch (error) {
			console.error("[scraper] cycle crashed", error);
		} finally {
			running = false;
		}
	};

	console.log(`[scraper] started, checking every ${intervalMs / 1000}s`);
	void tick();
	setInterval(tick, intervalMs);
}
