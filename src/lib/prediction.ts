import { type ExamSitting, resultMonthIndex } from "@/lib/exam-calendar";

const MS_PER_DAY = 86_400_000;

const CLUSTER_GAP_DAYS = 7;

const SLIP_THRESHOLD_DAY = 5;

const OVERDUE_GRACE_DAYS = 5;

const MAX_ANCHOR_STEPS = 1000;

const MIN_WINDOW_RADIUS_DAYS = 2;

export type PredictionConfidence = "high" | "medium" | "low";

export interface ReleasePrediction {
	date: Date;
	windowStart: Date;
	windowEnd: Date;
	confidence: PredictionConfidence;
	monthStep: number;
	medianOffsetDays: number;
	releaseCount: number;
	sitting?: ExamSitting;
}

function dateOnly(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + Math.round(days) * MS_PER_DAY);
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

function lastWorkingDayOfMonth(monthIndex: number): Date {
	const year = Math.floor(monthIndex / 12);
	const month = monthIndex - year * 12;
	const date = new Date(year, month + 1, 0); // day 0 of next month = last day
	while (date.getDay() === 0 || date.getDay() === 6) {
		date.setDate(date.getDate() - 1);
	}
	return date;
}

function anchorMonthIndex(date: Date): number {
	const index = date.getFullYear() * 12 + date.getMonth();
	return date.getDate() <= SLIP_THRESHOLD_DAY ? index - 1 : index;
}

function offsetFromMonthEnd(date: Date): number {
	const anchorEnd = lastWorkingDayOfMonth(anchorMonthIndex(date));
	return Math.round(
		(dateOnly(date).getTime() - anchorEnd.getTime()) / MS_PER_DAY,
	);
}

// Offices that publish after month end (Hamm) roll a weekend forward to
// Monday; month-end offices roll Saturday back to Friday.
function releaseDay(monthIndex: number, offsetDays: number): Date {
	const date = addDays(lastWorkingDayOfMonth(monthIndex), offsetDays);
	const day = date.getDay();
	if (day === 6) return addDays(date, offsetDays > 0 ? 2 : -1);
	if (day === 0) return addDays(date, 1);
	return date;
}

export function clusterReleases(dates: Date[]): Date[] {
	const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
	const clusters: Date[] = [];
	let clusterStart: Date | null = null;
	let prev: Date | null = null;

	for (const date of sorted) {
		if (
			prev === null ||
			date.getTime() - prev.getTime() >= CLUSTER_GAP_DAYS * MS_PER_DAY
		) {
			if (clusterStart) clusters.push(clusterStart);
			clusterStart = date;
		}
		prev = date;
	}
	if (clusterStart) clusters.push(clusterStart);

	return clusters;
}

export function medianReleaseOffset(fireDates: Date[]): number {
	const releases = clusterReleases(fireDates);
	return releases.length === 0
		? 0
		: Math.round(median(releases.map(offsetFromMonthEnd)));
}

/** Expected release day of a sitting: its result month's last working day plus the JPA's usual offset. */
export function expectedReleaseDate(
	sitting: ExamSitting,
	medianOffsetDays: number,
): Date {
	return releaseDay(resultMonthIndex(sitting), medianOffsetDays);
}

/** The recorded release that falls in a sitting's result cycle, if any. */
export function releaseForSitting(
	sitting: ExamSitting,
	fireDates: Date[],
): Date | undefined {
	const cycle = resultMonthIndex(sitting);
	return clusterReleases(fireDates).find(
		(release) => anchorMonthIndex(release) === cycle,
	);
}

/** Sittings whose results are not out yet, ascending. A sitting counts as released once a release lands in its result cycle, or once it is more than the grace period overdue. */
export function pendingSittings(
	sittings: readonly ExamSitting[],
	now: Date,
	fireDates: Date[],
): ExamSitting[] {
	const offset = medianReleaseOffset(fireDates);
	const lastRelease = clusterReleases(fireDates).at(-1);
	const releasedThrough = lastRelease ? anchorMonthIndex(lastRelease) : -1;
	const cutoff = now.getTime() - OVERDUE_GRACE_DAYS * MS_PER_DAY;
	return sittings.filter(
		(sitting) =>
			resultMonthIndex(sitting) > releasedThrough &&
			expectedReleaseDate(sitting, offset).getTime() >= cutoff,
	);
}

export function predictNextRelease(
	fireDates: Date[],
	now: Date,
	sittings: readonly ExamSitting[] = [],
): ReleasePrediction | null {
	const releases = clusterReleases(fireDates);
	if (releases.length < 1) return null;

	const anchors = releases.map(anchorMonthIndex);
	const offsets = releases.map(offsetFromMonthEnd);

	const steps: number[] = [];
	for (let i = 1; i < anchors.length; i++)
		steps.push(anchors[i] - anchors[i - 1]);
	const monthStep = Math.max(1, Math.round(median(steps)));

	const medianOffset = median(offsets);
	const offsetRange = Math.max(...offsets) - Math.min(...offsets);
	const radius = Math.max(MIN_WINDOW_RADIUS_DAYS, Math.round(offsetRange / 2));
	const stepsConsistent = new Set(steps).size === 1;

	const build = (
		predicted: Date,
		confidence: PredictionConfidence,
		sitting?: ExamSitting,
	): ReleasePrediction => ({
		date: predicted,
		windowStart: addDays(predicted, -radius),
		windowEnd: addDays(predicted, radius),
		confidence,
		monthStep,
		medianOffsetDays: Math.round(medianOffset),
		releaseCount: releases.length,
		sitting,
	});

	const [sitting] = pendingSittings(sittings, now, fireDates);
	if (sitting) {
		let confidence: PredictionConfidence = "low";
		if (releases.length >= 4 && offsetRange <= 6) confidence = "high";
		else if (releases.length >= 3 && offsetRange <= 12) confidence = "medium";
		return build(
			expectedReleaseDate(sitting, medianOffset),
			confidence,
			sitting,
		);
	}

	if (releases.length < 2) return null;

	const lastAnchor = anchors[anchors.length - 1];
	const predictForAnchor = (anchorIndex: number) =>
		releaseDay(anchorIndex, medianOffset);

	let targetAnchor = lastAnchor + monthStep;
	let predicted = predictForAnchor(targetAnchor);
	for (
		let guard = 0;
		predicted.getTime() < now.getTime() - OVERDUE_GRACE_DAYS * MS_PER_DAY &&
		guard < MAX_ANCHOR_STEPS;
		guard++
	) {
		targetAnchor += monthStep;
		predicted = predictForAnchor(targetAnchor);
	}

	let confidence: PredictionConfidence;
	if (releases.length >= 4 && offsetRange <= 6 && stepsConsistent) {
		confidence = "high";
	} else if (releases.length >= 3 && offsetRange <= 12) {
		confidence = "medium";
	} else {
		confidence = "low";
	}

	return build(predicted, confidence);
}
