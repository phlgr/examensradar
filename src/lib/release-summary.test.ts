import { describe, expect, test } from "bun:test";
import {
	type HistoryEntry,
	relativeLabel,
	summarizeReleases,
} from "./release-summary";

const NOW = new Date(2026, 8, 4, 12); // 4 Sept 2026, a Friday

function entry(
	slug: string,
	sentAt: Date,
	name = slug.toUpperCase(),
): HistoryEntry {
	return { sentAt, jpaName: name, jpaSlug: slug, jpaWebsiteUrl: null };
}

/** Last working day of the given month, mirroring the prediction model. */
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
		const edit = new Date(2026, 7, 1, 9, 30); // same publication, edited next day
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
		// Monthly publisher: predicted end of September → soon.
		const monthly = [5, 6, 7].map((m) =>
			entry("monthly", lastWorkday(2026, m)),
		);
		// Quarterly publisher: last in June → next end of September as well, but
		// give it a later slip so it lands after the monthly office.
		const quarterly = [
			entry("quarterly", new Date(2025, 11, 22, 11)),
			entry("quarterly", new Date(2026, 2, 23, 11)),
			entry("quarterly", new Date(2026, 5, 22, 11)),
		];
		// Two offices with a single release each: no prediction, newest first.
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
