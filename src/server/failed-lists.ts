import { extractText, getDocumentProxy } from "unpdf";
import { getKnownFailedListUrls, recordFailedList } from "@/db";
import { countKennziffern, findFailedListLinks } from "@/lib/failed-lists";

const TIMEOUT_MS = 30_000;

/**
 * Lists that downloaded fine but yielded no Kennziffern. Remembered per process
 * so an unreadable PDF is reported once per deploy instead of re-downloaded on
 * every five-minute tick.
 */
const unreadable = new Set<string>();

async function fetchPdfText(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	const pdf = await getDocumentProxy(
		new Uint8Array(await response.arrayBuffer()),
	);
	const { text } = await extractText(pdf, { mergePages: true });
	return text;
}

/**
 * Counts every not-yet-seen "nicht bestanden" list linked from a scraped
 * section. Runs on every check rather than only on a detected change: a failed
 * download is then simply retried on the next tick, and lists already on the
 * page when this shipped are picked up too.
 *
 * Never throws — statistics must not be able to break change detection.
 */
export async function recordFailedLists(
	jpa: { id: string; slug: string },
	pageUrl: string,
	content: string,
): Promise<void> {
	try {
		const links = findFailedListLinks(content, pageUrl);
		if (links.length === 0) return;
		const known = await getKnownFailedListUrls(links.map((link) => link.url));

		for (const link of links) {
			if (known.has(link.url) || unreadable.has(link.url)) continue;
			const failedCount = countKennziffern(await fetchPdfText(link.url));
			// An empty count is far likelier a scanned or restructured PDF than a
			// month where nobody failed — storing 0 would publish a wrong number.
			if (failedCount === 0) {
				unreadable.add(link.url);
				console.error(
					`[failed-lists] ${jpa.slug}: no Kennziffern found in ${link.url}`,
				);
				continue;
			}
			await recordFailedList({ jpaId: jpa.id, failedCount, ...link });
			console.log(
				`[failed-lists] ${jpa.slug}: ${failedCount} failed (${link.examMonth ?? "unknown month"})`,
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[failed-lists] ${jpa.slug}: ${message}`);
	}
}
