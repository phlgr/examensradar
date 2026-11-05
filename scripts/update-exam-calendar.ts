import { load } from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";
import {
	type ExamDay,
	type ExamSitting,
	type ExamSubject,
	MONTHS,
} from "@/lib/exam-calendar";

const OUTPUT = "./src/lib/exam-calendar.data.ts";
const USER_AGENT = "Mozilla/5.0";
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const OFFICES = {
	hamm: {
		pageUrl:
			"https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/02_staatl_pflichtfachpruefung/04_termine/01_aufsichtsarbeiten-schriftlich/",
		linkText: /Jahresübersicht\s+(\d{4})/,
	},
	köln: {
		pageUrl:
			"https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/003_staatl-pflichtfachpruefung/003_aufsichtsarbeiten/002_terminuebersicht_2026/",
		linkText: /Klausurtermine\s+(\d{4})/,
	},
	düsseldorf: {
		pageUrl:
			"https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06jpa-a-z/06aufsichtsarbeiten/",
		linkText: /Klausurtermine\s+(\d{4})/,
	},
};

const DATE = String.raw`(\d{2})\.(\d{2})\.(\d{4}|\d{2})`;
const SUBJECT = "(ZR|ÖR|SR)";
const WEEKDAY = "(Mo|Di|Mi|Do|Fr|Sa)[a-z]*,?";

// Group indices: weekday, day, month, year, subject.
const LAYOUTS: { re: RegExp; groups: number[] }[] = [
	// Hamm: "Do 21.01.27 SR"
	{ re: new RegExp(`${WEEKDAY} ${DATE} ${SUBJECT}`, "g"), groups: [1, 2, 3, 4, 5] },
	// Köln: "SR Donnerstag, 21.01.2027"
	{ re: new RegExp(`${SUBJECT} ${WEEKDAY} ${DATE}`, "g"), groups: [2, 3, 4, 5, 1] },
	// Düsseldorf: "21.01.2027 SR"
	{ re: new RegExp(`${DATE} ${SUBJECT}`, "g"), groups: [0, 1, 2, 3, 4] },
];

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

function parseSittings(url: string, text: string) {
	// "Stand: 11.06.2026" (Düsseldorf) or "Stand Juni 2026" (Hamm), stored as
	// YYYY-MM-DD or YYYY-MM so the newest one wins a string comparison.
	const standDate = text.match(new RegExp(`Stand:? ${DATE}`));
	const standMonth = text.match(/Stand:? ([A-ZÄÖÜ][a-zäöü]+) (\d{4})/);
	const monthIndex = standMonth ? MONTHS.indexOf(standMonth[1]) : -1;
	const stand = standDate
		? `${standDate[3].length === 2 ? `20${standDate[3]}` : standDate[3]}-${standDate[2]}-${standDate[1]}`
		: standMonth && monthIndex >= 0
			? `${standMonth[2]}-${String(monthIndex + 1).padStart(2, "0")}`
			: null;

	// A layout only counts if it accounts for every date in the PDF; otherwise
	// the Hamm pattern happily pairs Köln's dates with the next row's subject.
	const totalDates = [
		...text.replace(new RegExp(`Stand:? ${DATE}`, "g"), "").matchAll(new RegExp(DATE, "g")),
	].length;

	for (const { re, groups } of LAYOUTS) {
		const hits = [...text.matchAll(re)];
		if (hits.length === 0 || hits.length !== totalDates) continue;
		const [weekday, day, month, year, subject] = groups;
		const days: ExamDay[] = hits
			.map((hit) => {
				const fullYear = hit[year].length === 2 ? 2000 + +hit[year] : +hit[year];
				const date = new Date(Date.UTC(fullYear, +hit[month] - 1, +hit[day]));
				const dow = date.getUTCDay();
				if (weekday && WEEKDAYS[dow] !== hit[weekday])
					throw new Error(`${url}: weekday mismatch in "${hit[0]}"`);
				if (!weekday && (dow === 0 || dow === 6))
					throw new Error(`${url}: exam on a weekend in "${hit[0]}"`);
				return {
					date: date.toISOString().slice(0, 10),
					subject: hit[subject] as ExamSubject,
				};
			})
			.sort((a, b) => a.date.localeCompare(b.date));
		if (days.length % 6 !== 0)
			throw new Error(`${url}: ${days.length} exam days, not a multiple of 6`);

		const sittings: ExamSitting[] = [];
		for (let i = 0; i < days.length; i += 6) {
			const group = days.slice(i, i + 6);
			const count = (s: ExamSubject) => group.filter((d) => d.subject === s).length;
			if (count("ZR") !== 3 || count("ÖR") !== 2 || count("SR") !== 1)
				throw new Error(`${url}: unexpected subject mix at ${group[0].date}`);
			sittings.push({ days: group });
		}
		return { sittings, stand };
	}
	throw new Error(`${url}: no exam dates found in any known layout`);
}

async function loadOffice(
	key: string,
	{ pageUrl, linkText }: (typeof OFFICES)[keyof typeof OFFICES],
) {
	const html = new TextDecoder().decode(await fetchBytes(pageUrl));
	const $ = load(html);
	const pdfs = new Map<number, string>();
	$("a[href]").each((_, a) => {
		const match = $(a).text().match(linkText);
		const href = $(a).attr("href");
		if (match && href) pdfs.set(+match[1], new URL(href, pageUrl).href);
	});
	if (pdfs.size === 0) throw new Error(`${key}: no calendar PDF links on ${pageUrl}`);

	const byYear = new Map<number, ExamSitting[]>();
	let stand: string | null = null;
	for (const [year, url] of pdfs) {
		const pdf = await getDocumentProxy(await fetchBytes(url));
		const { text } = await extractText(pdf, { mergePages: true });
		const parsed = parseSittings(url, text);
		if (parsed.sittings.some((s) => !s.days[0].date.startsWith(`${year}-`)))
			throw new Error(`${url}: sittings outside ${year}`);
		byYear.set(year, parsed.sittings);
		if (parsed.stand && (!stand || parsed.stand > stand)) stand = parsed.stand;
		console.log(`${key} ${year}: ${parsed.sittings.length} sittings (${url})`);
	}
	return { pageUrl, stand, byYear };
}

const offices = new Map<string, Awaited<ReturnType<typeof loadOffice>>>();
for (const [key, office] of Object.entries(OFFICES)) {
	offices.set(key, await loadOffice(key, office));
}

const merged = new Map<number, { office: string; sittings: ExamSitting[] }>();
for (const [key, { byYear }] of offices) {
	for (const [year, sittings] of byYear) {
		const seen = merged.get(year);
		if (seen && JSON.stringify(seen.sittings) !== JSON.stringify(sittings)) {
			console.error(`Calendar mismatch for ${year}: ${seen.office} differs from ${key}`);
			process.exit(1);
		}
		if (!seen) merged.set(year, { office: key, sittings });
	}
}

const years = [...merged.keys()].sort((a, b) => a - b);
const sittings = years.flatMap((year) => merged.get(year)?.sittings ?? []);
const sources = Object.fromEntries(
	[...offices].map(([key, { pageUrl, stand }]) => [key, { pageUrl, stand }]),
);

await Bun.write(
	OUTPUT,
	`// Generated by scripts/update-exam-calendar.ts (bun run calendar:update). Do not edit.
import type { ExamSitting } from "@/lib/exam-calendar";

export const NRW_SITTINGS: readonly ExamSitting[] = ${JSON.stringify(sittings)};

export const NRW_SOURCES = ${JSON.stringify(sources)} as const;
`,
);
const format = Bun.spawnSync(["bunx", "biome", "format", "--write", OUTPUT]);
if (format.exitCode !== 0) throw new Error(format.stderr.toString());

console.log(
	`Wrote ${sittings.length} sittings: ${years.map((y) => `${y}=${merged.get(y)?.sittings.length}`).join(" ")}`,
);
