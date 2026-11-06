import { describe, expect, test } from "bun:test";
import {
	indexAssignments,
	mergeRows,
	ORAL_EXAM_SOURCES,
	upcomingAssignments,
} from "./oral-exams.ts";

const { hamm, köln, düsseldorf } = ORAL_EXAM_SOURCES;

const hammPdf = `Die Vorsitzende des Justizprüfungsamtes
bei dem Oberlandesgericht Hamm
Termine und Orte der mündlichen Prüfungen
im Monat November 2026
Prüfungsdatum Prüfungsort
04.11.2026 OLG Hamm
04.11.2026 OLG Hamm
04.11.2026 LG Bielefeld Nst Ref
06.11.2026 OLG Hamm
- 2 -
Prüfungsdatum Prüfungsort
11.11.2026 Uni Münster (U)
Anschriften der Prüfungssäle
Bielefeld Landgericht Bielefeld –Nebenstelle-,
Bahnhofstraße 46, 33602 Bielefeld, Eingang 01.01.2030`;

const koelnPdf = `Justizprüfungsamt bei dem Oberlandesgericht Köln
Mündliche Prüfungstermine
Wochentag Prüfungsdatum Raum
Freitag 13.11.2026 441
Freitag 13.11.2026 440A
Dienstag 17.11.2026 440A
Wochentag Prüfungsdatum Raum
Freitag 20.11.2026 441`;

const row = (date: string, room: string, panel: string, ids: string) => `
<tr>
<td width="93">${date}</td>
<td width="74">${room}</td>
<td width="274"><strong>Vorsitzender:</strong><br>${panel}<br><strong>Vortrag:</strong> Zivilrecht</td>
<td width="125"><p>${ids}</p></td>
</tr>`;

const EXAMINER = "Prof. Dr. Zacharias Quillfeder";
const OTHER_EXAMINER = "Richterin am LG Ottilie Brunnhofer";
const KENNZIFFER = "7741/26";

const duesseldorfHtml = `<table><tbody>
<tr><td><strong>Datum</strong></td><td><strong>Saal</strong></td><td><strong>Prüfungskommission</strong></td><td><strong>Kennziffer</strong></td></tr>
${row("04.11.2026", "B 2", EXAMINER, KENNZIFFER)}
${row("04.11.2026", "B&nbsp;3", OTHER_EXAMINER, `${KENNZIFFER}<br>1234/25`)}
${row("11.11.2026", "B 2", EXAMINER, "9/24")}
</tbody></table>
<p>Die Prüfungen finden im Gebäude des Oberlandesgerichts statt.</p>`;

const koelnRoom = (
	date: string,
	room: string,
	rows: string,
	footer: string,
) => `Prüferwechsel bleiben vorbehalten.
Telefonische Auskünfte werden NICHT erteilt.
${date}
Justizprüfungsamt bei dem
Oberlandesgericht Köln
Saal ${room}
${rows}
Herr VorsRiVG Zacharias Quillfeder, VG Köln (als Vorsitz)
Frau RD.in Ottilie Brunnhofer, BMVerteidigung
Herr Prof. Dr. Balthasar Wendelin, Uni Bochum
${footer}`;

const koelnNewLaw = koelnRoom(
	"02.10.2026",
	"440A",
	"Nr. Kennziffer\n1 6938/26\n2 0634/26",
	"Beginn der Prüfung: ca. 10.00 Uhr",
);
const koelnOldLaw = koelnRoom(
	"18.11.2026",
	"441",
	"Nr. Kennziffer Vorbereitung Vortrag\n1 3637/26 09:15 10:15\n2 2964/24 09:30 10:30",
	"Kurzvortrag: Strafrecht",
);
const EXAMINER_NAMES = [
	"Quillfeder",
	"Brunnhofer",
	"Wendelin",
	"Zacharias",
	"Ottilie",
	"Balthasar",
	"Prüferwechsel",
	"Kurzvortrag",
];

describe("Hamm", () => {
	test("reads one row per panel and ignores the address block", () => {
		expect(mergeRows(hamm.parse(hammPdf))).toEqual([
			{
				date: "2026-11-04",
				places: ["LG Bielefeld (Nebenstelle)", "OLG Hamm"],
			},
			{ date: "2026-11-06", places: ["OLG Hamm"] },
			{ date: "2026-11-11", places: ["Uni Münster"] },
		]);
	});

	test("rejects a document without rows", () => {
		expect(() => hamm.parse("Termine und Orte\nAnschriften")).toThrow();
	});

	test("rejects an exam on a weekend", () => {
		expect(() => hamm.parse("07.11.2026 OLG Hamm")).toThrow();
	});

	test("finds only the monthly place lists on the index page", () => {
		const base = "https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/";
		const html = `
			<a href="a/Orte-November.pdf">Termine und Orte der mündlichen Prüfungen staatliche Pflichtfachprüfung im Monat November 2026</a>
			<a href="a/Liste-Oktober.pdf">Liste der mündlichen Prüfungstermine der staatlichen Pflichtfachprüfung im Oktober 2026</a>
			<a href="a/Kennziffern.pdf">Kennziffernliste zur Anfertigung der Aufsichtsarbeiten</a>`;
		expect(hamm.documents(html)).toEqual([`${base}a/Orte-November.pdf`]);
	});
});

describe("Köln", () => {
	test("turns rooms into places and merges panels per day", () => {
		expect(mergeRows(köln.parse(koelnPdf))).toEqual([
			{ date: "2026-11-13", places: ["Raum 440A", "Raum 441"] },
			{ date: "2026-11-17", places: ["Raum 440A"] },
			{ date: "2026-11-20", places: ["Raum 441"] },
		]);
	});

	test("rejects a weekday that does not match the date", () => {
		expect(() => köln.parse("Montag 13.11.2026 441")).toThrow();
	});

	test("rejects a document without rows", () => {
		expect(() => köln.parse("Mündliche Prüfungstermine")).toThrow();
	});

	test("follows overview PDFs next to the index, not the per-day subfolders", () => {
		const folder = new URL(".", köln.indexUrl).href;
		const html = `
			<a href="002_oktober_mitte-november-2026_neues-Recht.pdf">Prüfungstermine Oktober</a>
			<a href="zw_002_termine/001_02_10_440A.pdf">02.10.2026 - Raum 440A - Freitag</a>
			<a href="index.php">Menü</a>`;
		expect(köln.documents(html)).toEqual([
			`${folder}002_oktober_mitte-november-2026_neues-Recht.pdf`,
		]);
	});
});

describe("Düsseldorf", () => {
	test("reads date and hall per panel", () => {
		expect(mergeRows(düsseldorf.parse(duesseldorfHtml))).toEqual([
			{ date: "2026-11-04", places: ["Saal B 2", "Saal B 3"] },
			{ date: "2026-11-11", places: ["Saal B 2"] },
		]);
	});

	test("never exposes examiner names or Kennziffern", () => {
		const output = JSON.stringify(düsseldorf.parse(duesseldorfHtml));
		for (const secret of [
			EXAMINER,
			OTHER_EXAMINER,
			"Quillfeder",
			"Brunnhofer",
			KENNZIFFER,
			"1234/25",
			"Vortrag",
		])
			expect(output).not.toContain(secret);
	});

	test("rejects a page without exam rows", () => {
		expect(() => düsseldorf.parse("<p>Keine Termine</p>")).toThrow();
	});

	test("links the month pages only", () => {
		const html = `
			<a href="06_11/index.php">November 2026</a>
			<a href="06_10/index.php">Oktober 2026</a>
			<a href="index.php?print=1">Drucken</a>`;
		const base = new URL(".", düsseldorf.indexUrl).href;
		expect(düsseldorf.documents(html)).toEqual([
			`${base}06_11/index.php`,
			`${base}06_10/index.php`,
		]);
	});
});

describe("Köln assignments", () => {
	const { assignments } = köln;

	test("reads Kennziffer, day, room and the announced start", () => {
		expect(assignments?.parse(koelnNewLaw)).toEqual([
			{
				kennziffer: "6938/26",
				date: "2026-10-02",
				place: "Raum 440A",
				start: "10:00",
			},
			{
				kennziffer: "634/26",
				date: "2026-10-02",
				place: "Raum 440A",
				start: "10:00",
			},
		]);
	});

	test("takes the preparation time per candidate for altes Recht", () => {
		expect(assignments?.parse(koelnOldLaw)).toEqual([
			{
				kennziffer: "3637/26",
				date: "2026-11-18",
				place: "Raum 441",
				start: "09:15",
			},
			{
				kennziffer: "2964/24",
				date: "2026-11-18",
				place: "Raum 441",
				start: "09:30",
			},
		]);
	});

	test("never keeps examiner names", () => {
		const output = JSON.stringify(
			indexAssignments([
				...(assignments?.parse(koelnNewLaw) ?? []),
				...(assignments?.parse(koelnOldLaw) ?? []),
			]),
		);
		for (const name of EXAMINER_NAMES) expect(output).not.toContain(name);
	});

	test("rejects a document without Kennziffern or without date", () => {
		expect(() =>
			assignments?.parse(koelnRoom("02.10.2026", "440A", "Nr. Kennziffer", "")),
		).toThrow();
		expect(() => assignments?.parse("Saal 440A\n1 6938/26")).toThrow();
	});

	test("follows the per-room PDFs in the subfolders only", () => {
		const folder = new URL(".", köln.indexUrl).href;
		const html = `
			<a href="002_oktober_mitte-november-2026_neues-Recht.pdf">Prüfungstermine Oktober</a>
			<a href="zw_002_termine/001_02_10_440A.pdf">02.10.2026 - Raum 440A - Freitag</a>
			<a href="zw_003_termine/001_18_11_441.pdf">18.11.2026 - Raum 441 - Mittwoch</a>
			<a href="index.php">Menü</a>`;
		expect(assignments?.documents(html)).toEqual([
			`${folder}zw_002_termine/001_02_10_440A.pdf`,
			`${folder}zw_003_termine/001_18_11_441.pdf`,
		]);
	});
});

describe("Düsseldorf assignments", () => {
	const { assignments } = düsseldorf;

	test("reads every Kennziffer of a panel with its day and hall", () => {
		expect(assignments?.parse(duesseldorfHtml)).toEqual([
			{ kennziffer: "7741/26", date: "2026-11-04", place: "Saal B 2" },
			{ kennziffer: "7741/26", date: "2026-11-04", place: "Saal B 3" },
			{ kennziffer: "1234/25", date: "2026-11-04", place: "Saal B 3" },
			{ kennziffer: "9/24", date: "2026-11-11", place: "Saal B 2" },
		]);
	});

	test("keeps <br>-separated entries apart", () => {
		const html = `<table>${row("04.11.2026", "B 2", EXAMINER, "1341/26<br>1712/26")}</table>`;
		expect(assignments?.parse(html)?.map((r) => r.kennziffer)).toEqual([
			"1341/26",
			"1712/26",
		]);
	});

	test("never keeps examiner names", () => {
		const output = JSON.stringify(
			indexAssignments(assignments?.parse(duesseldorfHtml) ?? []),
		);
		for (const name of [
			"Quillfeder",
			"Brunnhofer",
			"Zacharias",
			"Ottilie",
			"Vortrag",
			"Vorsitzender",
		])
			expect(output).not.toContain(name);
	});

	test("accepts a month whose Kennziffern are not published yet", () => {
		const html = `<table>${row("04.11.2026", "B 2", EXAMINER, "")}</table>`;
		expect(assignments?.parse(html)).toEqual([]);
	});

	test("rejects a page without exam rows", () => {
		expect(() => assignments?.parse("<p>Keine Termine</p>")).toThrow();
	});

	test("reads the same month pages as the day list", () => {
		const html = `<a href="06_11/index.php">November 2026</a><a href="x.php">Drucken</a>`;
		expect(assignments?.documents(html)).toEqual(düsseldorf.documents(html));
	});
});

describe("Hamm has no Kennziffer lists", () => {
	test("offers no assignment source", () => {
		expect(hamm.assignments).toBeUndefined();
	});
});

describe("assignment index", () => {
	const index = indexAssignments([
		{ kennziffer: "1/26", date: "2026-11-04", place: "Raum 441" },
		{
			kennziffer: "2/26",
			date: "2026-11-12",
			place: "Raum 442",
			start: "10:00",
		},
	]);

	test("is keyed by Kennziffer without repeating it in the value", () => {
		expect(index).toEqual({
			"1/26": { date: "2026-11-04", place: "Raum 441" },
			"2/26": { date: "2026-11-12", place: "Raum 442", start: "10:00" },
		});
	});

	test("keeps only exams from today on", () => {
		expect(Object.keys(upcomingAssignments(index, "2026-11-04"))).toEqual([
			"1/26",
			"2/26",
		]);
		expect(Object.keys(upcomingAssignments(index, "2026-11-05"))).toEqual([
			"2/26",
		]);
		expect(upcomingAssignments(index, "2026-11-13")).toEqual({});
	});
});
