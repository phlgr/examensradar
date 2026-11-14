import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { extractContent } from "../lib/scraper.ts";
import { TEST_DB_PATH } from "../test-setup.ts";
import { getJpas } from "./index.ts";

const MIGRATION = "./drizzle/migrations/0009_add-non-nrw-jpas.sql";

const expected = [
	["berlin-brandenburg", "Berlin", ".modul-download__left"],
	["schleswig-holstein", "Schleswig-Holstein", "main .s-richtext"],
	["bremen", "Bremen", "main"],
	["niedersachsen", "Niedersachsen", "#articleContent_158132"],
	[
		"baden-württemberg",
		"Baden-Württemberg",
		'.article__section:has(a[href$=".pdf"])',
	],
	[
		"bayern",
		"Bayern",
		'dt:contains("Aktuelles / Weiteres") + dd li:has(a[href$="mdl.htm"]) strong',
	],
	["thüringen", "Thüringen", "main section.th-box .th-media h2"],
] as const;

const migratedRows = async () => {
	const slugs = new Set<string>(expected.map(([slug]) => slug));
	return (await getJpas()).filter((jpa) => slugs.has(jpa.slug));
};

test("the migration seeds the seven non-NRW offices with their land and selector", async () => {
	const rows = await migratedRows();

	expect(
		rows.map((jpa) => [jpa.slug, jpa.land, jpa.scrapeSelector]).sort(),
	).toEqual(expected.map((row) => [...row]).sort());
	for (const jpa of rows) {
		expect(jpa.scrapeUrl).toBe(jpa.websiteUrl);
		expect(jpa.scrapeUrl).toStartWith("https://");
		expect(jpa.notificationsDisabled).toBe(false);
	}
});

test("the offices carry the short JPA / LJPA name", async () => {
	const names = Object.fromEntries(
		(await migratedRows()).map((jpa) => [jpa.slug, jpa.name]),
	);

	expect(names).toEqual({
		"berlin-brandenburg": "GJPA Berlin-Brandenburg",
		"schleswig-holstein": "JPA Schleswig-Holstein",
		bremen: "JPA Bremen",
		niedersachsen: "LJPA Niedersachsen",
		"baden-württemberg": "LJPA Baden-Württemberg",
		bayern: "LJPA Bayern",
		thüringen: "JPA Thüringen",
	});
});

test("every migrated selector is valid for the scraper's selector engine", () => {
	for (const [, , selector] of expected) {
		expect(extractContent("<html><body></body></html>", selector)).toEqual({
			matched: false,
		});
	}
});

test("re-running the migration leaves the rows untouched", async () => {
	const before = await migratedRows();
	const sqlite = new Database(TEST_DB_PATH);
	sqlite.run(await Bun.file(MIGRATION).text());
	sqlite.close();

	expect(await migratedRows()).toEqual(before);
});
