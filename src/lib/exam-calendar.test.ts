import { describe, expect, test } from "bun:test";
import {
	examCalendarFor,
	formatSittingRange,
	resultMonthIndex,
	sittingStatus,
} from "./exam-calendar.ts";
import { examSchedule } from "./release-summary.ts";

const sittings = examCalendarFor("köln")?.sittings ?? [];
const sittingStarting = (date: string) => {
	const found = sittings.find((s) => s.days[0].date === date);
	if (!found) throw new Error(`no sitting starting ${date}`);
	return found;
};

describe("exam calendar", () => {
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
	});

	test("labels a sitting relative to today", () => {
		const sitting = sittingStarting("2026-01-22");
		expect(sittingStatus(sitting, "2026-01-21")).toBe("anstehend");
		expect(sittingStatus(sitting, "2026-01-28")).toBe("läuft");
		expect(sittingStatus(sitting, "2026-01-31")).toBe("geschrieben");
	});
});

describe("examSchedule", () => {
	const koeln = [
		"2026-04-30T11:00:00",
		"2026-05-29T11:00:00",
		"2026-07-31T11:00:00",
	].map((d) => new Date(d));

	test("keeps written sittings awaiting results and drops released ones", () => {
		const schedule = examSchedule(
			"köln",
			koeln,
			new Date("2026-10-05T12:00:00"),
		);
		const starts = schedule?.rows.map((r) => r.sitting.days[0].date);
		expect(starts?.[0]).toBe("2026-08-20");
		expect(schedule?.rows[0].status).toBe("geschrieben");
		expect(schedule?.rows[0].expected.toDateString()).toBe(
			new Date("2026-11-30T00:00:00").toDateString(),
		);
		expect(starts).toHaveLength(6);
		expect(schedule?.rows.at(-1)?.status).toBe("anstehend");
	});

	test("without history only the month is known", () => {
		const schedule = examSchedule("köln", [], new Date("2026-10-05T12:00:00"));
		expect(schedule?.rows.every((r) => !r.exactDate)).toBe(true);
	});

	test("JPAs without a calendar have no schedule", () => {
		expect(examSchedule("berlin", koeln, new Date())).toBeNull();
	});
});
