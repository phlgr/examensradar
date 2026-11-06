import { describe, expect, test } from "bun:test";
import {
	examTimeline,
	type HistoryEntry,
	officeStatus,
	olderReleases,
	type ReleaseCard,
	relativeLabel,
	summarizeReleases,
} from "./release-summary";

const NOW = new Date(2026, 8, 4, 12);

function entry(
	slug: string,
	sentAt: Date,
	name = slug.toUpperCase(),
): HistoryEntry {
	return { sentAt, jpaName: name, jpaSlug: slug, jpaWebsiteUrl: null };
}

function lastWorkday(year: number, month: number, hour = 14): Date {
	const date = new Date(year, month + 1, 0, hour);
	while (date.getDay() === 0 || date.getDay() === 6) {
		date.setDate(date.getDate() - 1);
	}
	return date;
}

describe("relativeLabel", () => {
	test("future", () => {
		expect(relativeLabel(0)).toBe("heute");
		expect(relativeLabel(1)).toBe("morgen");
		expect(relativeLabel(21)).toBe("in 21 Tagen");
		expect(relativeLabel(22)).toBe("in 3 Wochen");
	});

	test("overdue uses singular and plural correctly", () => {
		expect(relativeLabel(-1)).toBe("seit 1 Tag überfällig");
		expect(relativeLabel(-6)).toBe("seit 6 Tagen überfällig");
		expect(relativeLabel(-7)).toBe("seit 1 Woche überfällig");
		expect(relativeLabel(-10)).toBe("seit 1 Woche überfällig");
		expect(relativeLabel(-15)).toBe("seit 2 Wochen überfällig");
	});
});

describe("summarizeReleases", () => {
	test("groups fires per office and collapses a cluster into one release", () => {
		const first = new Date(2026, 6, 31, 14, 2);
		const edit = new Date(2026, 7, 1, 9, 30);
		const summaries = summarizeReleases(
			[entry("nrw", edit), entry("nrw", first)],
			NOW,
		);

		expect(summaries).toHaveLength(1);
		const [nrw] = summaries;
		expect(nrw.dates.map((d) => d.getTime())).toEqual([
			edit.getTime(),
			first.getTime(),
		]);
		expect(nrw.lastRelease.getTime()).toBe(edit.getTime());
		expect(nrw.releaseCount).toBe(1);
		expect(nrw.prediction).toBeNull();
		expect(nrw.daysUntil).toBeNull();
	});

	test("skips rows with missing office or timestamp", () => {
		const summaries = summarizeReleases(
			[
				{ sentAt: NOW, jpaName: null, jpaSlug: null, jpaWebsiteUrl: null },
				{ sentAt: null, jpaName: "X", jpaSlug: "x", jpaWebsiteUrl: null },
			],
			NOW,
		);
		expect(summaries).toHaveLength(0);
	});

	test("sorts by next expected release, offices without a prediction last", () => {
		const monthly = [5, 6, 7].map((m) =>
			entry("monthly", lastWorkday(2026, m)),
		);
		const quarterly = [
			entry("quarterly", new Date(2025, 11, 22, 11)),
			entry("quarterly", new Date(2026, 2, 23, 11)),
			entry("quarterly", new Date(2026, 5, 22, 11)),
		];
		const single = [
			entry("older", new Date(2026, 3, 1, 10)),
			entry("newer", new Date(2026, 7, 1, 10)),
		];

		const order = summarizeReleases(
			[...single, ...quarterly, ...monthly],
			NOW,
		).map((s) => s.slug);

		expect(order.slice(0, 2).sort()).toEqual(["monthly", "quarterly"]);
		expect(order.slice(2)).toEqual(["newer", "older"]);
	});

	test("comparator is consistent for two offices without a prediction", () => {
		const a = entry("a", new Date(2026, 0, 10));
		const b = entry("b", new Date(2026, 0, 20));
		const forward = summarizeReleases([a, b], NOW).map((s) => s.slug);
		const backward = summarizeReleases([b, a], NOW).map((s) => s.slug);
		expect(forward).toEqual(["b", "a"]);
		expect(backward).toEqual(["b", "a"]);
	});
});

const hamm = [
	"2026-04-30T11:00:00",
	"2026-06-01T11:00:00",
	"2026-08-03T11:00:00",
	"2026-09-01T11:00:00",
	"2026-10-01T11:00:00",
].map((d) => new Date(d));

const startOf = (sitting: { days: readonly { date: string }[] }) =>
	sitting.days[0].date;

function statusAt(slug: string, dates: Date[], now: Date) {
	const summary = summarizeReleases(
		dates.map((d) => entry(slug, d)),
		now,
	)[0];
	const entries = examTimeline(slug, dates, now)?.entries ?? [];
	return officeStatus(summary, entries, now);
}

describe("officeStatus", () => {
	test("a release within the past week is online", () => {
		const status = statusAt("hamm", hamm, new Date("2026-10-05T12:00:00"));
		expect(status).toEqual({
			kind: "released",
			date: new Date("2026-10-01T11:00:00"),
		});
	});

	test("seven days after the release the office waits again", () => {
		const release = new Date("2026-10-01T11:00:00").getTime();
		const week = 7 * 86_400_000;
		expect(statusAt("hamm", hamm, new Date(release + week - 1)).kind).toBe(
			"released",
		);
		expect(statusAt("hamm", hamm, new Date(release + week)).kind).toBe(
			"waiting",
		);
	});

	test("with several sittings waiting it names the oldest one and the next exams", () => {
		const status = statusAt("hamm", hamm, new Date("2026-11-05T12:00:00"));
		if (status.kind !== "waiting") throw new Error(status.kind);
		expect(startOf(status.entry.sitting)).toBe("2026-08-20");
		expect(status.entry.results.date.toDateString()).toBe(
			new Date("2026-12-01T00:00:00").toDateString(),
		);
		expect(status.next && startOf(status.next.sitting)).toBe("2026-11-19");
	});

	test("a passed expected date is overdue", () => {
		const status = statusAt("hamm", hamm, new Date("2026-12-03T12:00:00"));
		expect(status).toEqual({ kind: "overdue", daysUntil: -2 });
	});

	test("a sitting in progress with nothing waiting is running", () => {
		const autumn2025 = [
			"2025-10-31T14:00:00",
			"2025-11-28T14:00:00",
			"2025-12-30T14:00:00",
		].map((d) => new Date(d));
		const status = statusAt(
			"hamm",
			autumn2025,
			new Date("2026-01-26T12:00:00"),
		);
		if (status.kind !== "running") throw new Error(status.kind);
		expect(startOf(status.entry.sitting)).toBe("2026-01-22");
		expect(status.entry.results).toMatchObject({
			kind: "expected",
			exact: true,
		});
	});

	test("before the first sitting only the upcoming one is known", () => {
		const status = statusAt("köln", [], new Date("2026-01-10T12:00:00"));
		if (status.kind !== "upcoming") throw new Error(status.kind);
		expect(startOf(status.entry.sitting)).toBe("2026-01-22");
		expect(status.entry.results).toMatchObject({ exact: false });
	});

	test("an office without calendar falls back to the prediction", () => {
		const monthly = [5, 6, 7].map((m) => lastWorkday(2026, m));
		const status = statusAt("berlin", monthly, new Date(2026, 8, 15, 12));
		if (status.kind !== "noCalendar") throw new Error(status.kind);
		expect(status.prediction.date.toDateString()).toBe(
			new Date(2026, 8, 30).toDateString(),
		);
	});

	test("without enough history nothing is known", () => {
		expect(statusAt("berlin", [], NOW)).toEqual({
			kind: "unknown",
			lastRelease: null,
		});
		const once = new Date(2026, 5, 30, 14);
		expect(statusAt("berlin", [once], NOW)).toEqual({
			kind: "unknown",
			lastRelease: once,
		});
	});
});

describe("olderReleases", () => {
	const describeCard = (card: ReleaseCard) =>
		card.kind === "sitting"
			? `${startOf(card.entry.sitting)} ${card.entry.phase} ${card.entry.results.date.toDateString()}`
			: `release ${card.date.toDateString()}`;

	test("lists releases the timeline doesn't show, oldest first, with their sitting", () => {
		const dates = [
			new Date("2025-11-28T14:00:00"),
			...hamm,
			new Date("2026-09-02T09:00:00"),
		];
		const now = new Date("2026-11-05T12:00:00");
		const shown = examTimeline("hamm", dates, now)?.entries ?? [];

		expect(olderReleases("hamm", dates, shown).map(describeCard)).toEqual([
			`release ${new Date("2025-11-28").toDateString()}`,
			`2026-01-22 veröffentlicht ${new Date("2026-04-30").toDateString()}`,
			`2026-02-23 veröffentlicht ${new Date("2026-06-01").toDateString()}`,
			`2026-04-21 veröffentlicht ${new Date("2026-08-03").toDateString()}`,
			`2026-05-19 veröffentlicht ${new Date("2026-09-01").toDateString()}`,
		]);
	});

	test("an office without calendar gets every release as a plain card", () => {
		const dates = [lastWorkday(2026, 6), lastWorkday(2026, 5)];
		expect(olderReleases("berlin", dates, []).map(describeCard)).toEqual([
			`release ${lastWorkday(2026, 5).toDateString()}`,
			`release ${lastWorkday(2026, 6).toDateString()}`,
		]);
	});
});
