import { load } from "cheerio";
import { MONTHS } from "@/lib/exam-calendar";
import {
	type KennzifferIndex,
	normalizeKennziffer,
	type OralExamAssignment,
} from "@/lib/kennziffer";

export interface OralExamDay {
	date: string;
	places: string[];
}

export interface OralExamSchedule {
	days: OralExamDay[];
	sourceUrl: string;
	fetchedAt: string;
	/** Whether the office publishes Kennziffer assignments the page can look up. */
	lookup: boolean;
}

export interface OralExamRow {
	date: string;
	place: string;
}

export interface OralExamAssignmentRow extends OralExamAssignment {
	kennziffer: string;
}

/** Where candidates are named by Kennziffer. Best effort: a broken document is skipped, not fatal. */
interface OralExamAssignmentSource {
	format: "pdf" | "html";
	/** Absolute URLs of the documents on the index page that list Kennziffern. */
	documents(indexHtml: string): string[];
	/** Keeps only date, place, start time and the Kennziffer: never any other text of the document. */
	parse(content: string): OralExamAssignmentRow[];
}

export interface OralExamSource {
	indexUrl: string;
	linkUrl: string;
	format: "pdf" | "html";
	/** Absolute URLs of the documents on the index page that hold the schedule. */
	documents(indexHtml: string): string[];
	/** Throws when the document yields no rows, so a layout change is not mistaken for an empty month. */
	parse(content: string): OralExamRow[];
	assignments?: OralExamAssignmentSource;
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

const KOELN_INDEX =
	"https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/003_staatl-pflichtfachpruefung/004_muendlichepruefung/001_termine/index.php";
const DUESSELDORF_INDEX =
	"https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06jpa-a-z/06muendliche_pruefung/06ort_u_termine/index.php";

// Rows are "Nr. Kennziffer"; altes Recht adds per-candidate "Vorbereitung Vortrag" times, and the candidate has to be there for the first. Examiner lines never match.
const KOELN_ASSIGNMENT_ROW =
	/^\d+ (\d{1,4}\/\d{2})(?: (\d{2}:\d{2}) \d{2}:\d{2})?$/gm;
const KOELN_BEGINN = /^Beginn der Prüfung: ca\. (\d{1,2})\.(\d{2}) Uhr$/m;
const KOELN_ROOM = /^Saal (\d+[A-Z]?)$/m;
const KOELN_DATE = new RegExp(`^${DATE}$`, "m");

const KENNZIFFER_IN_TEXT = /(?<![\d/])\d{1,4}\/\d{2}(?!\d)/g;

function duesseldorfRows(html: string) {
	const $ = load(html);
	return $("tr")
		.toArray()
		.flatMap((tr) => {
			const cells = $(tr).children("td");
			const date = cells
				.eq(0)
				.text()
				.trim()
				.match(new RegExp(`^${DATE}$`));
			const room = cells.eq(1).text().replace(/\s+/g, " ").trim();
			if (!date || !room) return [];
			return {
				date: isoDate(date[1], date[2], date[3]),
				place: `Saal ${room}`,
				panelHtml: cells
					.slice(2)
					.toArray()
					.map((cell) => $(cell).html() ?? "")
					.join("<br>"),
			};
		});
}

function duesseldorfMonthPages(indexHtml: string): string[] {
	return links(indexHtml, DUESSELDORF_INDEX)
		.filter(({ text }) => MONTH_PAGE.test(text))
		.map(({ url }) => url.href);
}

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
		indexUrl: KOELN_INDEX,
		linkUrl: KOELN_INDEX,
		format: "pdf",
		// The day list reads only the overviews next to the index. The per-room PDFs in subfolders also name the examiners and feed the assignments.
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
		assignments: {
			format: "pdf",
			documents(html) {
				const folder = new URL(".", KOELN_INDEX).href;
				return links(html, KOELN_INDEX)
					.filter(
						({ url }) =>
							url.pathname.endsWith(".pdf") &&
							url.href.startsWith(folder) &&
							new URL(".", url).href !== folder,
					)
					.map(({ url }) => url.href);
			},
			parse(text) {
				const date = text.match(KOELN_DATE);
				const room = text.match(KOELN_ROOM);
				if (!date || !room) throw new Error("no date or room found");
				const beginn = text.match(KOELN_BEGINN);
				const fallbackStart = beginn
					? `${beginn[1].padStart(2, "0")}:${beginn[2]}`
					: undefined;
				const iso = isoDate(date[1], date[2], date[3]);
				const rows = [...text.matchAll(KOELN_ASSIGNMENT_ROW)].flatMap(
					([, raw, start]) => {
						const kennziffer = normalizeKennziffer(raw);
						return kennziffer
							? {
									kennziffer,
									date: iso,
									place: `Raum ${room[1]}`,
									start: start ?? fallbackStart,
								}
							: [];
					},
				);
				if (rows.length === 0) throw new Error("no Kennziffern found");
				return rows;
			},
		},
	},
	düsseldorf: {
		indexUrl: DUESSELDORF_INDEX,
		linkUrl: DUESSELDORF_INDEX,
		format: "html",
		documents: duesseldorfMonthPages,
		parse: (html) =>
			nonEmpty(
				duesseldorfRows(html).map(({ date, place }) => ({ date, place })),
			),
		// The panel cells list examiner names too: they are only scanned for the number pattern, never kept.
		assignments: {
			format: "html",
			documents: duesseldorfMonthPages,
			parse(html) {
				const rows = duesseldorfRows(html);
				if (rows.length === 0) throw new Error("no oral exam rows found");
				return rows.flatMap(({ date, place, panelHtml }) =>
					[
						...panelHtml.replace(/<[^>]+>/g, " ").matchAll(KENNZIFFER_IN_TEXT),
					].flatMap(([raw]) => {
						const kennziffer = normalizeKennziffer(raw);
						return kennziffer ? { kennziffer, date, place } : [];
					}),
				);
			},
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

export function indexAssignments(
	rows: OralExamAssignmentRow[],
): KennzifferIndex {
	const index: KennzifferIndex = {};
	for (const { kennziffer, ...assignment } of rows)
		index[kennziffer] ??= assignment;
	return index;
}

export function upcomingAssignments(
	index: KennzifferIndex,
	today: string,
): KennzifferIndex {
	return Object.fromEntries(
		Object.entries(index).filter(([, { date }]) => date >= today),
	);
}
