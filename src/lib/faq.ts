import { formatSittingRange, resultMonthName } from "@/lib/exam-calendar";
import {
	CONFIDENCE_LABEL,
	type JpaReleaseSummary,
	monthPositionLabel,
	type TimelineEntry,
} from "@/lib/release-summary";
import { type Faq, formatLongDate } from "@/lib/seo";

function listNames(names: string[]): string {
	if (names.length <= 1) return names.join("");
	return `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`;
}

function predictionPhrase(summary: JpaReleaseSummary): string | null {
	const { prediction } = summary;
	if (!prediction) return null;
	const sameDay =
		prediction.windowStart.getTime() === prediction.windowEnd.getTime();
	const window = sameDay
		? ""
		: ` (Zeitfenster ${formatLongDate(prediction.windowStart)} bis ${formatLongDate(prediction.windowEnd)})`;
	return `am ${formatLongDate(prediction.date)}${window}`;
}

export function nextReleaseSentence(summary: JpaReleaseSummary): string {
	const next = predictionPhrase(summary);
	if (!next) {
		return `${summary.name} hat zuletzt am ${formatLongDate(summary.lastRelease)} Ergebnisse veröffentlicht; für eine Prognose fehlen noch Daten.`;
	}
	return `Die nächsten Ergebnisse beim ${summary.name} erwarten wir ${next}, zuletzt veröffentlicht am ${formatLongDate(summary.lastRelease)}.`;
}

export function landingFaqs(
	jpaNames: string[],
	summaries: JpaReleaseSummary[],
): Faq[] {
	const byDate = new Map<string, string[]>();
	for (const s of summaries) {
		if (!s.prediction) continue;
		const date = formatLongDate(s.prediction.date);
		byDate.set(date, [...(byDate.get(date) ?? []), s.name]);
	}
	const upcoming = [...byDate].map(
		([date, names]) => `${listNames(names)} am ${date}`,
	);

	return [
		{
			question: "Wann kommen die Ergebnisse im ersten Staatsexamen?",
			answer: `Das hängt vom Justizprüfungsamt ab. Die Prüfungsämter in NRW veröffentlichen die Ergebnisse fast immer am letzten Werktag eines Monats.${upcoming.length > 0 ? ` Als Nächstes erwarten wir ${listNames(upcoming)}.` : ""}`,
		},
		{
			question:
				"Wie werde ich benachrichtigt, wenn meine Examensergebnisse online sind?",
			answer:
				"Mit Examensradar: Justizprüfungsamt auswählen, E-Mail-Adresse eingeben, fertig. Wir prüfen die Ergebnisseite alle paar Minuten und schicken dir eine E-Mail, sobald dort neue Ergebnisse stehen. Kostenlos, ohne Konto, jederzeit abbestellbar.",
			signupCta: "Jetzt Benachrichtigung einrichten",
		},
		{
			question: "Für welche Justizprüfungsämter gibt es Benachrichtigungen?",
			answer: `Aktuell für die Justizprüfungsämter ${listNames(jpaNames)}. Weitere Prüfungsämter kommen nach und nach dazu.`,
		},
		{
			question: "Gilt das auch für das zweite Staatsexamen?",
			answer:
				"Nein. Examensradar deckt nur das erste Examen (die staatliche Pflichtfachprüfung) ab. Im zweiten Staatsexamen bekommst du deine Ergebnisse direkt vom Prüfungsamt.",
		},
	];
}

export const historyFaqs: Faq[] = [
	{
		question: "Wie genau ist die Prognose für den nächsten Termin?",
		answer:
			"Wir rechnen aus allen bisher erfassten Veröffentlichungen eines Amts hoch, in welchem Abstand und an welcher Stelle im Monat es veröffentlicht. Je mehr Termine vorliegen, desto sicherer die Prognose. Verbindlich ist nur, was das Prüfungsamt selbst veröffentlicht; genau dafür gibt es die E-Mail.",
	},
	{
		question: "Ist Examensradar ein Angebot der Justiz?",
		answer:
			"Nein. Examensradar ist ein unabhängiges Projekt und nicht mit den Justizprüfungsämtern verbunden. Wir lesen nur die öffentlichen Ergebnisseiten der Ämter mit und verlinken immer auf die offizielle Quelle.",
	},
];

export const extraFaqs: Faq[] = [
	{
		question: "Kostet Examensradar etwas? Brauche ich ein Konto?",
		answer:
			"Nein. Examensradar ist kostenlos, ohne App und ohne Konto. Du bestätigst nur einmal deine E-Mail-Adresse und kannst die Benachrichtigung über den Link in jeder E-Mail jederzeit abbestellen.",
	},
];

export function resultsPhrase({ sitting, results }: TimelineEntry): string {
	return results.kind === "expected" && !results.exact
		? `Ende ${resultMonthName(sitting)}`
		: `am ${formatLongDate(results.date)}`;
}

export function jpaFaqs(
	name: string,
	summary: JpaReleaseSummary | undefined,
	entries: TimelineEntry[] = [],
) {
	const faqs: Faq[] = [];
	const prediction = summary?.prediction;

	if (summary) {
		const pattern = prediction
			? `in der Regel ${monthPositionLabel(prediction.medianOffsetDays)}, meist gegen ${summary.typicalHour} Uhr`
			: `zuletzt am ${formatLongDate(summary.lastRelease)}`;
		faqs.push({
			question: `Wann kommen die Examensergebnisse beim ${name}?`,
			answer: `Das Justizprüfungsamt beim ${name} veröffentlicht die Ergebnisse im ersten Examen ${pattern}. ${nextReleaseSentence(summary)}${prediction ? ` Die Prognose ist ${CONFIDENCE_LABEL[prediction.confidence]}.` : ""}`,
		});
		faqs.push({
			question: `Wann hat das ${name} zuletzt Ergebnisse veröffentlicht?`,
			answer: `Am ${summary.lastRelease.toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })} Uhr. Insgesamt haben wir ${summary.releaseCount} ${summary.releaseCount === 1 ? "Veröffentlichung" : "Veröffentlichungen"} erfasst.`,
		});
	} else {
		faqs.push({
			question: `Wann kommen die Examensergebnisse beim ${name}?`,
			answer: `Für das ${name} haben wir noch keine Veröffentlichung erfasst. Sobald dort neue Ergebnisse erscheinen, bekommen alle Angemeldeten eine E-Mail.`,
		});
	}

	const nextExams = entries.filter(
		(entry) => entry.phase === "läuft" || entry.phase === "anstehend",
	);
	if (nextExams.length > 0) {
		const list = nextExams
			.slice(0, 3)
			.map(
				(entry) =>
					`${formatSittingRange(entry.sitting)} (Ergebnisse voraussichtlich ${resultsPhrase(entry)})`,
			);
		faqs.push({
			question: `Wann sind die nächsten Examensklausuren beim ${name}?`,
			answer: `Die nächsten Klausurtermine der staatlichen Pflichtfachprüfung beim ${name} sind ${listNames(list)}. Jeder Durchgang besteht aus sechs Klausuren: drei im Zivilrecht, zwei im Öffentlichen Recht und eine im Strafrecht. Die Ergebnisse folgen in der Regel etwa drei Monate nach Beginn des Durchgangs. Angaben ohne Gewähr.`,
		});
	}

	faqs.push({
		question: `Wie erfahre ich sofort, wenn das ${name} Ergebnisse veröffentlicht?`,
		answer: `Melde dich bei Examensradar für das ${name} an. Wir prüfen die Ergebnisseite alle paar Minuten und schicken dir eine E-Mail, sobald dort etwas Neues steht. Kostenlos, ohne Konto, jederzeit abbestellbar.`,
		signupCta: `Für das ${name} anmelden`,
	});

	return faqs;
}

export interface OfficePageMeta {
	title: string;
	h1: string;
	description: string;
}

export function officePageMeta(
	name: string,
	summary: JpaReleaseSummary | undefined,
	entries: TimelineEntry[] = [],
): OfficePageMeta {
	const open = entries.find(
		(e) => e.phase === "läuft" || e.phase === "anstehend",
	);
	const prediction = summary?.prediction;
	const range = open ? formatSittingRange(open.sitting) : null;
	const dates = [
		prediction &&
			`Nächste Ergebnisse voraussichtlich am ${formatLongDate(prediction.date)}`,
		range && `nächste Klausuren ${range}`,
	].filter(Boolean);

	const description =
		dates.length > 0
			? `${name}: ${dates.join(", ")}. Kostenlose E-Mail, sobald sie online sind.`
			: `${prediction ? `Nächster Termin voraussichtlich am ${formatLongDate(prediction.date)}. ` : ""}Alle bisherigen Veröffentlichungen des Justizprüfungsamts beim ${name} im ersten Staatsexamen – und eine kostenlose E-Mail, sobald neue Ergebnisse online sind.`;

	const base = `${name}: Termine & Ergebnisse 1. Examen`;
	const title = `${base} | Examensradar`;

	return {
		title: title.length > 60 ? base : title,
		h1: `${name}: Klausurtermine und Ergebnisse im 1. Examen`,
		description,
	};
}
