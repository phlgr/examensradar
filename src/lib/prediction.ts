/**
 * Release-date prediction for Justizprüfungsämter.
 *
 * The historical signal we have is `notification_log.sent_at` — one row per
 * webhook fire. A real publication can trigger more than one fire (the office
 * edits the page again a day later), so we first collapse near-adjacent fires
 * into single release events.
 *
 * Offices publish on a fixed point in their monthly/quarterly cycle — for the
 * NRW offices that point is the *last working day of the month*, and they
 * occasionally slip a day or two into the next month. Modelling the absolute
 * day-of-month would mistake those slips (the 1st/2nd) for an early-month
 * release and drag the average toward mid-month. So instead we measure each
 * release as a signed **offset from the last working day of its month**, after
 * folding an early-next-month slip (day ≤ 5) back onto the previous month's
 * cycle. End-of-month publishers then show offsets near 0; a genuinely
 * mid-month publisher shows a large, stable negative offset. Either way the
 * cadence (how many months between releases) and the offset are projected
 * forward onto the target month.
 */

const MS_PER_DAY = 86_400_000;

/** Fires closer together than this are treated as the same publication event. */
const CLUSTER_GAP_DAYS = 7;

/**
 * A release on or before this day-of-month is treated as a slip belonging to
 * the previous month's cycle rather than an early release of the current one.
 */
const SLIP_THRESHOLD_DAY = 5;

/** Minimum half-width of the prediction window, in days. */
const MIN_WINDOW_RADIUS_DAYS = 2;

export type PredictionConfidence = "high" | "medium" | "low";

export interface ReleasePrediction {
	/** Best single-date guess for the next release. */
	date: Date;
	/** Likely window around `date`. */
	windowStart: Date;
	windowEnd: Date;
	confidence: PredictionConfidence;
	/** Months between releases (1 = monthly, 3 = quarterly). */
	monthStep: number;
	/**
	 * Typical offset from the last working day of the month, in days.
	 * ~0 means "last working day"; negative means earlier in the month;
	 * small positive means a slip into the next month.
	 */
	medianOffsetDays: number;
	/** Distinct release events the prediction is based on. */
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

/** Last working day (Mon–Fri) of the calendar month at `monthIndex` (year*12+month). */
function lastWorkingDayOfMonth(monthIndex: number): Date {
	const year = Math.floor(monthIndex / 12);
	const month = monthIndex - year * 12;
	const date = new Date(year, month + 1, 0); // day 0 of next month = last day
	while (date.getDay() === 0 || date.getDay() === 6) {
		date.setDate(date.getDate() - 1);
	}
	return date;
}

/** Cycle month a release belongs to, folding an early-month slip backwards. */
function anchorMonthIndex(date: Date): number {
	const index = date.getFullYear() * 12 + date.getMonth();
	return date.getDate() <= SLIP_THRESHOLD_DAY ? index - 1 : index;
}

/** Signed days between a release and the last working day of its cycle month. */
function offsetFromMonthEnd(date: Date): number {
	const anchorEnd = lastWorkingDayOfMonth(anchorMonthIndex(date));
	return Math.round(
		(dateOnly(date).getTime() - anchorEnd.getTime()) / MS_PER_DAY,
	);
}

/** Nudge weekend dates onto the adjacent weekday (Sat→Fri, Sun→Mon). */
function avoidWeekend(date: Date): Date {
	const day = date.getDay();
	if (day === 6) return addDays(date, -1);
	if (day === 0) return addDays(date, 1);
	return date;
}

/**
 * Collapse a list of fire timestamps into one timestamp per publication event.
 * Returns the earliest fire of each cluster, ascending.
 */
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

/**
 * Predict the next release from historical fire timestamps.
 * Returns null when there isn't at least one interval (two distinct events).
 */
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

	// Project onto the next cycle, rolling past whole cycles already missed so
	// an active JPA never reads as months overdue — at most ~one cycle late.
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
