import * as cheerio from "cheerio";

/**
 * Some JPAs publish, under § 20 Abs. 1 Nr. 1 JAG NRW, a monthly PDF listing
 * the Kennziffern of everyone who already failed on the written exams
 * (Düsseldorf and Köln do; Hamm stopped in 2026 and mails the candidates
 * instead). Counting the entries gives the one near-real-time exam statistic
 * there is — though only a count: nobody publishes how many sat the exams, so
 * this is never a failure rate.
 */

const MONTHS = [
	"januar",
	"februar",
	"maerz",
	"april",
	"mai",
	"juni",
	"juli",
	"august",
	"september",
	"oktober",
	"november",
	"dezember",
];

export interface FailedListLink {
	url: string;
	/** Month the exams were written, "yyyy-mm"; null when the file name doesn't say. */
	examMonth: string | null;
}

/**
 * The exam month as both offices encode it in the file name
 * ("Liste-Juni-2026.pdf").
 */
function examMonthOf(text: string): string | null {
	const normalized = text.toLowerCase().replace(/ä/g, "ae");
	const match = normalized.match(
		new RegExp(`(${MONTHS.join("|")})[-_ ]*(\\d{4})`),
	);
	if (!match) return null;
	const month = MONTHS.indexOf(match[1]) + 1;
	return `${match[2]}-${String(month).padStart(2, "0")}`;
}

/**
 * Links to PDFs called "Liste…" in a scraped section, resolved against the
 * page URL. Matching on the name rather than per-JPA config keeps other PDFs
 * (Hamm's notice that it no longer publishes a list) from counting as an empty
 * list.
 */
export function findFailedListLinks(
	html: string,
	pageUrl: string,
): FailedListLink[] {
	const $ = cheerio.load(html);
	const links = new Map<string, FailedListLink>();
	$("a[href]").each((_, element) => {
		const href = $(element).attr("href") ?? "";
		const text = $(element).text();
		if (!/\.pdf(\?|$)/i.test(href)) return;
		const fileName = decodeURIComponent(href.split("/").pop() ?? "");
		if (!/liste/i.test(fileName) && !/liste/i.test(text)) return;
		const url = new URL(href, pageUrl).href;
		links.set(url, {
			url,
			examMonth: examMonthOf(fileName) ?? examMonthOf(text),
		});
	});
	return [...links.values()];
}

/** Kennziffern look like "7063/26": a number, a slash, the two-digit year. */
export function countKennziffern(text: string): number {
	return new Set(text.match(/(?<![\d/])\d{1,5}\/\d{2}(?![\d/])/g)).size;
}
