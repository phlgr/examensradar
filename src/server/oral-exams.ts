import { extractText, getDocumentProxy } from "unpdf";
import type { KennzifferIndex } from "@/lib/kennziffer";
import {
	indexAssignments,
	mergeRows,
	ORAL_EXAM_SOURCES,
	type OralExamAssignmentRow,
	type OralExamSchedule,
	type OralExamSource,
	upcomingAssignments,
} from "@/lib/oral-exams";

const REFRESH_MS = 6 * 60 * 60_000;
const RETRY_MS = 15 * 60_000;
const TIMEOUT_MS = 10_000;
const ASSIGNMENT_CONCURRENCY = 4;
const USER_AGENT = "Mozilla/5.0";

interface OralExamData {
	schedule: OralExamSchedule;
	assignments: KennzifferIndex;
}

type Format = OralExamSource["format"];

/** Reads one published document as text. */
type Reader = (url: string, format: Format) => Promise<string>;

interface CacheEntry {
	data?: OralExamData;
	nextCheck: number;
	inflight?: Promise<void>;
}

const cache = new Map<string, CacheEntry>();

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url, {
		headers: { "user-agent": USER_AGENT },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

const readDocument: Reader = async (url, format) => {
	const bytes = await fetchBytes(url);
	if (format === "html") return new TextDecoder().decode(bytes);
	const { text } = await extractText(await getDocumentProxy(bytes), {
		mergePages: true,
	});
	return text;
};

const messageOf = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

async function mapLimit<T, R>(
	items: T[],
	limit: number,
	work: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = [];
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (next < items.length) {
				const position = next++;
				results[position] = await work(items[position]);
			}
		}),
	);
	return results;
}

/** A broken assignment document is logged and skipped: it must not cost the day list. */
async function loadAssignments(
	slug: string,
	source: OralExamSource,
	indexHtml: string,
	read: Reader,
): Promise<OralExamAssignmentRow[]> {
	const { assignments } = source;
	if (!assignments) return [];
	const rows = await mapLimit(
		assignments.documents(indexHtml),
		ASSIGNMENT_CONCURRENCY,
		async (url) => {
			try {
				return assignments.parse(await read(url, assignments.format));
			} catch (error) {
				console.error(`[oral-exams] ${slug}: ${url}: ${messageOf(error)}`);
				return [];
			}
		},
	);
	return rows.flat();
}

export async function loadOralExams(
	slug: string,
	source: OralExamSource,
	readUncached: Reader = readDocument,
): Promise<OralExamData> {
	// Düsseldorf lists schedule and Kennziffern on the same pages.
	const reads = new Map<string, Promise<string>>();
	const read: Reader = (url, format) => {
		let text = reads.get(url);
		if (!text) {
			text = readUncached(url, format);
			reads.set(url, text);
		}
		return text;
	};
	const withUrl = async <T>(url: string, work: Promise<T>) => {
		try {
			return await work;
		} catch (error) {
			throw new Error(`${url}: ${messageOf(error)}`);
		}
	};

	const index = await withUrl(source.indexUrl, read(source.indexUrl, "html"));
	const urls = source.documents(index);
	if (urls.length === 0)
		throw new Error(`no schedule documents linked on ${source.indexUrl}`);

	const [rows, assignmentRows] = await Promise.all([
		Promise.all(
			urls.map(async (url) =>
				source.parse(await withUrl(url, read(url, source.format))),
			),
		),
		loadAssignments(slug, source, index, read),
	]);
	return {
		schedule: {
			days: mergeRows(rows.flat()),
			sourceUrl: source.linkUrl,
			fetchedAt: new Date().toISOString(),
			lookup: source.assignments !== undefined,
		},
		assignments: indexAssignments(assignmentRows),
	};
}

/** A failed refresh keeps the last good schedule and retries sooner. */
function refresh(slug: string, source: OralExamSource, entry: CacheEntry) {
	entry.inflight = loadOralExams(slug, source)
		.then((data) => {
			entry.data = data;
			entry.nextCheck = Date.now() + REFRESH_MS;
		})
		.catch((error) => {
			console.error(
				`[oral-exams] ${slug}: refresh failed: ${messageOf(error)}`,
			);
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
async function getOralExamData(
	slug: string,
): Promise<OralExamData | undefined> {
	const source = ORAL_EXAM_SOURCES[slug];
	if (!source) return undefined;
	let entry = cache.get(slug);
	if (!entry) {
		entry = { nextCheck: 0 };
		cache.set(slug, entry);
	}
	if (!entry.inflight && Date.now() >= entry.nextCheck)
		refresh(slug, source, entry);
	if (!entry.data && entry.inflight) await entry.inflight;
	return entry.data;
}

export async function getOralExamSchedule(
	slug: string,
): Promise<OralExamSchedule | undefined> {
	return (await getOralExamData(slug))?.schedule;
}

const berlinToday = (now: Date) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now);

/** Only what is still ahead: past exams are of no use to anyone and need not be shipped. */
export async function getUpcomingAssignments(
	slug: string,
	now = new Date(),
): Promise<KennzifferIndex> {
	const data = await getOralExamData(slug);
	return data ? upcomingAssignments(data.assignments, berlinToday(now)) : {};
}
