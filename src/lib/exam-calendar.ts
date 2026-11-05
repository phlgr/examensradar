import { NRW_SITTINGS, NRW_SOURCES } from "@/lib/exam-calendar.data";

export type ExamSubject = "ZR" | "ÖR" | "SR";

export interface ExamDay {
	date: string;
	subject: ExamSubject;
}

export interface ExamSitting {
	days: readonly ExamDay[];
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

export interface ExamCalendar {
	sittings: readonly ExamSitting[];
	pageUrl: string;
	stand: string | null;
}

const CALENDARS: Record<string, ExamCalendar> = {
	hamm: { sittings: NRW_SITTINGS, ...NRW_SOURCES.hamm },
	köln: { sittings: NRW_SITTINGS, ...NRW_SOURCES.köln },
	düsseldorf: { sittings: NRW_SITTINGS, ...NRW_SOURCES.düsseldorf },
};

export function examCalendarFor(slug: string): ExamCalendar | undefined {
	return CALENDARS[slug];
}

function parts(date: string): [year: number, month: number, day: number] {
	const [y, m, d] = date.split("-").map(Number);
	return [y, m - 1, d];
}

export function resultMonthIndex(sitting: ExamSitting): number {
	const [year, month] = parts(sitting.days[0].date);
	return year * 12 + month + RESULT_LAG_MONTHS;
}

export function resultMonthName(sitting: ExamSitting): string {
	return MONTHS[resultMonthIndex(sitting) % 12];
}

/** "23.–31. August 2027" or "22. Februar – 2. März 2027"; without the year when a heading already names it. */
export function formatSittingRange(
	sitting: ExamSitting,
	{ year = true } = {},
): string {
	const [y1, m1, d1] = parts(sitting.days[0].date);
	const [y2, m2, d2] = parts(sitting.days[sitting.days.length - 1].date);
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
	const [year, month] = parts(sitting.days[0].date);
	return year === currentYear ? MONTHS[month] : `${MONTHS[month]} ${year}`;
}

/** "20.–28.08." or, spilling over a month end, "22.02.–02.03.". */
export function formatSittingRangeShort(sitting: ExamSitting): string {
	const [, m1, d1] = parts(sitting.days[0].date);
	const [, m2, d2] = parts(sitting.days[sitting.days.length - 1].date);
	const pad = (n: number) => String(n).padStart(2, "0");
	return m1 === m2
		? `${pad(d1)}.–${pad(d2)}.${pad(m2 + 1)}.`
		: `${pad(d1)}.${pad(m1 + 1)}.–${pad(d2)}.${pad(m2 + 1)}.`;
}

export function monthsBetween(a: ExamSitting, b: ExamSitting): string[] {
	const [y1, m1] = parts(a.days[0].date);
	const [y2, m2] = parts(b.days[0].date);
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
	if (today < sitting.days[0].date) return "anstehend";
	if (today <= sitting.days[sitting.days.length - 1].date) return "läuft";
	return "geschrieben";
}
