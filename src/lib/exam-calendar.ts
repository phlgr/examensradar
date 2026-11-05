import { NRW_SITTINGS, NRW_SOURCES } from "@/lib/exam-calendar.data";

export type ExamSubject = "ZR" | "ÖR" | "SR";

export interface ExamDay {
	/** Calendar date in Germany, YYYY-MM-DD. */
	date: string;
	subject: ExamSubject;
}

/** One "Durchgang": 6 exam days in ascending order. */
export interface ExamSitting {
	days: readonly ExamDay[];
}

export type SittingStatus = "anstehend" | "läuft" | "geschrieben";

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

// Keyed by JPA slug. The NRW offices publish identical calendars (the update
// script cross-checks that), so they share one sitting list.
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

/** Month index (year * 12 + month) in which the sitting's results are released. */
export function resultMonthIndex(sitting: ExamSitting): number {
	const [year, month] = parts(sitting.days[0].date);
	return year * 12 + month + RESULT_LAG_MONTHS;
}

export function resultMonthName(sitting: ExamSitting): string {
	return MONTHS[resultMonthIndex(sitting) % 12];
}

/** "23.–31. August 2027" or "22. Februar – 2. März 2027". */
export function formatSittingRange(sitting: ExamSitting): string {
	const [y1, m1, d1] = parts(sitting.days[0].date);
	const [y2, m2, d2] = parts(sitting.days[sitting.days.length - 1].date);
	if (y1 === y2 && m1 === m2) return `${d1}.–${d2}. ${MONTHS[m2]} ${y2}`;
	const start =
		y1 === y2 ? `${d1}. ${MONTHS[m1]}` : `${d1}. ${MONTHS[m1]} ${y1}`;
	return `${start} – ${d2}. ${MONTHS[m2]} ${y2}`;
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
