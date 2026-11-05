import {
	type ExamSitting,
	type ExamSubject,
	MONTHS,
} from "@/lib/exam-calendar";
import { jpaParam } from "@/lib/seo";

const SUBJECT_LABEL: Record<ExamSubject, string> = {
	ZR: "Zivilrecht (ZR)",
	ÖR: "Öffentliches Recht (ÖR)",
	SR: "Strafrecht (SR)",
};

const MAX_OCTETS = 75;
const encoder = new TextEncoder();

const escapeText = (value: string) =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, String.raw`\;`)
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");

/** Folds at 75 octets without splitting a UTF-8 sequence; continuation lines carry a leading space that counts toward the limit. */
function fold(line: string): string {
	const out: string[] = [];
	let current = "";
	let octets = 0;
	for (const char of line) {
		const size = encoder.encode(char).length;
		const limit = out.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
		if (octets + size > limit) {
			out.push(current);
			current = "";
			octets = 0;
		}
		current += char;
		octets += size;
	}
	out.push(current);
	return out.join("\r\n ");
}

const compactDate = (date: string) => date.replaceAll("-", "");

function nextDay(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function localDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const utcStamp = (date: Date) =>
	date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");

export interface SittingCalendarInput {
	jpaName: string;
	jpaUrl: string;
	sitting: ExamSitting;
	expectedResults: Date;
	now: Date;
}

export function sittingCalendar({
	jpaName,
	jpaUrl,
	sitting,
	expectedResults,
	now,
}: SittingCalendarInput): string {
	const stamp = utcStamp(now);
	const start = sitting.days[0].date;
	const allDay = (uid: string, date: string, props: string[]) => [
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${stamp}`,
		`DTSTART;VALUE=DATE:${compactDate(date)}`,
		`DTEND;VALUE=DATE:${compactDate(nextDay(date))}`,
		...props,
		"END:VEVENT",
	];

	const exams = sitting.days.flatMap((day, index) =>
		allDay(`${compactDate(day.date)}-${index + 1}@examensradar.de`, day.date, [
			`SUMMARY:${escapeText(`Examensklausur ${SUBJECT_LABEL[day.subject]}`)}`,
			`DESCRIPTION:${escapeText(`Staatliche Pflichtfachprüfung, ${jpaName}. Angaben ohne Gewähr.`)}`,
		]),
	);

	const results = allDay(
		`results-${compactDate(start)}-${jpaParam(jpaName)}@examensradar.de`,
		localDate(expectedResults),
		[
			`SUMMARY:${escapeText(`Examensergebnisse voraussichtlich (${jpaName})`)}`,
			`DESCRIPTION:${escapeText(`Voraussichtlicher Termin, ohne Gewähr. Den genauen Zeitpunkt erfährst du per E-Mail von Examensradar: ${jpaUrl}`)}`,
			`URL:${jpaUrl}`,
			"TRANSP:TRANSPARENT",
		],
	);

	const [year, month] = start.split("-").map(Number);
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Examensradar//Klausurtermine//DE",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeText(`Klausuren ${MONTHS[month - 1]} ${year}`)}`,
		...exams,
		...results,
		"END:VCALENDAR",
	];
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
