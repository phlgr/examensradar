import { describe, expect, test } from "bun:test";
import { countKennziffern, findFailedListLinks } from "./failed-lists";

describe("findFailedListLinks", () => {
	test("resolves Köln's relative link and reads the month from the file name", () => {
		const html = `<p>haben die Prüflinge mit den folgenden Kennziffern nicht bestanden:</p>
			<a href="0005_zw_information_2026_klausurenbloecke/Liste-Juni-2026.pdf">Liste</a>`;
		expect(
			findFailedListLinks(
				html,
				"https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/002_aktuelles/",
			),
		).toEqual([
			{
				url: "https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/002_aktuelles/0005_zw_information_2026_klausurenbloecke/Liste-Juni-2026.pdf",
				examMonth: "2026-06",
			},
		]);
	});

	test("Düsseldorf's link, against a page URL ending in a file", () => {
		const html = `<a href="Liste-M%C3%A4rz-2026.pdf">Liste März 2026</a>`;
		expect(
			findFailedListLinks(
				html,
				"https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06aktuelles/index.php",
			),
		).toEqual([
			{
				url: "https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06aktuelles/Liste-M%C3%A4rz-2026.pdf",
				examMonth: "2026-03",
			},
		]);
	});

	test("ignores PDFs that aren't a list, like Hamm's notice", () => {
		const html = `<a href="Informationen-2026_06.pdf">Informationen gem. § 20 Abs. 1 Nr. 1 JAG NW</a>
			<a href="002_fristen_meldung_2025.pdf">Fristen</a>
			<a href="liste.html">Liste</a>`;
		expect(findFailedListLinks(html, "https://example.org/")).toEqual([]);
	});

	test("unknown month stays null instead of guessing", () => {
		const html = `<a href="kennziffern.pdf">Liste</a>`;
		expect(findFailedListLinks(html, "https://example.org/")).toEqual([
			{ url: "https://example.org/kennziffern.pdf", examMonth: null },
		]);
	});
});

describe("countKennziffern", () => {
	test("counts each Kennziffer once, across years", () => {
		const text = `Juni-Klausuren nicht bestanden
2192/26 7063/26 7669/26
2639/24 7094/26
 1044/26
7063/26`;
		expect(countKennziffern(text)).toBe(6);
	});

	test("does not count the statute reference or dates", () => {
		const text =
			"Information gemäß § 20 Abs. 1 Nr. 1 JAG NRW\nStand 01/2026, 12.06.2026\n127/24";
		expect(countKennziffern(text)).toBe(1);
	});
});
