const MS_PER_DAY = 86_400_000;

const CLUSTER_GAP_DAYS = 7;

const SLIP_THRESHOLD_DAY = 5;

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

function avoidWeekend(date: Date): Date {
	const day = date.getDay();
	if (day === 6) return addDays(date, -1);
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

export function predictNextRelease(
	fireDates: Date[],
	now: Date,
): ReleasePrediction | null {
	const releases = clusterReleases(fireDates);
	if (releases.length < 2) return null;

	const anchors = releases.map(anchorMonthIndex);
	const offsets = releases.map(offsetFromMonthEnd);

	const steps: number[] = [];
	for (let i = 1; i < anchors.length; i++)
		steps.push(anchors[i] - anchors[i - 1]);
	const monthStep = Math.max(1, Math.round(median(steps)));

	const medianOffset = median(offsets);
	const lastAnchor = anchors[anchors.length - 1];

	const predictForAnchor = (anchorIndex: number) =>
		avoidWeekend(addDays(lastWorkingDayOfMonth(anchorIndex), medianOffset));

	let targetAnchor = lastAnchor + monthStep;
	let predicted = predictForAnchor(targetAnchor);
	for (
		let guard = 0;
		predicted.getTime() < now.getTime() - 5 * MS_PER_DAY && guard < 1000;
		guard++
	) {
		targetAnchor += monthStep;
		predicted = predictForAnchor(targetAnchor);
	}

	const offsetRange = Math.max(...offsets) - Math.min(...offsets);
	const radius = Math.max(MIN_WINDOW_RADIUS_DAYS, Math.round(offsetRange / 2));
	const stepsConsistent = new Set(steps).size === 1;

	let confidence: PredictionConfidence;
	if (releases.length >= 4 && offsetRange <= 6 && stepsConsistent) {
		confidence = "high";
	} else if (releases.length >= 3 && offsetRange <= 12) {
		confidence = "medium";
	} else {
		confidence = "low";
	}

	return {
		date: predicted,
		windowStart: addDays(predicted, -radius),
		windowEnd: addDays(predicted, radius),
		confidence,
		monthStep,
		medianOffsetDays: Math.round(medianOffset),
		releaseCount: releases.length,
	};
}
