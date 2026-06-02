import { describe, expect, test } from "bun:test";
import {
	clusterReleases,
	predictNextRelease,
	type ReleasePrediction,
} from "./prediction.ts";

const d = (iso: string) => new Date(iso);
const daysBetween = (a: Date, b: Date) =>
	Math.round((b.getTime() - a.getTime()) / 86_400_000);

describe("clusterReleases", () => {
	test("collapses fires within the cluster gap into one event", () => {
		const clusters = clusterReleases([
			d("2025-03-17T10:00:00"),
			d("2025-03-18T14:00:00"), // same publication, next day
			d("2025-06-16T09:00:00"),
		]);
		expect(clusters).toHaveLength(2);
		expect(clusters[0].toISOString()).toBe(
			d("2025-03-17T10:00:00").toISOString(),
		);
	});

	test("keeps distinct events that are far apart", () => {
		const clusters = clusterReleases([
			d("2025-01-10T10:00:00"),
			d("2025-02-10T10:00:00"),
			d("2025-03-10T10:00:00"),
		]);
		expect(clusters).toHaveLength(3);
	});

	test("returns events in ascending order regardless of input order", () => {
		const clusters = clusterReleases([
			d("2025-03-10T10:00:00"),
			d("2025-01-10T10:00:00"),
			d("2025-02-10T10:00:00"),
		]);
		expect(clusters.map((c) => c.getMonth())).toEqual([0, 1, 2]);
	});
});

describe("predictNextRelease", () => {
	test("returns null with fewer than two distinct events", () => {
		expect(predictNextRelease([], d("2025-06-01"))).toBeNull();
		expect(
			predictNextRelease([d("2025-05-01T10:00:00")], d("2025-06-01")),
		).toBeNull();
	});

	test("predicts month-end and folds early-next-month slips (the Hamm case)", () => {
		// Last working day each month, twice slipping into the next month.
		const fires = [
			d("2025-01-31T10:00:00"), // Fri, last working day of Jan
			d("2025-02-28T10:00:00"), // Fri, last working day of Feb
			d("2025-04-01T10:00:00"), // Tue, slip — belongs to March's cycle
			d("2025-04-30T10:00:00"), // Wed, last working day of Apr
		];
		const p = predictNextRelease(fires, d("2025-05-05")) as ReleasePrediction;
		expect(p.monthStep).toBe(1);
		// Offset stays at "last working day", NOT dragged mid-month by the slip.
		expect(p.medianOffsetDays).toBeGreaterThanOrEqual(0);
		expect(p.medianOffsetDays).toBeLessThanOrEqual(1);
		// Next prediction must land at the end of May, not mid-May.
		expect(p.date.getMonth()).toBe(4); // May
		expect(p.date.getDate()).toBeGreaterThanOrEqual(28);
	});

	test("projects forward by the cadence for a mid-month monthly pattern", () => {
		const fires = [
			d("2025-01-14T10:00:00"),
			d("2025-02-11T10:00:00"),
			d("2025-03-11T10:00:00"),
			d("2025-04-15T10:00:00"),
		];
		const p = predictNextRelease(fires, d("2025-04-20")) as ReleasePrediction;
		expect(p.monthStep).toBe(1);
		// Stable mid-month offset (~17 days before month-end).
		expect(p.medianOffsetDays).toBeLessThan(-10);
		expect(p.date.getMonth()).toBe(4); // May
		expect(p.date.getDate()).toBeLessThan(20);
	});

	test("handles a quarterly cadence without assuming monthly", () => {
		const fires = [
			d("2024-12-13T10:00:00"),
			d("2025-03-17T10:00:00"),
			d("2025-06-13T10:00:00"),
			d("2025-09-16T10:00:00"),
		];
		const p = predictNextRelease(fires, d("2025-09-20")) as ReleasePrediction;
		expect(p.monthStep).toBe(3);
		// Next release ~a quarter after the last one.
		expect(daysBetween(d("2025-09-16"), p.date)).toBeGreaterThan(80);
	});

	test("never predicts a weekend", () => {
		const fires = [
			d("2025-01-04T10:00:00"),
			d("2025-02-01T10:00:00"),
			d("2025-03-01T10:00:00"),
		];
		const p = predictNextRelease(fires, d("2025-03-05")) as ReleasePrediction;
		expect(p.date.getDay()).not.toBe(0);
		expect(p.date.getDay()).not.toBe(6);
	});

	test("rolls past missed cycles so it is never months overdue", () => {
		const fires = [
			d("2025-01-13T10:00:00"),
			d("2025-02-10T10:00:00"),
			d("2025-03-10T10:00:00"),
		];
		const p = predictNextRelease(fires, d("2025-09-01")) as ReleasePrediction;
		const ahead = daysBetween(d("2025-09-01"), p.date);
		expect(ahead).toBeGreaterThan(-35);
		expect(ahead).toBeLessThan(40);
	});

	test("reports higher confidence for a tight, well-sampled cadence", () => {
		const tight = predictNextRelease(
			[
				d("2025-01-14T10:00:00"),
				d("2025-02-11T10:00:00"),
				d("2025-03-11T10:00:00"),
				d("2025-04-08T10:00:00"),
				d("2025-05-13T10:00:00"),
			],
			d("2025-05-20"),
		) as ReleasePrediction;
		expect(tight.confidence).toBe("high");

		const erratic = predictNextRelease(
			[
				d("2025-01-05T10:00:00"),
				d("2025-01-20T10:00:00"),
				d("2025-06-01T10:00:00"),
			],
			d("2025-06-10"),
		) as ReleasePrediction;
		expect(erratic.confidence).toBe("low");
	});

	test("produces a window that brackets the predicted date", () => {
		const p = predictNextRelease(
			[
				d("2025-01-14T10:00:00"),
				d("2025-02-11T10:00:00"),
				d("2025-03-11T10:00:00"),
			],
			d("2025-03-20"),
		) as ReleasePrediction;
		expect(p.windowStart.getTime()).toBeLessThan(p.date.getTime());
		expect(p.windowEnd.getTime()).toBeGreaterThan(p.date.getTime());
	});
});
