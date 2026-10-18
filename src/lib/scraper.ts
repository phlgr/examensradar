import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

const TIMEOUT_MS = 30_000;
const RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 10_000;

const USER_AGENT = "Mozilla/5.0 (compatible; WebsiteChangeDetection/1.0)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export function extractContent(html: string, selector: string): string | null {
	const $ = cheerio.load(html);
	const element = $(selector).first();

	if (element.length === 0) return null;

	return (element.html() ?? element.text()).trim();
}

export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}
