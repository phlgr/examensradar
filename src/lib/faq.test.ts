import { describe, expect, test } from "bun:test";
import { officePageMeta } from "./faq.ts";
import { examTimeline, summarizeReleases } from "./release-summary.ts";
import { officeLastmod } from "./seo.ts";

const NOW = new Date("2026-11-05T12:00:00");
const hammDates = [
	"2026-04-30T11:00:00",
	"2026-06-01T11:00:00",
	"2026-08-03T11:00:00",
	"2026-09-01T11:00:00",
	"2026-10-01T11:00:00",
].map((d) => new Date(d));

function metaFor(name: string, slug: string, now = NOW) {
	const summary = summarizeReleases(
		hammDates.map((sentAt) => ({
			sentAt,
			jpaName: name,
			jpaSlug: slug,
			jpaWebsiteUrl: null,
		})),
		now,
	)[0];
	const timeline = examTimeline(slug, hammDates, now);
	return officePageMeta(name, summary, timeline?.entries);
}

describe("officePageMeta", () => {
	test("leads with the next sitting and the expected results date", () => {
		const meta = metaFor("OLG Hamm", "hamm");
		expect(meta.title).toBe(
			"OLG Hamm: Termine & Ergebnisse 1. Examen | Examensradar",
		);
		expect(meta.h1).toBe(
			"OLG Hamm: Klausurtermine und Ergebnisse im 1. Examen",
		);
		expect(meta.description).toContain("19.–27. November 2026");
		expect(meta.description).toContain("1. Dezember 2026");
		expect(meta.description.indexOf("1. Dezember 2026")).toBeLessThan(
			meta.description.indexOf("19.–27. November 2026"),
		);
		expect(meta.description.length).toBeLessThanOrEqual(160);
		expect(
			metaFor("OLG Düsseldorf", "düsseldorf").description.length,
		).toBeLessThanOrEqual(160);
	});

	test("without a timeline it still has a title and no dates", () => {
		const meta = officePageMeta("JPA Berlin", undefined);
		expect(meta.title).toBe(
			"JPA Berlin: Termine & Ergebnisse 1. Examen | Examensradar",
		);
		expect(meta.description).toContain("JPA Berlin");
		expect(meta.description).not.toMatch(/klausuren/i);
	});

	test("the title stays short for the longest office name", () => {
		expect(
			metaFor("OLG Düsseldorf", "düsseldorf").title.length,
		).toBeLessThanOrEqual(60);
	});
});

describe("officeLastmod", () => {
	const release = new Date("2026-10-01T11:00:00Z");
	test("keeps the later of release and calendar stand", () => {
		expect(officeLastmod(release, "2026-08")?.toISOString().slice(0, 10)).toBe(
			"2026-10-01",
		);
		expect(
			officeLastmod(release, "2026-11-10")?.toISOString().slice(0, 10),
		).toBe("2026-11-10");
		expect(officeLastmod(release, null)).toBe(release);
	});
});
