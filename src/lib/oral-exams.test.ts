import { describe, expect, test } from "bun:test";
import { mergeRows, ORAL_EXAM_SOURCES } from "./oral-exams.ts";

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
