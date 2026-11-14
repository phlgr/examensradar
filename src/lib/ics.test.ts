import { describe, expect, test } from "bun:test";
import { examCalendarFor } from "./exam-calendar.ts";
import { sittingCalendar } from "./ics.ts";

const sitting = (() => {
	const found = examCalendarFor("hamm")?.sittings.find(
		(s) => s.start === "2026-11-19",
	);
	if (!found) throw new Error("no November 2026 sitting");
	return found;
})();

const build = (jpaName = "Justizprüfungsamt Hamm", exams = sitting) =>
	sittingCalendar({
		jpaName,
		jpaUrl: "https://examensradar.de/ergebnisse/hamm",
		sitting: exams,
		expectedResults: new Date(2027, 2, 1),
		now: new Date("2026-11-05T10:00:00Z"),
	});

const unfold = (ics: string) => ics.replaceAll("\r\n ", "");
const events = (ics: string) =>
	unfold(ics)
		.split("BEGIN:VEVENT\r\n")
		.slice(1)
		.map((block) => block.split("END:VEVENT")[0]);

describe("sittingCalendar", () => {
	test("has the six exam days and one results event", () => {
		const all = events(build());
		expect(all).toHaveLength(7);
		expect(all[0]).toContain("DTSTART;VALUE=DATE:20261119\r\n");
		expect(all[0]).toContain("DTEND;VALUE=DATE:20261120\r\n");
		expect(all[0]).toContain("SUMMARY:Examensklausur Zivilrecht (ZR)");
		expect(all[0]).toContain("UID:20261119-1@examensradar.de");
		expect(all[0]).toContain("Viel Erfolg wünscht dir Examensradar!");
		expect(all[6]).toContain("DTSTART;VALUE=DATE:20270301\r\n");
		expect(all[6]).toContain("DTEND;VALUE=DATE:20270302\r\n");
		expect(all[6]).toContain("TRANSP:TRANSPARENT");
		expect(all[6]).toContain("ohne Gewähr");
		expect(all[6]).toContain("URL:https://examensradar.de/ergebnisse/hamm");
	});

	test("event UIDs are unique and stamped in UTC", () => {
		const uids = unfold(build()).match(/^UID:.*$/gm) ?? [];
		expect(new Set(uids).size).toBe(7);
		expect(build()).toContain("DTSTAMP:20261105T100000Z");
	});

	test("is a CRLF calendar with the required header", () => {
		const ics = build();
		expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
		expect(ics).toContain("X-WR-CALNAME:Klausuren November 2026");
		expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
		expect(ics.replaceAll("\r\n", "").includes("\n")).toBe(false);
	});

	test("escapes TEXT and folds at 75 octets without splitting umlauts", () => {
		const name = "Prüfungsamt, Süd; Ärger\\Ö ".repeat(4);
		const ics = build(name);
		for (const line of ics.split("\r\n").slice(0, -1)) {
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
		const escaped = name
			.replaceAll("\\", String.raw`\\`)
			.replaceAll(";", String.raw`\;`)
			.replaceAll(",", String.raw`\,`);
		expect(unfold(ics)).toContain(
			`DESCRIPTION:Staatliche Pflichtfachprüfung beim ${escaped}. Viel Erfolg wünscht dir Examensradar! Angaben ohne Gewähr.`,
		);
		expect(ics).not.toContain("�");
	});

	test("a range-only sitting is one multi-day event", () => {
		const all = events(
			build("Landesjustizprüfungsamt Bayern", {
				start: "2027-03-03",
				end: "2027-03-10",
				days: [],
			}),
		);
		expect(all).toHaveLength(2);
		expect(all[0]).toContain("DTSTART;VALUE=DATE:20270303\r\n");
		expect(all[0]).toContain("DTEND;VALUE=DATE:20270311\r\n");
		expect(all[0]).toContain("SUMMARY:Examensklausuren\r\n");
		expect(all[0]).toContain("nennt das Prüfungsamt nicht");
	});

	test("inferred subjects are marked as not confirmed, days without one have none", () => {
		const all = events(
			build("JPA Schleswig-Holstein", {
				start: "2027-01-19",
				end: "2027-01-29",
				days: [{ date: "2027-01-19" }, { date: "2027-01-21", subject: "SR" }],
				subjectsFrom: ["Niedersachsen", "Nordrhein-Westfalen"],
			}),
		);
		expect(all[0]).toContain("SUMMARY:Examensklausur\r\n");
		expect(all[0]).not.toContain("Terminplan");
		expect(all[1]).toContain("SUMMARY:Examensklausur Strafrecht (SR)");
		expect(all[1]).toContain(
			"Terminplan (Niedersachsen/Nordrhein-Westfalen)\\, das Prüfungsamt hat es nicht bestätigt",
		);
	});
});
