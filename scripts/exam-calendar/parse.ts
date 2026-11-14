import {
	type ExamDay,
	type ExamSitting,
	type ExamSubject,
	MONTHS,
} from "@/lib/exam-calendar";
import { LAENDER, type Land } from "@/lib/laender";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MIN_DAYS = 5;
const MAX_DAYS = 8;
const MAX_SPAN_DAYS = 16;
const MAX_GAP_DAYS = 14;

const SP = "[ \\t]*";
const WD = "(?<!\\p{L})(?:Mo|Di|Mi|Do|Fr|Sa|So)[a-z]*\\.?,?";
const NUMERIC_DATE = "\\d{2}\\.\\d{2}\\.(?:\\d{4}|\\d{2})";
const MONTH = MONTHS.join("|");
const TEXT_DATE = `\\d{1,2}\\.${SP}(?:${MONTH})${SP}\\d{4}`;

const WEEKDAY = "(?<!\\p{L})(?<weekday>Mo|Di|Mi|Do|Fr|Sa|So)[a-z]*\\.?,?";
const DATE = "(?<day>\\d{2})\\.(?<month>\\d{2})\\.(?<year>\\d{4}|\\d{2})";
const MONTH_YEAR = `(?<monthName>${MONTH})${SP}(?<year>\\d{4})`;
const SUBJECT = "(?<subject>ZR|ÖR|SR)";

const ANY_DATE = `(${NUMERIC_DATE}|${TEXT_DATE})`;
const DATE_AFTER_WEEKDAY = `${WD}${SP}${ANY_DATE}`;
const DATE_BEFORE_SUBJECT = `${ANY_DATE}${SP}(?:ZR|ÖR|SR)`;
const EXAM_DATE = new RegExp(
	`${DATE_AFTER_WEEKDAY}|${DATE_BEFORE_SUBJECT}`,
	"gdu",
);

interface Layout {
	pattern: RegExp;
	repeatedItem?: RegExp;
}

const layout = (pattern: string, repeatedItem?: string): Layout => ({
	pattern: new RegExp(pattern, "gu"),
	repeatedItem: repeatedItem ? new RegExp(repeatedItem, "gu") : undefined,
});

const LAYOUTS: Layout[] = [
	// "Do 21.01.27 SR"
	layout(`${WEEKDAY}${SP}${DATE}[ \\t]+${SUBJECT}`),
	// "SR Donnerstag, 21.01.2027"
	layout(`${SUBJECT}[ \\t]+${WEEKDAY}${SP}${DATE}`),
	// "21.01.2027 SR"
	layout(`${DATE}[ \\t]+${SUBJECT}`),
	// "Dienstag 20.04.2027 S I S I"; the EuR exam is only for European Law School candidates
	layout(
		`${WEEKDAY}${SP}${DATE}[ \\t]+(?:(?<skip>EuR)|(?<subject>Z|S|ÖR)[ \\t]+I{1,3})`,
	),
	// "23. (ZR1), 26. (ZR2), 27. (ZR3) Januar 2026"
	layout(
		`(?:\\d{1,2}\\.${SP}\\((?:ZR|ÖR|SR)\\d?\\),?${SP})+${MONTH_YEAR}`,
		`(?<day>\\d{1,2})\\.${SP}\\((?<subject>ZR|ÖR|SR)\\d?\\)`,
	),
	// "Di. 19., Do. 21. und Fr. 22. Januar 2027"
	layout(
		`(?:${WD}${SP}\\d{1,2}\\.(?:,|[ \\t]+und)?${SP})+${MONTH_YEAR}`,
		`${WEEKDAY}${SP}(?<day>\\d{1,2})\\.`,
	),
	// "Montag22.02.2027"
	layout(`${WEEKDAY}${SP}${DATE}`),
	// "Mo, 22. Februar 2027"
	layout(`${WEEKDAY}${SP}(?<day>\\d{1,2})\\.${SP}${MONTH_YEAR}`),
	// "03. März bis 11. März 2027", "29. August mit 5. September 2029"
	layout(
		`(?<startDay>\\d{1,2})\\.${SP}(?:(?<startMonthName>${MONTH})${SP})?(?:bis|mit)[ \\t]+(?<day>\\d{1,2})\\.${SP}${MONTH_YEAR}`,
	),
];

const SUBJECTS: Record<string, ExamSubject> = {
	ZR: "ZR",
	ÖR: "ÖR",
	SR: "SR",
	Z: "ZR",
	S: "SR",
};

type Groups = Partial<
	Record<
		| "weekday"
		| "day"
		| "month"
		| "monthName"
		| "year"
		| "subject"
		| "skip"
		| "startDay"
		| "startMonthName",
		string
	>
>;

type Item =
	| { kind: "day"; date: string; subject?: ExamSubject; weekday?: string }
	| { kind: "range"; start: string; end: string };

function isoDate(day: string, month: number, year: string): string {
	const full = year.length === 2 ? 2000 + Number(year) : Number(year);
	const date = new Date(Date.UTC(full, month - 1, Number(day)));
	if (date.getUTCDate() !== Number(day))
		throw new Error(`no such date: ${day}.${month}.${year}`);
	return date.toISOString().slice(0, 10);
}

const monthNumber = (name: string) => MONTHS.indexOf(name) + 1;

function readItem(g: Groups): Item | null {
	if (g.skip) return null;
	if (!g.day || !g.year) throw new Error("layout without day or year");
	const month = g.month ? Number(g.month) : monthNumber(g.monthName ?? "");
	const date = isoDate(g.day, month, g.year);
	if (g.startDay) {
		const startMonth = g.startMonthName ? monthNumber(g.startMonthName) : month;
		return {
			kind: "range",
			start: isoDate(g.startDay, startMonth, g.year),
			end: date,
		};
	}
	return {
		kind: "day",
		date,
		subject: g.subject ? SUBJECTS[g.subject] : undefined,
		weekday: g.weekday,
	};
}

function readLayout(text: string, { pattern, repeatedItem }: Layout) {
	const hits = [...text.matchAll(pattern)];
	const items = hits.flatMap((hit) => {
		const outer = hit.groups ?? {};
		const inner = repeatedItem
			? [...hit[0].matchAll(repeatedItem)].map((m) => m.groups)
			: [{}];
		return inner.flatMap((groups) => readItem({ ...outer, ...groups }) ?? []);
	});
	return { hits, items };
}

function coversEveryExamDate(text: string, hits: RegExpMatchArray[]) {
	const spans = hits.map((hit) => [
		hit.index ?? 0,
		(hit.index ?? 0) + hit[0].length,
	]);
	return [...text.matchAll(EXAM_DATE)].every((match) => {
		const [start, end] = match.indices?.[1] ?? match.indices?.[2] ?? [0, 0];
		return spans.some(([from, to]) => from <= start && end <= to);
	});
}

const dayNumber = (date: string) =>
	Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const weekdayOf = (date: string) =>
	WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
const isWeekend = (date: string) => ["Sa", "So"].includes(weekdayOf(date));

function checkSitting(sitting: ExamSitting, named: Map<string, string>) {
	const where = `sitting ${sitting.start}`;
	const span = dayNumber(sitting.end) - dayNumber(sitting.start);
	if (span < 0 || span > MAX_SPAN_DAYS)
		throw new Error(`${where} ends ${sitting.end}`);
	for (const date of [
		sitting.start,
		sitting.end,
		...sitting.days.map((d) => d.date),
	]) {
		if (isWeekend(date)) throw new Error(`${where}: ${date} is a weekend`);
		const weekday = named.get(date);
		if (weekday && weekday !== weekdayOf(date))
			throw new Error(`${where}: ${date} is not a ${weekday}`);
	}
	if (sitting.days.length === 0) return;
	if (sitting.days.length < MIN_DAYS || sitting.days.length > MAX_DAYS)
		throw new Error(`${where} has ${sitting.days.length} exam days`);
	if (sitting.days.some((d) => d.subject)) {
		for (const subject of ["ZR", "ÖR", "SR"] as const)
			if (!sitting.days.some((d) => d.subject === subject))
				throw new Error(`${where} has no ${subject} exam`);
	}
}

const monthOf = (date: string) => date.slice(0, 7);

function groupDays(days: ExamDay[]): ExamDay[][] {
	const runs: ExamDay[][] = [];
	for (const day of days) {
		const run = runs.at(-1);
		const last = run?.at(-1);
		if (
			run &&
			last &&
			dayNumber(day.date) - dayNumber(last.date) <= MAX_GAP_DAYS
		)
			run.push(day);
		else runs.push([day]);
	}
	return runs.flatMap((run) => {
		const span = dayNumber(run.at(-1)?.date ?? "") - dayNumber(run[0].date);
		if (run.length <= MAX_DAYS && span <= MAX_SPAN_DAYS) return [run];
		const byMonth = new Map<string, ExamDay[]>();
		for (const day of run)
			byMonth.set(monthOf(day.date), [
				...(byMonth.get(monthOf(day.date)) ?? []),
				day,
			]);
		return [...byMonth.values()];
	});
}

function chooseLayout(text: string) {
	for (const layout of LAYOUTS) {
		const read = readLayout(text, layout);
		if (read.items.length > 0 && coversEveryExamDate(text, read.hits))
			return read;
	}
	throw new Error("no layout covers every exam date");
}

export function parseSittings(text: string): ExamSitting[] {
	const chosen = chooseLayout(text);
	const named = new Map<string, string>();
	const days: ExamDay[] = [];
	const sittings: ExamSitting[] = [];
	for (const item of chosen.items) {
		if (item.kind === "range") {
			sittings.push({ start: item.start, end: item.end, days: [] });
			continue;
		}
		if (days.some((d) => d.date === item.date))
			throw new Error(`${item.date} is listed twice`);
		if (item.weekday) named.set(item.date, item.weekday);
		days.push(
			item.subject
				? { date: item.date, subject: item.subject }
				: { date: item.date },
		);
	}
	days.sort((a, b) => a.date.localeCompare(b.date));
	for (const group of groupDays(days)) {
		sittings.push({
			start: group[0].date,
			end: group[group.length - 1].date,
			days: group,
		});
	}
	sittings.sort((a, b) => a.start.localeCompare(b.start));
	for (const sitting of sittings) checkSitting(sitting, named);
	return sittings;
}

/** unpdf returns some PDFs letter-spaced ("M o , 2 2 . F e b r u a r"). */
export function collapseLetterSpacing(text: string): string {
	return text
		.split("\n")
		.map((line) => (/^(\S )+\S$/.test(line) ? line.replaceAll(" ", "") : line))
		.join("\n");
}

export function cutSection(
	text: string,
	[from, to]: readonly [RegExp, RegExp],
) {
	const start = text.search(from);
	if (start < 0) throw new Error(`section start ${from} not found`);
	const rest = text.slice(start);
	const end = rest.search(to);
	return end < 0 ? rest : rest.slice(0, end);
}

export function parseStand(text: string): string | null {
	const stamps = [
		...[
			...text.matchAll(
				/(?:Stand|Aktualisierung):?\s*(\d{2})\.(\d{2})\.(\d{4})/g,
			),
		].map(([, day, month, year]) => `${year}-${month}-${day}`),
		...[...text.matchAll(/Stand:?\s+([A-ZÄÖÜ][a-zäöü]+)\s+(\d{4})/g)]
			.filter(([, month]) => MONTHS.includes(month))
			.map(
				([, month, year]) =>
					`${year}-${String(monthNumber(month)).padStart(2, "0")}`,
			),
	];
	return stamps.sort().at(-1) ?? null;
}

export interface ParsedDocument {
	url: string;
	year: number | null;
	result: { sittings: ExamSitting[] } | { error: string };
}

export interface ParsedOffice {
	slug: string;
	land: Land;
	documents: ParsedDocument[];
}

export function mergeLand(
	offices: readonly ParsedOffice[],
	previous: readonly ExamSitting[] = [],
): { sittings: ExamSitting[]; warnings: string[] } {
	const warnings: string[] = [];
	const byStart = new Map<string, { slug: string; sitting: ExamSitting }>();
	for (const { slug, documents } of offices) {
		for (const { url, year, result } of documents) {
			if ("error" in result) {
				const coveredBy = offices.find(
					(other) =>
						other.slug !== slug &&
						other.documents.some(
							(doc) =>
								"sittings" in doc.result &&
								doc.result.sittings.some((s) => s.start.startsWith(`${year}-`)),
						),
				);
				const message = `${slug}: ${url}: ${result.error}`;
				if (year === null || !coveredBy) throw new Error(message);
				warnings.push(`${message} (${year} covered by ${coveredBy.slug})`);
				continue;
			}
			for (const sitting of result.sittings) {
				const seen = byStart.get(sitting.start);
				if (seen && JSON.stringify(seen.sitting) !== JSON.stringify(sitting))
					throw new Error(
						`sitting ${sitting.start}: ${seen.slug} and ${slug} disagree`,
					);
				byStart.set(sitting.start, seen ?? { slug, sitting });
			}
		}
	}
	const fresh = [...byStart.values()]
		.map(({ sitting }) => sitting)
		.sort((a, b) => a.start.localeCompare(b.start));
	for (const [a, b] of fresh.slice(1).map((s, i) => [fresh[i], s]))
		if (b.start <= a.end)
			throw new Error(`sittings ${a.start} and ${b.start} overlap`);
	const first = fresh[0]?.start;
	const kept = previous.filter((s) => first !== undefined && s.end < first);
	return { sittings: [...kept, ...fresh], warnings };
}

const hasStatedSubjects = (s: ExamSitting) =>
	!s.subjectsFrom && s.days.length > 0 && s.days.every((d) => d.subject);

export function inferSubjects(
	byLand: Partial<Record<Land, readonly ExamSitting[]>>,
): Partial<Record<Land, ExamSitting[]>> {
	const lands = LAENDER.filter((land) => byLand[land]);
	const result: Partial<Record<Land, ExamSitting[]>> = {};
	for (const land of lands) {
		result[land] = (byLand[land] ?? []).map((sitting) => {
			if (sitting.days.length === 0 || sitting.days.some((d) => d.subject))
				return sitting;
			const dates = new Set(sitting.days.map((d) => d.date));
			const subjects = new Map<string, ExamSubject>();
			const from = new Set<Land>();
			for (const other of lands) {
				if (other === land) continue;
				for (const source of byLand[other] ?? []) {
					if (!hasStatedSubjects(source)) continue;
					if (!source.days.every((d) => dates.has(d.date))) continue;
					from.add(other);
					for (const { date, subject } of source.days) {
						if (!subject) continue;
						const seen = subjects.get(date);
						if (seen && seen !== subject)
							throw new Error(
								`${land} ${date}: ${[...from].join(", ")} disagree on the subject`,
							);
						subjects.set(date, subject);
					}
				}
			}
			if (from.size === 0) return sitting;
			return {
				...sitting,
				days: sitting.days.map((day) => {
					const subject = subjects.get(day.date);
					return subject ? { ...day, subject } : day;
				}),
				subjectsFrom: [...from].sort((a, b) => a.localeCompare(b, "de")),
			};
		});
	}
	return result;
}
