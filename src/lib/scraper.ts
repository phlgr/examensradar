import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

const TIMEOUT_MS = 30_000;
const RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 10_000;

/**
 * Kept verbatim from the retired changebot so the JPA sites see the exact
 * client that has been polling them for months — a new UA is a new variable
 * with a WAF on the other side.
 */
const USER_AGENT = "Mozilla/5.0 (compatible; WebsiteChangeDetection/1.0)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetches the raw HTML of a page, retrying with backoff. Throws when all attempts fail. */
export async function fetchPage(url: string): Promise<string> {
	let lastError: unknown;

	for (let attempt = 1; attempt <= RETRIES; attempt++) {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(TIMEOUT_MS),
				headers: { "User-Agent": USER_AGENT },
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.text();
		} catch (error) {
			lastError = error;
			if (attempt < RETRIES) {
				await sleep(
					Math.min(
						INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
						MAX_RETRY_DELAY_MS,
					),
				);
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Narrows a page to the watched section, returning its inner HTML.
 *
 * Null when the selector matches nothing. That is deliberately NOT a fallback
 * to the whole page (which is what changebot did): a vanished selector means
 * the site was restructured, and diffing the full page instead would turn the
 * relaunch — or any cookie-banner tweak — into a false "new results" push to
 * every subscriber. A broken selector must surface as an error, not a change.
 */
export function extractContent(html: string, selector: string): string | null {
	const $ = cheerio.load(html);
	const element = $(selector).first();

	if (element.length === 0) return null;

	return (element.html() ?? element.text()).trim();
}

export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}
