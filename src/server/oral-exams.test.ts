import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { OralExamSource } from "@/lib/oral-exams";
import { loadOralExams } from "./oral-exams.ts";

const DAYS = "https://example.test/days";

function source(assignmentUrls: string[], failing = new Set<string>()) {
	return {
		indexUrl: "https://example.test/index",
		linkUrl: "https://example.test/index",
		format: "html",
		documents: () => [DAYS],
		parse: () => [{ date: "2026-11-04", place: "Saal B 2" }],
		assignments: {
			format: "html",
			documents: () => assignmentUrls,
			parse: (content: string) => {
				if (failing.has(content)) throw new Error("no Kennziffern found");
				return [
					{
						kennziffer: `${content}/26`,
						date: "2026-11-04",
						place: "Saal B 2",
					},
				];
			},
		},
	} satisfies OralExamSource;
}

const read =
	(failing: string[] = []) =>
	async (url: string) => {
		if (failing.includes(url)) throw new Error("HTTP 500");
		return url.split("/").pop() ?? "";
	};

const errors = spyOn(console, "error").mockImplementation(() => {});
afterEach(() => errors.mockClear());

describe("loadOralExams", () => {
	test("keeps the day list when assignment documents fail", async () => {
		const urls = [
			"https://example.test/1",
			"https://example.test/2",
			"https://example.test/3",
		];
		const data = await loadOralExams(
			"test",
			source(urls, new Set(["3"])),
			read(["https://example.test/2"]),
		);
		expect(data.schedule.days).toEqual([
			{ date: "2026-11-04", places: ["Saal B 2"] },
		]);
		expect(data.schedule.lookup).toBe(true);
		expect(Object.keys(data.assignments)).toEqual(["1/26"]);
		expect(errors.mock.calls.map(([line]) => line)).toEqual([
			"[oral-exams] test: https://example.test/2: HTTP 500",
			"[oral-exams] test: https://example.test/3: no Kennziffern found",
		]);
	});

	test("still fails when a day-list document cannot be read", async () => {
		await expect(
			loadOralExams("test", source([]), read([DAYS])),
		).rejects.toThrow(`${DAYS}: HTTP 500`);
	});

	test("reads at most four assignment documents at once", async () => {
		const urls = Array.from(
			{ length: 12 },
			(_, i) => `https://example.test/${i + 1}`,
		);
		let running = 0;
		let peak = 0;
		const slow = async (url: string) => {
			const name = url.split("/").pop() ?? "";
			if (Number.isNaN(Number(name))) return name;
			running++;
			peak = Math.max(peak, running);
			await Bun.sleep(5);
			running--;
			return name;
		};
		const data = await loadOralExams("test", source(urls), slow);
		expect(Object.keys(data.assignments)).toHaveLength(12);
		expect(peak).toBe(4);
	});

	test("reads a page shared by the day list and the assignments once", async () => {
		const reads: string[] = [];
		const shared = { ...source([DAYS]) };
		await loadOralExams("test", shared, async (url) => {
			reads.push(url);
			return "1";
		});
		expect(reads.filter((url) => url === DAYS)).toHaveLength(1);
	});

	test("offers no lookup for an office without assignment documents", async () => {
		const { assignments: _, ...plain } = source([]);
		const data = await loadOralExams("test", plain, read());
		expect(data.schedule.lookup).toBe(false);
		expect(data.assignments).toEqual({});
	});
});
