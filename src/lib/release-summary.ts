import {
	clusterReleases,
	type PredictionConfidence,
	predictNextRelease,
	type ReleasePrediction,
} from "@/lib/prediction";

/** One row of `jpa.getHistory`. */
export interface HistoryEntry {
	sentAt: Date | string | null;
	jpaName: string | null;
	jpaSlug: string | null;
	jpaWebsiteUrl: string | null;
}

export interface JpaReleaseSummary {
	slug: string;
	name: string;
	/** "JPA NRW" / "OLG Hamm" — for tight spots like the radar labels. */
	short: string;
	websiteUrl: string | null;
	/** Every recorded fire, newest first. */
	dates: Date[];
	lastRelease: Date;
	/** Distinct publication events (adjacent fires collapsed). */
	releaseCount: number;
	typicalHour: number;
	weekdayCounts: Map<number, number>;
	prediction: ReleasePrediction | null;
	/** Days until the predicted release; negative = overdue; null = no prediction. */
	daysUntil: number | null;
}

const MS_PER_DAY = 86_400_000;

function shortJpaName(name: string): string {
	return name
		.replace(/^Landesjustizprüfungsamt\b/, "LJPA")
		.replace(/^Justizprüfungsamt\b/, "JPA")
		.replace(/^Oberlandesgericht\b/, "OLG");
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
		: sorted[mid];
}

/**
 * Groups the notification log into one summary per Justizprüfungsamt, sorted
 * so the office expected to publish next comes first (offices without a
 * prediction last).
 */
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
		const weekdayCounts = new Map<number, number>();
		for (const date of dates) {
			weekdayCounts.set(
				date.getDay(),
				(weekdayCounts.get(date.getDay()) ?? 0) + 1,
			);
		}
		const prediction = predictNextRelease(dates, now);
		summaries.push({
			slug,
			name: group.name,
			short: shortJpaName(group.name),
			websiteUrl: group.websiteUrl,
			dates,
			lastRelease: dates[0],
			releaseCount: clusterReleases(dates).length,
			typicalHour: median(dates.map((d) => d.getHours())),
			weekdayCounts,
			prediction,
			daysUntil: prediction
				? Math.ceil((prediction.date.getTime() - now.getTime()) / MS_PER_DAY)
				: null,
		});
	}

	return summaries.sort((a, b) => {
		if (a.daysUntil === null) return 1;
		if (b.daysUntil === null) return -1;
		return a.daysUntil - b.daysUntil;
	});
}

/** "in 3 Wochen", "morgen", "seit 2 Tagen überfällig" */
export function relativeLabel(daysUntil: number): string {
	if (daysUntil < 0) {
		const overdue = Math.abs(daysUntil);
		return overdue < 7
			? `seit ${overdue} ${overdue === 1 ? "Tag" : "Tagen"} überfällig`
			: `seit ${Math.round(overdue / 7)} Wochen überfällig`;
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

/**
 * Where in the month an office tends to publish, from the median offset to the
 * last working day (so an end-of-month office reads "am Monatsende" even when
 * it occasionally slips into the next month).
 */
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
