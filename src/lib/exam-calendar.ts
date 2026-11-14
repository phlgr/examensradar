import { OFFICE_SOURCES, SITTINGS_BY_LAND } from "@/lib/exam-calendar.data";
import type { Land } from "@/lib/laender";

export type ExamSubject = "ZR" | "ÖR" | "SR";

export interface ExamDay {
	date: string;
	subject?: ExamSubject;
}

export interface ExamSitting {
	/** YYYY-MM-DD; the first exam day when `days` is non-empty. */
	start: string;
	/** YYYY-MM-DD; the last exam day when `days` is non-empty. */
	end: string;
	/** Empty when the office only publishes the range. */
	days: readonly ExamDay[];
	/** Set when the subjects were taken from other Länder's plans for the same dates. */
	subjectsFrom?: readonly Land[];
}

export interface OfficeSource {
	land: Land;
	pageUrl: string;
	stand: string | null;
}

export type SittingStatus = "anstehend" | "läuft" | "geschrieben";

export const SUBJECT_NAME: Record<ExamSubject, string> = {
	ZR: "Zivilrecht",
	ÖR: "Öffentliches Recht",
	SR: "Strafrecht",
};

const RESULT_LAG_MONTHS = 3;

export const MONTHS = [
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

export interface ExamCalendar extends OfficeSource {
	sittings: readonly ExamSitting[];
	/** Other offices of the same Land publish the same dates. */
	shared: boolean;
}

export function examCalendarFor(slug: string): ExamCalendar | undefined {
	const source = OFFICE_SOURCES[slug];
	if (!source) return undefined;
	return {
		...source,
		sittings: SITTINGS_BY_LAND[source.land] ?? [],
		shared: Object.entries(OFFICE_SOURCES).some(
			([other, { land }]) => other !== slug && land === source.land,
		),
	};
}

function parts(date: string): [year: number, month: number, day: number] {
	const [y, m, d] = date.split("-").map(Number);
	return [y, m - 1, d];
}

export function resultMonthIndex(sitting: ExamSitting): number {
	const [year, month] = parts(sitting.start);
	return year * 12 + month + RESULT_LAG_MONTHS;
}

export function sittingEnd(sitting: ExamSitting): Date {
	const [year, month, day] = parts(sitting.end);
	return new Date(year, month, day);
}

export function resultMonthName(sitting: ExamSitting): string {
	return MONTHS[resultMonthIndex(sitting) % 12];
}

/** "23.–31. August 2027" or "22. Februar – 2. März 2027"; without the year when a heading already names it. */
export function formatSittingRange(
	sitting: ExamSitting,
	{ year = true } = {},
): string {
	const [y1, m1, d1] = parts(sitting.start);
	const [y2, m2, d2] = parts(sitting.end);
	const end = year ? ` ${y2}` : "";
	if (y1 === y2 && m1 === m2) return `${d1}.–${d2}. ${MONTHS[m2]}${end}`;
	const start =
		y1 === y2 || !year ? `${d1}. ${MONTHS[m1]}` : `${d1}. ${MONTHS[m1]} ${y1}`;
	return `${start} – ${d2}. ${MONTHS[m2]}${end}`;
}

/** "August", or "August 2027" when the sitting starts outside `currentYear`. */
export function formatSittingMonth(
	sitting: ExamSitting,
	currentYear: number,
): string {
	const [year, month] = parts(sitting.start);
	return year === currentYear ? MONTHS[month] : `${MONTHS[month]} ${year}`;
}

/** "20.–28.08." or, spilling over a month end, "22.02.–02.03.". */
export function formatSittingRangeShort(sitting: ExamSitting): string {
	const [, m1, d1] = parts(sitting.start);
	const [, m2, d2] = parts(sitting.end);
	const pad = (n: number) => String(n).padStart(2, "0");
	return m1 === m2
		? `${pad(d1)}.–${pad(d2)}.${pad(m2 + 1)}.`
		: `${pad(d1)}.${pad(m1 + 1)}.–${pad(d2)}.${pad(m2 + 1)}.`;
}

export function monthsBetween(a: ExamSitting, b: ExamSitting): string[] {
	const [y1, m1] = parts(a.start);
	const [y2, m2] = parts(b.start);
	const gap: string[] = [];
	for (let i = y1 * 12 + m1 + 1; i < y2 * 12 + m2; i++)
		gap.push(MONTHS[i % 12]);
	return gap;
}

/** "Do 19.11." for an exam day (YYYY-MM-DD). */
export function formatExamDay(date: string): string {
	const [year, month, day] = parts(date);
	const weekday = new Date(year, month, day)
		.toLocaleDateString("de-DE", { weekday: "short" })
		.replace(".", "");
	return `${weekday} ${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}.`;
}

export function localIsoDate(date: Date): string {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
}

/** "11. Juni 2026" for a full date, "Juni 2026" for a month-only stamp. */
export function formatStand(stand: string): string {
	const [year, month, day] = stand.split("-").map(Number);
	return day
		? `${day}. ${MONTHS[month - 1]} ${year}`
		: `${MONTHS[month - 1]} ${year}`;
}

export function sittingStatus(
	sitting: ExamSitting,
	today: string,
): SittingStatus {
	if (today < sitting.start) return "anstehend";
	if (today <= sitting.end) return "läuft";
	return "geschrieben";
}
