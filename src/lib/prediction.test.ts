import { describe, expect, test } from "bun:test";
import { examCalendarFor } from "./exam-calendar.ts";
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
			d("2025-03-18T14:00:00"),
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
		const fires = [
			d("2025-01-31T10:00:00"),
			d("2025-02-28T10:00:00"),
			d("2025-04-01T10:00:00"),
			d("2025-04-30T10:00:00"),
		];
		const p = predictNextRelease(fires, d("2025-05-05")) as ReleasePrediction;
		expect(p.monthStep).toBe(1);
		expect(p.medianOffsetDays).toBeGreaterThanOrEqual(0);
		expect(p.medianOffsetDays).toBeLessThanOrEqual(1);
		expect(p.date.getMonth()).toBe(4);
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
		expect(p.medianOffsetDays).toBeLessThan(-10);
		expect(p.date.getMonth()).toBe(4);
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

describe("predictNextRelease with the exam calendar", () => {
	const sittings = examCalendarFor("köln")?.sittings ?? [];
	const ymd = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

	test("Köln-like history skips the empty October cycle", () => {
		const prediction = predictNextRelease(
			[
				"2026-04-30T11:00:00",
				"2026-05-29T11:00:00",
				"2026-07-31T11:00:00",
				"2026-08-31T11:00:00",
				"2026-09-30T11:00:00",
			].map(d),
			d("2026-10-05T12:00:00"),
			sittings,
		);
		expect(prediction && ymd(prediction.date)).toBe("2026-11-30");
		expect(prediction?.sitting?.days[0].date).toBe("2026-08-20");
		expect(prediction?.confidence).toBe("high");
	});

	test("Hamm-like history lands one working day after month end", () => {
		const prediction = predictNextRelease(
			[
				"2026-04-30T11:00:00",
				"2026-06-01T11:00:00",
				"2026-08-03T11:00:00",
				"2026-09-01T11:00:00",
				"2026-10-01T11:00:00",
			].map(d),
			d("2026-11-05T12:00:00"),
			sittings,
		);
		expect(prediction && ymd(prediction.date)).toBe("2026-12-01");
	});

	test("moves on as soon as the expected release happened, not after the grace period", () => {
		const prediction = predictNextRelease(
			[
				"2026-08-03T11:00:00",
				"2026-09-01T11:00:00",
				"2026-10-01T11:00:00",
				"2026-12-01T11:00:00",
			].map(d),
			d("2026-12-02T12:00:00"),
			sittings,
		);
		expect(prediction?.sitting?.days[0].date).toBe("2026-10-22");
		expect(prediction && ymd(prediction.date)).toBe("2027-02-01");
	});

	test("a single release is enough once the calendar gives the cadence", () => {
		const prediction = predictNextRelease(
			[d("2026-09-30T11:00:00")],
			d("2026-10-05T12:00:00"),
			sittings,
		);
		expect(prediction && ymd(prediction.date)).toBe("2026-11-30");
		expect(prediction?.confidence).toBe("low");
	});

	test("falls back to the monthly model when the calendar is exhausted", () => {
		const fires = ["2025-01-31T11:00:00", "2025-02-28T11:00:00"].map(d);
		const now = d("2031-01-05T12:00:00");
		expect(predictNextRelease(fires, now, sittings)).toEqual(
			predictNextRelease(fires, now),
		);
	});
});
