import { extractText, getDocumentProxy } from "unpdf";
import {
	mergeRows,
	ORAL_EXAM_SOURCES,
	type OralExamSchedule,
	type OralExamSource,
} from "@/lib/oral-exams";

const REFRESH_MS = 6 * 60 * 60_000;
const RETRY_MS = 15 * 60_000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0";

interface CacheEntry {
	schedule?: OralExamSchedule;
	nextCheck: number;
	inflight?: Promise<void>;
}

const cache = new Map<string, CacheEntry>();

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url, {
		headers: { "user-agent": USER_AGENT },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

async function fetchDocument(
	url: string,
	format: OralExamSource["format"],
): Promise<string> {
	const bytes = await fetchBytes(url);
	if (format === "html") return new TextDecoder().decode(bytes);
	const { text } = await extractText(await getDocumentProxy(bytes), {
		mergePages: true,
	});
	return text;
}

async function loadSchedule(source: OralExamSource): Promise<OralExamSchedule> {
	const index = new TextDecoder().decode(await fetchBytes(source.indexUrl));
	const urls = source.documents(index);
	if (urls.length === 0)
		throw new Error(`no schedule documents linked on ${source.indexUrl}`);

	const rows = await Promise.all(
		urls.map(async (url) => {
			try {
				return source.parse(await fetchDocument(url, source.format));
			} catch (error) {
				throw new Error(
					`${url}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}),
	);
	return {
		days: mergeRows(rows.flat()),
		sourceUrl: source.linkUrl,
		fetchedAt: new Date().toISOString(),
	};
}

/** A failed refresh keeps the last good schedule and retries sooner. */
function refresh(slug: string, source: OralExamSource, entry: CacheEntry) {
	entry.inflight = loadSchedule(source)
		.then((schedule) => {
			entry.schedule = schedule;
			entry.nextCheck = Date.now() + REFRESH_MS;
		})
		.catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`[oral-exams] ${slug}: refresh failed: ${message}`);
			entry.nextCheck = Date.now() + RETRY_MS;
		})
		.finally(() => {
			entry.inflight = undefined;
		});
	return entry.inflight;
}

/**
 * Loads lazily where it is read: a cache filled from a nitro plugin lives in a
 * different module instance than the SSR server fns and is never seen there.
 */
export async function getOralExamSchedule(
	slug: string,
): Promise<OralExamSchedule | undefined> {
	const source = ORAL_EXAM_SOURCES[slug];
	if (!source) return undefined;
	let entry = cache.get(slug);
	if (!entry) {
		entry = { nextCheck: 0 };
		cache.set(slug, entry);
	}
	if (!entry.inflight && Date.now() >= entry.nextCheck)
		refresh(slug, source, entry);
	if (!entry.schedule && entry.inflight) await entry.inflight;
	return entry.schedule;
}
