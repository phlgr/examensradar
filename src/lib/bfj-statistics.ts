/**
 * Parses the "staatliche Pflichtfachprüfung" table out of the Bundesamt für
 * Justiz' yearly Ausbildungsstatistik (Juristenausbildung_<year>.pdf).
 *
 * The PDFs are real text, but the extracted layout is messy: Land names are
 * hyphenated across lines ("Nordrhein-\nWestfalen", "Branden\nburg"), carry
 * footnote markers ("3) 4)" until 2021, bare "3 4 7" since), and from 2022 the
 * table spans two pages with a repeated header. What stays stable is that each
 * row ends in a fixed number of value columns, so rows are read from the right.
 */

export const LAENDER = [
	"Baden-Württemberg",
	"Bayern",
	"Berlin",
	"Brandenburg",
	"Bremen",
	"Hamburg",
	"Hessen",
	"Mecklenburg-Vorpommern",
	"Niedersachsen",
	"Nordrhein-Westfalen",
	"Rheinland-Pfalz",
	"Saarland",
	"Sachsen",
	"Sachsen-Anhalt",
	"Schleswig-Holstein",
	"Thüringen",
] as const;

type Land = (typeof LAENDER)[number];

export interface PflichtfachResult {
	examined: number;
	examinedWomen: number;
	passed: number;
	grades: {
		sehrGut: number;
		gut: number;
		vollbefriedigend: number;
		befriedigend: number;
		ausreichend: number;
	};
	failed: number;
	failedWomen: number;
	/** Out of attempts for good. Only reported since 2017. */
	failedFinal: number | null;
}

export interface PflichtfachYear {
	year: number;
	/** The BfJ's "Stand" date of the edition, ISO yyyy-mm-dd. */
	asOf: string | null;
	laender: Record<Land, PflichtfachResult>;
	total: PflichtfachResult;
}

const TITLE = /Ergebnisse der staatlichen Pflichtfachprüfung im Jahre (\d{4})/;
const NUMBER = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/;
const MONTHS = [
	"Januar",
	"Februar",
	"März",
	"April",
	"Mai",
	"Juni",
	"Juli",
	"August",
	"September",
	"Oktober",
	"November",
	"Dezember",
];

const letters = (text: string) => text.toLowerCase().replace(/[^a-zäöüß]/g, "");

// Longest first, so "Sachsen-Anhalt" wins over its suffix-free "Sachsen" and
// "Brandenburg" can't be mistaken for anything shorter.
const LAND_KEYS = [...LAENDER, "Zusammen"]
	.map((name) => ({ name, key: letters(name) }))
	.sort((a, b) => b.key.length - a.key.length);

const toInt = (token: string) => Number(token.replace(/\./g, ""));

/** "Stand: 11. Juni 2026", or "Stand: 11.11.2022" in the 2020/21 editions. */
function parseAsOf(text: string): string | null {
	const match = text.match(
		/Stand:\s*(\d{1,2})\.\s*([A-Za-zä]+|\d{1,2}\.)\s*(\d{4})/,
	);
	if (!match) return null;
	const month = /^\d/.test(match[2])
		? Number.parseInt(match[2], 10)
		: MONTHS.indexOf(match[2]) + 1;
	if (month < 1 || month > 12) return null;
	return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function toResult(values: number[], withFinal: boolean): PflichtfachResult {
	return {
		examined: values[0],
		examinedWomen: values[1],
		passed: values[3],
		grades: {
			sehrGut: values[7],
			gut: values[9],
			vollbefriedigend: values[11],
			befriedigend: values[13],
			ausreichend: values[15],
		},
		failed: values[17],
		failedWomen: values[19],
		failedFinal: withFinal ? values[21] : null,
	};
}

/**
 * Throws instead of guessing: a silently misread column would end up on the
 * public site as a wrong failure rate.
 */
function validate(year: number, label: string, result: PflichtfachResult) {
	const { grades } = result;
	const gradeSum =
		grades.sehrGut +
		grades.gut +
		grades.vollbefriedigend +
		grades.befriedigend +
		grades.ausreichend;
	if (gradeSum !== result.passed) {
		throw new Error(
			`${year} ${label}: grades sum to ${gradeSum}, but ${result.passed} passed`,
		);
	}
	if (result.passed + result.failed !== result.examined) {
		throw new Error(
			`${year} ${label}: ${result.passed} passed + ${result.failed} failed ≠ ${result.examined} examined`,
		);
	}
}

/**
 * @param pages the text of every PDF page, in order.
 * @returns null when the edition has no Pflichtfachprüfung table (before 2007).
 */
export function parsePflichtfachTable(pages: string[]): PflichtfachYear | null {
	const start = pages.findIndex((page) => TITLE.test(page));
	if (start === -1) return null;
	const year = Number(pages[start].match(TITLE)?.[1]);

	// The column-number header ("1 2 3 … 24") gives the row width: column 1 is
	// the Land, everything after it is a value. 2007–2016 have 21 values, the
	// later editions add "dar. endgültig nicht bestanden" for 23.
	const header = pages[start].match(/^1 2 3 4 5 6 7 8 9 10[ \d]*$/m);
	if (!header) throw new Error(`${year}: column header not found`);
	const width = header[0].trim().split(" ").length - 1;
	const withFinal = width >= 23;

	const rows = new Map<string, PflichtfachResult>();
	let label = "";
	for (const page of pages.slice(start)) {
		for (const line of page.split("\n")) {
			const tokens = line.trim().split(/\s+/);
			const tail = tokens.slice(-width);
			if (tail.length < width || !tail.every((t) => NUMBER.test(t))) {
				label += line;
				continue;
			}
			label += tokens.slice(0, -width).join(" ");
			const key = letters(label);
			const match = LAND_KEYS.find((land) => key.endsWith(land.key));
			label = "";
			if (!match || rows.has(match.name)) continue;
			const values = tail.map((t) => toInt(t.split(",")[0]));
			rows.set(match.name, toResult(values, withFinal));
		}
		if (rows.has("Zusammen")) break;
	}

	const total = rows.get("Zusammen");
	if (!total) throw new Error(`${year}: "Zusammen" row not found`);
	validate(year, "Zusammen", total);

	const laender = {} as Record<Land, PflichtfachResult>;
	for (const land of LAENDER) {
		const result = rows.get(land);
		if (!result) throw new Error(`${year}: row for ${land} not found`);
		validate(year, land, result);
		laender[land] = result;
	}

	const examinedSum = LAENDER.reduce((sum, l) => sum + laender[l].examined, 0);
	if (examinedSum !== total.examined) {
		throw new Error(
			`${year}: Länder sum to ${examinedSum} examined, "Zusammen" says ${total.examined}`,
		);
	}

	return { year, asOf: parseAsOf(pages[start]), laender, total };
}
