import { load } from "cheerio";
import { MONTHS } from "@/lib/exam-calendar";

export interface OralExamDay {
	date: string;
	places: string[];
}

export interface OralExamSchedule {
	days: OralExamDay[];
	sourceUrl: string;
	fetchedAt: string;
}

export interface OralExamRow {
	date: string;
	place: string;
}

export interface OralExamSource {
	indexUrl: string;
	linkUrl: string;
	format: "pdf" | "html";
	/** Absolute URLs of the documents on the index page that hold the schedule. */
	documents(indexHtml: string): string[];
	/** Throws when the document yields no rows, so a layout change is not mistaken for an empty month. */
	parse(content: string): OralExamRow[];
}

const WEEKDAYS = [
	"Sonntag",
	"Montag",
	"Dienstag",
	"Mittwoch",
	"Donnerstag",
	"Freitag",
	"Samstag",
];

const DATE = String.raw`(\d{2})\.(\d{2})\.(\d{4})`;

function isoDate(
	day: string,
	month: string,
	year: string,
	weekday?: string,
): string {
	const date = new Date(Date.UTC(+year, +month - 1, +day));
	const iso = date.toISOString().slice(0, 10);
	if (iso !== `${year}-${month}-${day}`)
		throw new Error(`invalid date ${day}.${month}.${year}`);
	const dow = date.getUTCDay();
	if (weekday ? WEEKDAYS[dow] !== weekday : dow === 0 || dow === 6)
		throw new Error(`implausible weekday for ${day}.${month}.${year}`);
	return iso;
}

function nonEmpty(rows: OralExamRow[]): OralExamRow[] {
	if (rows.length === 0) throw new Error("no oral exam rows found");
	return rows;
}

function links(html: string, baseUrl: string) {
	const $ = load(html);
	return $("a[href]")
		.toArray()
		.map((a) => ({
			text: $(a).text().replace(/\s+/g, " ").trim(),
			url: new URL($(a).attr("href") ?? "", baseUrl),
		}));
}

const HAMM_ROW = new RegExp(`^${DATE} (.+)$`, "gm");

function hammPlace(place: string): string {
	return place.replace(/ \(U\)$/, "").replace(/ Nst\b.*$/, " (Nebenstelle)");
}

const KOELN_ROW = new RegExp(
	`^(${WEEKDAYS.join("|")}) ${DATE} (\\d+[A-Z]?)$`,
	"gm",
);

const MONTH_PAGE = new RegExp(`^(${MONTHS.join("|")}) \\d{4}$`);

export const ORAL_EXAM_SOURCES: Record<string, OralExamSource> = {
	hamm: {
		indexUrl:
			"https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/index.php",
		linkUrl:
			"https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/02_staatl_pflichtfachpruefung/04_termine/02_muendliche_Pruefung/index.php",
		format: "pdf",
		documents(html) {
			return links(html, this.indexUrl)
				.filter(
					({ text, url }) =>
						url.pathname.endsWith(".pdf") &&
						/^Termine und Orte der mündlichen Prüfungen/.test(text),
				)
				.map(({ url }) => url.href);
		},
		parse: (text) =>
			nonEmpty(
				[
					...text.split("Anschriften der Prüfungssäle")[0].matchAll(HAMM_ROW),
				].map(([, day, month, year, place]) => ({
					date: isoDate(day, month, year),
					place: hammPlace(place.trim()),
				})),
			),
	},
	köln: {
		indexUrl:
			"https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/003_staatl-pflichtfachpruefung/004_muendlichepruefung/001_termine/index.php",
		linkUrl:
			"https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/003_staatl-pflichtfachpruefung/004_muendlichepruefung/001_termine/index.php",
		format: "pdf",
		// The per-day PDFs in subfolders name the examinees; only the overviews next to the index are used.
		documents(html) {
			const folder = new URL(".", this.indexUrl).href;
			return links(html, this.indexUrl)
				.filter(
					({ url }) =>
						url.pathname.endsWith(".pdf") && new URL(".", url).href === folder,
				)
				.map(({ url }) => url.href);
		},
		parse: (text) =>
			nonEmpty(
				[...text.matchAll(KOELN_ROW)].map(
					([, weekday, day, month, year, room]) => ({
						date: isoDate(day, month, year, weekday),
						place: `Raum ${room}`,
					}),
				),
			),
	},
	düsseldorf: {
		indexUrl:
			"https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06jpa-a-z/06muendliche_pruefung/06ort_u_termine/index.php",
		linkUrl:
			"https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06jpa-a-z/06muendliche_pruefung/06ort_u_termine/index.php",
		format: "html",
		documents(html) {
			return links(html, this.indexUrl)
				.filter(({ text }) => MONTH_PAGE.test(text))
				.map(({ url }) => url.href);
		},
		// The panel cells list examiner names and Kennziffern: only the first two columns are ever read.
		parse(html) {
			const $ = load(html);
			const rows: OralExamRow[] = [];
			$("tr").each((_, tr) => {
				const cells = $(tr).children("td");
				const date = cells
					.eq(0)
					.text()
					.trim()
					.match(new RegExp(`^${DATE}$`));
				const room = cells.eq(1).text().replace(/\s+/g, " ").trim();
				if (date && room)
					rows.push({
						date: isoDate(date[1], date[2], date[3]),
						place: `Saal ${room}`,
					});
			});
			return nonEmpty(rows);
		},
	},
};

export function mergeRows(rows: OralExamRow[]): OralExamDay[] {
	const places = new Map<string, Set<string>>();
	for (const { date, place } of rows) {
		places.set(date, (places.get(date) ?? new Set()).add(place));
	}
	return [...places]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, set]) => ({
			date,
			places: [...set].sort((a, b) => a.localeCompare(b, "de")),
		}));
}
