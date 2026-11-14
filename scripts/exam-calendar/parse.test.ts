import { describe, expect, test } from "bun:test";
import type { ExamSitting } from "@/lib/exam-calendar";
import {
	collapseLetterSpacing,
	cutSection,
	inferSubjects,
	mergeLand,
	type ParsedOffice,
	parseSittings,
	parseStand,
} from "./parse";

const shape = (sittings: ExamSitting[]) =>
	sittings.map(({ start, end, days }) => ({
		start,
		end,
		days: days.map((d) => (d.subject ? `${d.date} ${d.subject}` : d.date)),
	}));

describe("parseSittings", () => {
	test("Hamm: weekday, two-digit year, subject", () => {
		const text = `Aufsichtsarbeiten Aufsichtsarbeiten
Do 21.01.27 SR Mo 22.02.27 ÖR
Fr 22.01.27 ZR Di 23.02.27 ÖR
Mo 25.01.27 ZR Do 25.02.27 SR
Di 26.01.27 ZR Fr 26.02.27 ZR
Do 28.01.27 ÖR Mo 01.03.27 ZR
Fr 29.01.27 ÖR Di 02.03.27 ZR
Stand Juni 2026`;
		expect(shape(parseSittings(text))).toEqual([
			{
				start: "2027-01-21",
				end: "2027-01-29",
				days: [
					"2027-01-21 SR",
					"2027-01-22 ZR",
					"2027-01-25 ZR",
					"2027-01-26 ZR",
					"2027-01-28 ÖR",
					"2027-01-29 ÖR",
				],
			},
			{
				start: "2027-02-22",
				end: "2027-03-02",
				days: [
					"2027-02-22 ÖR",
					"2027-02-23 ÖR",
					"2027-02-25 SR",
					"2027-02-26 ZR",
					"2027-03-01 ZR",
					"2027-03-02 ZR",
				],
			},
		]);
	});

	test("Köln: subject first, two columns per line are not cross-paired", () => {
		const text = `klausurfreier MonatSR Donnerstag, 22.01.2026 ZR Montag, 23.02.2026
ZR Freitag, 23.01.2026 ZR Dienstag, 24.02.2026
ZR Montag, 26.01.2026 ZR Donnerstag, 26.02.2026
ZR Dienstag, 27.01.2026 SR Freitag, 27.02.2026
ÖR Donnerstag, 29.01.2026 ÖR Montag, 02.03.2026
ÖR Freitag, 30.01.2026 ÖR Dienstag, 03.03.2026`;
		const [january, february] = shape(parseSittings(text));
		expect(january.days[0]).toBe("2026-01-22 SR");
		expect(february.days).toEqual([
			"2026-02-23 ZR",
			"2026-02-24 ZR",
			"2026-02-26 ZR",
			"2026-02-27 SR",
			"2026-03-02 ÖR",
			"2026-03-03 ÖR",
		]);
	});

	test("Hamm 2026: split columns are unreadable rather than half-read", () => {
		const text = `Stand: 19.11.2024
Do 22.01.26 StR Mo 23.02.26 ZR
Di 24.02.26 ZR
Do 26.02.26 ZR
Fr 27.02.26 SR
Mo 02.03.26 ÖR
Di 03.03.26 ÖR
Fr
Mo
Di
23.01.26
26.01.26
27.01.26
ZR
ZR
ZR
Do 29.01.26
30.01.26
ÖR Di 28.04.26 ZR
Fr 30.01.26 ÖR Do 30.04.26 ZR`;
		expect(() => parseSittings(text)).toThrow();
	});

	test("Berlin: seven exams with two in criminal law, the EuR exam is skipped", () => {
		const text = `April 2027
Wochentag Datum FUB, HUB, Pdm Viadrina
Montag 19.04.2027 EuR (nur ELS) EuR
Dienstag 20.04.2027 S I S I
Donnerstag 22.04.2027 S II S II
Freitag 23.04.2027 ÖR I ÖR I
Montag 26.04.2027 ÖR II ÖR II
Dienstag 27.04.2027 Z I Z I
Donnerstag 29.04.2027 Z II Z II
Freitag 30.04.2027 Z III`;
		expect(shape(parseSittings(text))).toEqual([
			{
				start: "2027-04-20",
				end: "2027-04-30",
				days: [
					"2027-04-20 SR",
					"2027-04-22 SR",
					"2027-04-23 ÖR",
					"2027-04-26 ÖR",
					"2027-04-27 ZR",
					"2027-04-29 ZR",
					"2027-04-30 ZR",
				],
			},
		]);
	});

	test("Schleswig-Holstein: prose days without subjects, the letter date is ignored", () => {
		const text =
			"Schleswig, 12. August 2026Bekanntmachung Für die Aufsichtsarbeiten der staatlichen Pflichtfachprüfung im Jahre 2027 sind zum jetzigen Zeitpunkt folgende Termine vorgesehen.– Di. 19., Do. 21., Fr. 22., Mo. 25., Di. 26., Do. 28. und Fr. 29. Januar 2027– Di. 20., Do. 22., Fr. 23., Mo. 26., Di. 27., Do. 29. und Fr. 30. Juli 2027Hinweis";
		expect(shape(parseSittings(text))).toEqual([
			{
				start: "2027-01-19",
				end: "2027-01-29",
				days: [
					"2027-01-19",
					"2027-01-21",
					"2027-01-22",
					"2027-01-25",
					"2027-01-26",
					"2027-01-28",
					"2027-01-29",
				],
			},
			{
				start: "2027-07-20",
				end: "2027-07-30",
				days: [
					"2027-07-20",
					"2027-07-22",
					"2027-07-23",
					"2027-07-26",
					"2027-07-27",
					"2027-07-29",
					"2027-07-30",
				],
			},
		]);
	});

	test("Bremen: letter-spaced PDF text, the registration deadline is not an exam day", () => {
		const text = collapseLetterSpacing(`Aufsichtsarbeiten Anmeldungen bis
I
M o , 2 2 . F e b r u a r 2 0 2 7
D i , 2 3 . F e b r u a r 2 0 2 7
D o , 2 5 . F e b r u a r 2 0 2 7
F r , 2 6 . F e b r u a r 2 0 2 7
M o , 0 1 . M ä r z 2 0 2 7
D i , 0 2 . M ä r z 2 0 2 7
D o n n e r s t a g ,
0 5 . J a n u a r 2 0 2 7
I I`);
		expect(shape(parseSittings(text))).toEqual([
			{
				start: "2027-02-22",
				end: "2027-03-02",
				days: [
					"2027-02-22",
					"2027-02-23",
					"2027-02-25",
					"2027-02-26",
					"2027-03-01",
					"2027-03-02",
				],
			},
		]);
	});

	test("Niedersachsen: numbered subjects in brackets, the registration period is ignored", () => {
		const text = `Prüfungsdurchgang B/2027
Meldezeitraum: 16.11. – 27.11.2026
Klausuren: 22. (SR) April 2027
23. (ÖR1), 26. (ÖR2), April 2027
27. (ZR1), 29. (ZR2), 30.(ZR3) April 2027
Mündliche Prüfung: Ab Anfang September 2027`;
		expect(shape(parseSittings(text))[0].days).toEqual([
			"2027-04-22 SR",
			"2027-04-23 ÖR",
			"2027-04-26 ÖR",
			"2027-04-27 ZR",
			"2027-04-29 ZR",
			"2027-04-30 ZR",
		]);
	});

	test("Baden-Württemberg: only the written exam range, other dates ignored", () => {
		const text = `Ende der Meldefrist: 31. Oktober 2026
schriftliche Prüfungen: 03. März bis 11. März 2027
mündliche Prüfungen: ab 21. Juni 2027
Die Veröffentlichung der Ergebnisse im Internet ist am 09. Juni 2027 ab 12:00`;
		expect(parseSittings(text)).toEqual([
			{ start: "2027-03-03", end: "2027-03-11", days: [] },
		]);
	});

	test("Bayern: table ranges, a missing space and a range across months", () => {
		const text =
			"Prüfungstage der schriftlichen Prüfung Meldeschluss 2026/1 4. mit 11. März 2026 23. Dezember 2025 2026/2 9. mit 16. September2026 8. Mai 2026 2029/2 29. August mit 5. September 2029 28. April 2029 ";
		expect(parseSittings(text)).toEqual([
			{ start: "2026-03-04", end: "2026-03-11", days: [] },
			{ start: "2026-09-09", end: "2026-09-16", days: [] },
			{ start: "2029-08-29", end: "2029-09-05", days: [] },
		]);
	});

	test("Thüringen: weekday glued to the date", () => {
		const text = cutSection(
			"Voraussichtliche Termine zur Anfertigung der Aufsichtsarbeiten der staatlichen Pflichtfachprüfung Montag22.02.2027Dienstag23.02.2027Donnerstag25.02.2027Freitag26.02.2027Montag01.03.2027Dienstag02.03.2027Meldeschluss:Freitag, der 23. Oktober 2026",
			[/Voraussichtliche Termine/, /Meldeschluss/],
		);
		expect(shape(parseSittings(text))[0]).toMatchObject({
			start: "2027-02-22",
			end: "2027-03-02",
		});
	});

	test("sittings a week apart split at the month end", () => {
		const text = `Mo 22.11.27 ZR Mi 08.12.27 ZR
Di 23.11.27 ZR Do 16.12.27 ZR
Do 25.11.27 ZR Fr 17.12.27 ZR
Fr 26.11.27 SR Mo 20.12.27 SR
Mo 29.11.27 ÖR Di 21.12.27 ÖR
Di 30.11.27 ÖR Do 23.12.27 ÖR`;
		expect(
			parseSittings(text).map(({ start, end }) => `${start}..${end}`),
		).toEqual(["2027-11-22..2027-11-30", "2027-12-08..2027-12-23"]);
	});

	test("a weekday that does not match the date is an error", () => {
		const text = `Montag22.02.2027Dienstag23.02.2027Donnerstag25.02.2027Freitag26.02.2027Montag01.03.2027Mittwoch02.03.2027`;
		expect(() => parseSittings(text)).toThrow("2027-03-02");
	});

	test("subjects must cover all three fields", () => {
		const text = `21.01.2027 SR
22.01.2027 ZR
25.01.2027 ZR
26.01.2027 ZR
28.01.2027 ZR
29.01.2027 ZR`;
		expect(() => parseSittings(text)).toThrow("ÖR");
	});
});

describe("parseStand", () => {
	test("reads the three stamp forms", () => {
		expect(parseStand("Stand: 11.06.2026")).toBe("2026-06-11");
		expect(parseStand("(ohne Gewähr) Stand Juni 2026 Januar 2027")).toBe(
			"2026-06",
		);
		expect(parseStand("Letzte Aktualisierung: 12.08.2026 Inhalte")).toBe(
			"2026-08-12",
		);
		expect(parseStand("Schleswig, 12. August 2026")).toBeNull();
	});
});

const sitting = (
	start: string,
	end: string,
	days: [string, string?][] = [],
): ExamSitting => ({
	start,
	end,
	days: days.map(([date, subject]) =>
		subject ? { date, subject: subject as "ZR" | "ÖR" | "SR" } : { date },
	),
});

const office = (
	slug: string,
	documents: ParsedOffice["documents"],
): ParsedOffice => ({ slug, land: "Nordrhein-Westfalen", documents });

describe("mergeLand", () => {
	const jan = sitting("2027-01-21", "2027-01-29");
	const feb = sitting("2027-02-22", "2027-03-02");

	test("unions the offices' sittings by start", () => {
		const { sittings } = mergeLand([
			office("köln", [
				{ url: "k", year: 2027, result: { sittings: [jan, feb] } },
			]),
			office("hamm", [{ url: "h", year: 2027, result: { sittings: [jan] } }]),
		]);
		expect(sittings).toEqual([jan, feb]);
	});

	test("two offices disagreeing on a sitting is fatal", () => {
		const other = sitting("2027-01-21", "2027-01-28");
		expect(() =>
			mergeLand([
				office("köln", [{ url: "k", year: 2027, result: { sittings: [jan] } }]),
				office("hamm", [
					{ url: "h", year: 2027, result: { sittings: [other] } },
				]),
			]),
		).toThrow("disagree");
	});

	test("an unreadable document is a warning only when another office covers its year", () => {
		const unreadable = { url: "h", year: 2027, result: { error: "scrambled" } };
		const { sittings, warnings } = mergeLand([
			office("hamm", [unreadable]),
			office("köln", [{ url: "k", year: 2027, result: { sittings: [jan] } }]),
		]);
		expect(sittings).toEqual([jan]);
		expect(warnings).toHaveLength(1);
		expect(() =>
			mergeLand([
				office("hamm", [unreadable]),
				office("köln", [{ url: "k", year: 2028, result: { sittings: [] } }]),
			]),
		).toThrow("scrambled");
	});

	test("keeps earlier sittings that the source no longer lists", () => {
		const july = sitting("2026-07-20", "2026-07-30");
		const fresh = [
			office("thüringen", [
				{ url: "t", year: null, result: { sittings: [feb] } },
			]),
		];
		const { sittings } = mergeLand(fresh, [july, jan]);
		expect(sittings).toEqual([july, jan, feb]);
		expect(mergeLand(fresh, sittings).sittings).toEqual(sittings);
	});
});

describe("inferSubjects", () => {
	const nrwJanuary = sitting("2027-01-21", "2027-01-29", [
		["2027-01-21", "SR"],
		["2027-01-22", "ZR"],
		["2027-01-25", "ZR"],
		["2027-01-26", "ZR"],
		["2027-01-28", "ÖR"],
		["2027-01-29", "ÖR"],
	]);
	const shJanuary = sitting(
		"2027-01-19",
		"2027-01-29",
		["19", "21", "22", "25", "26", "28", "29"].map((d) => [`2027-01-${d}`]),
	);

	test("copies subjects from other Länder writing the same days", () => {
		const result = inferSubjects({
			"Nordrhein-Westfalen": [nrwJanuary],
			Niedersachsen: [nrwJanuary],
			"Schleswig-Holstein": [shJanuary],
		});
		const [inferred] = result["Schleswig-Holstein"] ?? [];
		expect(inferred.subjectsFrom).toEqual([
			"Niedersachsen",
			"Nordrhein-Westfalen",
		]);
		expect(inferred.days.map((d) => d.subject ?? null)).toEqual([
			null,
			"SR",
			"ZR",
			"ZR",
			"ZR",
			"ÖR",
			"ÖR",
		]);
		expect(result["Nordrhein-Westfalen"]).toEqual([nrwJanuary]);
	});

	test("Länder disagreeing on a day's subject is fatal", () => {
		const swapped = {
			...nrwJanuary,
			days: nrwJanuary.days.map((d) =>
				d.date === "2027-01-21" ? { ...d, subject: "ZR" as const } : d,
			),
		};
		expect(() =>
			inferSubjects({
				"Nordrhein-Westfalen": [nrwJanuary],
				Niedersachsen: [swapped],
				"Schleswig-Holstein": [shJanuary],
			}),
		).toThrow("2027-01-21");
	});

	test("never infers from an inferred sitting or from a sitting reaching outside", () => {
		const inferred = { ...nrwJanuary, subjectsFrom: ["Bayern" as const] };
		const longer = sitting("2027-01-20", "2027-01-29", [
			["2027-01-20", "SR"],
			...nrwJanuary.days.map((d): [string, string?] => [d.date, d.subject]),
		]);
		const result = inferSubjects({
			"Nordrhein-Westfalen": [inferred],
			Niedersachsen: [longer],
			"Schleswig-Holstein": [shJanuary],
		});
		expect(result["Schleswig-Holstein"]).toEqual([shJanuary]);
	});
});
