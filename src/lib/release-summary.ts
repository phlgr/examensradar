import {
	type ExamCalendar,
	type ExamSitting,
	examCalendarFor,
	localIsoDate,
	sittingStatus,
} from "@/lib/exam-calendar";
import {
	clusterReleases,
	expectedReleaseDate,
	medianReleaseOffset,
	type PredictionConfidence,
	pendingSittings,
	predictNextRelease,
	type ReleasePrediction,
	releaseForSitting,
} from "@/lib/prediction";

export interface HistoryEntry {
	sentAt: Date | string | null;
	jpaName: string | null;
	jpaSlug: string | null;
	jpaWebsiteUrl: string | null;
}

export interface JpaReleaseSummary {
	slug: string;
	name: string;
	websiteUrl: string | null;
	dates: Date[];
	lastRelease: Date;
	releaseCount: number;
	typicalHour: number;
	prediction: ReleasePrediction | null;
	daysUntil: number | null;
}

const MS_PER_DAY = 86_400_000;

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
		: sorted[mid];
}

export function summarizeReleases(
	entries: HistoryEntry[],
	now: Date,
): JpaReleaseSummary[] {
	const groups = new Map<
		string,
		{ name: string; websiteUrl: string | null; dates: Date[] }
	>();
	for (const entry of entries) {
		if (!entry.jpaSlug || !entry.jpaName || !entry.sentAt) continue;
		const group = groups.get(entry.jpaSlug) ?? {
			name: entry.jpaName,
			websiteUrl: entry.jpaWebsiteUrl,
			dates: [],
		};
		group.dates.push(new Date(entry.sentAt));
		groups.set(entry.jpaSlug, group);
	}

	const summaries: JpaReleaseSummary[] = [];
	for (const [slug, group] of groups) {
		const dates = [...group.dates].sort((a, b) => b.getTime() - a.getTime());
		const prediction = predictNextRelease(
			dates,
			now,
			examCalendarFor(slug)?.sittings,
		);
		summaries.push({
			slug,
			name: group.name,
			websiteUrl: group.websiteUrl,
			dates,
			lastRelease: dates[0],
			releaseCount: clusterReleases(dates).length,
			typicalHour: median(dates.map((d) => d.getHours())),
			prediction,
			daysUntil: prediction
				? Math.ceil((prediction.date.getTime() - now.getTime()) / MS_PER_DAY)
				: null,
		});
	}

	return summaries.sort((a, b) => {
		if (a.daysUntil === null && b.daysUntil === null) {
			return b.lastRelease.getTime() - a.lastRelease.getTime();
		}
		if (a.daysUntil === null) return 1;
		if (b.daysUntil === null) return -1;
		return a.daysUntil - b.daysUntil;
	});
}

const MAX_UPCOMING_SITTINGS = 6;

const RECENT_RELEASE_DAYS = 7;

type SittingPhase = "veröffentlicht" | "ausstehend" | "läuft" | "anstehend";

type SittingResults =
	| { kind: "released"; date: Date }
	| { kind: "expected"; date: Date; exact: boolean };

export interface TimelineEntry {
	sitting: ExamSitting;
	phase: SittingPhase;
	results: SittingResults;
}

export interface ExamTimeline {
	calendar: ExamCalendar;
	entries: TimelineEntry[];
}

export function examTimeline(
	slug: string,
	releaseDates: Date[],
	now: Date,
): ExamTimeline | null {
	const calendar = examCalendarFor(slug);
	if (!calendar) return null;
	const offset = medianReleaseOffset(releaseDates);
	const today = localIsoDate(now);
	const entries: TimelineEntry[] = [];

	for (const sitting of calendar.sittings) {
		const date = releaseForSitting(sitting, releaseDates);
		if (date) entries[0] = releasedEntry(sitting, date);
	}

	let upcoming = 0;
	for (const sitting of pendingSittings(calendar.sittings, now, releaseDates)) {
		const status = sittingStatus(sitting, today);
		if (status === "anstehend" && upcoming++ >= MAX_UPCOMING_SITTINGS) break;
		entries.push({
			sitting,
			phase: status === "geschrieben" ? "ausstehend" : status,
			results: {
				kind: "expected",
				date: expectedReleaseDate(sitting, offset),
				exact: releaseDates.length > 0,
			},
		});
	}
	return { calendar, entries };
}

function releasedEntry(sitting: ExamSitting, date: Date): TimelineEntry {
	return {
		sitting,
		phase: "veröffentlicht",
		results: { kind: "released", date },
	};
}

export type ReleaseCard =
	| { kind: "sitting"; entry: TimelineEntry }
	| { kind: "release"; date: Date };

export function olderReleases(
	slug: string,
	releaseDates: Date[],
	shown: TimelineEntry[],
): ReleaseCard[] {
	const sittings = examCalendarFor(slug)?.sittings ?? [];
	const shownTimes = new Set(
		shown.flatMap((e) =>
			e.results.kind === "released" ? [e.results.date.getTime()] : [],
		),
	);
	return clusterReleases(releaseDates)
		.filter((date) => !shownTimes.has(date.getTime()))
		.map((date): ReleaseCard => {
			const sitting = sittings.find(
				(s) => releaseForSitting(s, releaseDates)?.getTime() === date.getTime(),
			);
			return sitting
				? { kind: "sitting", entry: releasedEntry(sitting, date) }
				: { kind: "release", date };
		});
}

export type OfficeStatus =
	| { kind: "released"; date: Date }
	| { kind: "overdue"; daysUntil: number }
	| { kind: "waiting"; entry: TimelineEntry; next: TimelineEntry | undefined }
	| { kind: "running"; entry: TimelineEntry }
	| { kind: "upcoming"; entry: TimelineEntry }
	| { kind: "noCalendar"; prediction: ReleasePrediction }
	| { kind: "unknown"; lastRelease: Date | null };

export function officeStatus(
	summary: JpaReleaseSummary | undefined,
	entries: TimelineEntry[],
	now: Date,
): OfficeStatus {
	const latest = summary && clusterReleases(summary.dates).at(-1);
	if (
		latest &&
		now.getTime() - latest.getTime() < RECENT_RELEASE_DAYS * MS_PER_DAY
	) {
		return { kind: "released", date: latest };
	}
	if (summary?.daysUntil != null && summary.daysUntil < 0) {
		return { kind: "overdue", daysUntil: summary.daysUntil };
	}
	const waiting = entries.find((e) => e.phase === "ausstehend");
	const next = entries.find(
		(e) => e.phase === "läuft" || e.phase === "anstehend",
	);
	if (waiting) return { kind: "waiting", entry: waiting, next };
	if (next?.phase === "läuft") return { kind: "running", entry: next };
	if (next) return { kind: "upcoming", entry: next };
	if (summary?.prediction) {
		return { kind: "noCalendar", prediction: summary.prediction };
	}
	return { kind: "unknown", lastRelease: summary?.lastRelease ?? null };
}

export function relativeLabel(daysUntil: number): string {
	if (daysUntil < 0) {
		const overdue = Math.abs(daysUntil);
		if (overdue < 7) {
			return `seit ${overdue} ${overdue === 1 ? "Tag" : "Tagen"} überfällig`;
		}
		const weeks = Math.round(overdue / 7);
		return `seit ${weeks} ${weeks === 1 ? "Woche" : "Wochen"} überfällig`;
	}
	if (daysUntil === 0) return "heute";
	if (daysUntil === 1) return "morgen";
	if (daysUntil <= 21) return `in ${daysUntil} Tagen`;
	return `in ${Math.round(daysUntil / 7)} Wochen`;
}

export const CONFIDENCE_LABEL: Record<PredictionConfidence, string> = {
	high: "recht sicher",
	medium: "wahrscheinlich",
	low: "grobe Schätzung",
};

export function monthPositionLabel(offsetDays: number): string {
	if (offsetDays >= -1) return "am letzten Werktag des Monats";
	if (offsetDays >= -4) return "in den letzten Tagen des Monats";
	if (offsetDays >= -12) return "in der zweiten Monatshälfte";
	if (offsetDays >= -20) return "um die Monatsmitte";
	return "in der ersten Monatshälfte";
}

export const formatDayMonth = (date: Date) =>
	date.toLocaleDateString("de-DE", { day: "numeric", month: "long" });

export const formatDayMonthShort = (date: Date) =>
	date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
