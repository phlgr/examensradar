import { expect, test } from "bun:test";
import { groupByLand, type Land } from "./laender";

const office = (name: string, land: Land | null) => ({ name, land });

test("groups offices by Land alphabetically, with unassigned offices last", () => {
	const groups = groupByLand([
		office("OLG Köln", "Nordrhein-Westfalen"),
		office("Landesjustizprüfungsamt Bayern", "Bayern"),
		office("Altes Amt", null),
		office("OLG Düsseldorf", "Nordrhein-Westfalen"),
		office("Justizprüfungsamt Bremen", "Bremen"),
	]);

	expect(groups.map((g) => [g.heading, g.offices.map((o) => o.name)])).toEqual([
		["Bayern", ["Landesjustizprüfungsamt Bayern"]],
		["Bremen", ["Justizprüfungsamt Bremen"]],
		["Nordrhein-Westfalen", ["OLG Düsseldorf", "OLG Köln"]],
		["Weitere", ["Altes Amt"]],
	]);
});

test("omits Weitere when every office has a Land", () => {
	const groups = groupByLand([office("OLG Hamm", "Nordrhein-Westfalen")]);
	expect(groups.map((g) => g.heading)).toEqual(["Nordrhein-Westfalen"]);
});

test("sorts Länder with umlauts by German collation", () => {
	const groups = groupByLand([
		office("A", "Thüringen"),
		office("B", "Sachsen"),
		office("C", "Baden-Württemberg"),
	]);
	expect(groups.map((g) => g.heading)).toEqual([
		"Baden-Württemberg",
		"Sachsen",
		"Thüringen",
	]);
});
