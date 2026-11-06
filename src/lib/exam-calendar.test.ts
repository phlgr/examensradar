import { describe, expect, test } from "bun:test";
import {
	examCalendarFor,
	formatSittingMonth,
	formatSittingRange,
	formatSittingRangeShort,
	monthsBetween,
	resultMonthIndex,
	sittingStatus,
} from "./exam-calendar.ts";
import { examTimeline } from "./release-summary.ts";

const sittings = examCalendarFor("köln")?.sittings ?? [];
const sittingStarting = (date: string) => {
	const found = sittings.find((s) => s.days[0].date === date);
	if (!found) throw new Error(`no sitting starting ${date}`);
	return found;
};

describe("exam calendar", () => {
	test("short range is numeric, with both months when it spills over", () => {
		expect(formatSittingRangeShort(sittingStarting("2026-08-20"))).toBe(
			"20.–28.08.",
		);
		expect(formatSittingRangeShort(sittingStarting("2026-02-23"))).toBe(
			"23.02.–03.03.",
		);
	});

	test("month label names the year only outside the current one", () => {
		const august = sittingStarting("2026-08-20");
		expect(formatSittingMonth(august, 2026)).toBe("August");
		expect(formatSittingMonth(august, 2025)).toBe("August 2026");
	});

	test("lists the months without a sitting between two sittings", () => {
		const between = (a: string, b: string) =>
			monthsBetween(sittingStarting(a), sittingStarting(b));
		expect(between("2026-06-22", "2026-08-20")).toEqual(["Juli"]);
		expect(between("2026-10-22", "2026-11-19")).toEqual([]);
	});

	test("covers the NRW offices and nothing else", () => {
		expect(examCalendarFor("hamm")?.sittings).toBe(sittings);
		expect(examCalendarFor("düsseldorf")?.sittings).toBe(sittings);
		expect(examCalendarFor("berlin")).toBeUndefined();
	});

	test("results come three months after the first exam day", () => {
		expect(resultMonthIndex(sittingStarting("2026-08-20"))).toBe(
			2026 * 12 + 10,
		);
	});

	test("a February sitting spilling into March still counts by its start month", () => {
		const february = sittingStarting("2026-02-23");
		expect(february.days.at(-1)?.date).toBe("2026-03-03");
		expect(resultMonthIndex(february)).toBe(2026 * 12 + 4);
		expect(formatSittingRange(february)).toBe("23. Februar – 3. März 2026");
	});

	test("formats a range within one month", () => {
		expect(formatSittingRange(sittingStarting("2026-01-22"))).toBe(
			"22.–30. Januar 2026",
		);
		expect(
			formatSittingRange(sittingStarting("2026-02-23"), { year: false }),
		).toBe("23. Februar – 3. März");
	});

	test("labels a sitting relative to today", () => {
		const sitting = sittingStarting("2026-01-22");
		expect(sittingStatus(sitting, "2026-01-21")).toBe("anstehend");
		expect(sittingStatus(sitting, "2026-01-28")).toBe("läuft");
		expect(sittingStatus(sitting, "2026-01-31")).toBe("geschrieben");
	});
});

describe("examTimeline", () => {
	const hamm = [
		"2026-04-30T11:00:00",
		"2026-06-01T11:00:00",
		"2026-08-03T11:00:00",
		"2026-09-01T11:00:00",
		"2026-10-01T11:00:00",
	].map((d) => new Date(d));
	const startOf = (e: { sitting: { days: readonly { date: string }[] } }) =>
		e.sitting.days[0].date;

	test("shows the latest release, pending sittings and six upcoming ones", () => {
		const timeline = examTimeline(
			"hamm",
			hamm,
			new Date("2026-11-05T12:00:00"),
		);
		const entries = timeline?.entries ?? [];
		expect(entries.map(startOf).slice(0, 3)).toEqual([
			"2026-06-22",
			"2026-08-20",
			"2026-10-22",
		]);
		expect(entries.map((e) => e.phase)).toEqual([
			"veröffentlicht",
			"ausstehend",
			"ausstehend",
			"anstehend",
			"anstehend",
			"anstehend",
			"anstehend",
			"anstehend",
			"anstehend",
		]);
		expect(startOf(entries[3])).toBe("2026-11-19");
		expect(startOf(entries[8])).toBe("2027-05-20");

		const released = entries[0].results;
		expect(released.kind).toBe("released");
		expect(released.date.toDateString()).toBe(
			new Date("2026-10-01T00:00:00").toDateString(),
		);
		expect(entries[1].results).toMatchObject({ kind: "expected", exact: true });
		expect(entries[1].results.date.toDateString()).toBe(
			new Date("2026-12-01T00:00:00").toDateString(),
		);
		expect(entries[2].results.date.toDateString()).toBe(
			new Date("2027-02-01T00:00:00").toDateString(),
		);
	});

	test("a sitting in progress is running", () => {
		const timeline = examTimeline(
			"hamm",
			hamm,
			new Date("2026-11-23T12:00:00"),
		);
		const november = timeline?.entries.find((e) => startOf(e) === "2026-11-19");
		expect(november?.phase).toBe("läuft");
	});

	test("without history only the month is known", () => {
		const timeline = examTimeline("köln", [], new Date("2026-10-05T12:00:00"));
		expect(timeline?.entries.length).toBeGreaterThan(0);
		for (const entry of timeline?.entries ?? []) {
			expect(entry.results.kind).toBe("expected");
			expect(entry.results).toMatchObject({ exact: false });
		}
	});

	test("JPAs without a calendar have no timeline", () => {
		expect(examTimeline("berlin", hamm, new Date())).toBeNull();
	});
});
