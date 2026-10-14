import { describe, expect, test } from "bun:test";
import { LAENDER, parsePflichtfachTable } from "./bfj-statistics";

/**
 * One table row as unpdf extracts it: German thousands separators, a
 * percentage after every count, and (since 2017) the "endgültig" pair last.
 */
function row(examined: number, failed: number, withFinal: boolean): string {
	const passed = examined - failed;
	// All passes land on "befriedigend"; enough to check the column mapping.
	const counts = [
		examined,
		Math.round(examined * 0.6),
		passed,
		Math.round(passed * 0.6),
		0,
		0,
		0,
		passed,
		0,
		failed,
		Math.round(failed * 0.7),
		...(withFinal ? [3] : []),
	];
	const format = (n: number) => n.toLocaleString("de-DE");
	return counts
		.flatMap((n, i) =>
			// "dar. Frauen" of examined is column 2, its % column 3, and so on —
			// every count except the first is followed by a percentage.
			i === 0 ? [format(n)] : [format(n), "12,3"],
		)
		.join(" ");
}

const HYPHENATED: Record<string, string> = {
	"Baden-Württemberg": "Baden-Würt-\ntemberg 3 4 7",
	Brandenburg: "Branden\nburg",
	"Mecklenburg-Vorpommern": "Mecklenburg-\nVorpommern 3 4\n7\n",
	"Nordrhein-Westfalen": "Nordrhein-\nWestfalen 6)",
};

function edition({
	withFinal,
	splitAfter = LAENDER.length,
}: {
	withFinal: boolean;
	splitAfter?: number;
}): string[] {
	const columns = withFinal ? 24 : 22;
	const header = [
		"Bundesamt für Justiz",
		"Referat III 3 Ausbildungsstatistik Stand: 11. Juni 2026",
		"Übersicht über die Ergebnisse der staatlichen Pflichtfachprüfung im Jahre 2024 (neues Recht) 1 2",
		"Land Geprüfte Kandidaten Von den geprüften Kandidaten",
		"Zahl %",
		"Sp 2",
		Array.from({ length: columns }, (_, i) => i + 1).join(" "),
	].join("\n");
	const lines = LAENDER.map((land, i) => {
		const label = HYPHENATED[land] ?? land;
		const separator = label.endsWith("\n") ? "" : " ";
		return `${label}${separator}${row(1000 + i, 300, withFinal)}`;
	});
	const total = row(
		LAENDER.reduce((sum, _, i) => sum + 1000 + i, 0),
		300 * LAENDER.length,
		withFinal,
	);
	const first = lines.slice(0, splitAfter);
	const second = lines.slice(splitAfter);
	return [
		"Übersicht über die Ergebnisse der Ersten Juristischen Prüfung im Jahre 2024",
		`${header}\n${first.join("\n")}${second.length === 0 ? `\nZusammen ${total}` : ""}`,
		...(second.length > 0
			? [`${header}\n${second.join("\n")}\nZusammen ${total}`]
			: []),
		"Übersicht über die Ergebnisse der Freiversuche",
	];
}

describe("parsePflichtfachTable", () => {
	test("reads every Land, hyphenated names and footnotes included", () => {
		const result = parsePflichtfachTable(edition({ withFinal: true }));
		expect(result?.year).toBe(2024);
		expect(result?.asOf).toBe("2026-06-11");
		expect(Object.keys(result?.laender ?? {})).toEqual([...LAENDER]);
		expect(result?.laender["Nordrhein-Westfalen"]).toEqual({
			examined: 1009,
			examinedWomen: 605,
			passed: 709,
			grades: {
				sehrGut: 0,
				gut: 0,
				vollbefriedigend: 0,
				befriedigend: 709,
				ausreichend: 0,
			},
			failed: 300,
			failedWomen: 210,
			failedFinal: 3,
		});
		expect(result?.laender["Baden-Württemberg"].examined).toBe(1000);
		expect(result?.laender.Brandenburg.examined).toBe(1003);
		expect(result?.laender["Mecklenburg-Vorpommern"].examined).toBe(1007);
		expect(result?.total.examined).toBe(16_120);
	});

	test("keeps Sachsen and Sachsen-Anhalt apart", () => {
		const result = parsePflichtfachTable(edition({ withFinal: true }));
		expect(result?.laender.Sachsen.examined).toBe(1012);
		expect(result?.laender["Sachsen-Anhalt"].examined).toBe(1013);
	});

	test("follows the table onto the next page", () => {
		const result = parsePflichtfachTable(
			edition({ withFinal: true, splitAfter: 12 }),
		);
		expect(result?.laender.Thüringen.examined).toBe(1015);
	});

	test("editions before 2017 have no 'endgültig nicht bestanden' column", () => {
		const result = parsePflichtfachTable(edition({ withFinal: false }));
		expect(result?.laender.Bayern.failed).toBe(300);
		expect(result?.laender.Bayern.failedFinal).toBeNull();
	});

	test("refuses a table whose numbers don't add up", () => {
		const pages = edition({ withFinal: true });
		pages[1] = pages[1].replace(/^Bayern (\S+)/m, "Bayern 9.999");
		expect(() => parsePflichtfachTable(pages)).toThrow(/Bayern/);
	});

	test("null for editions without the table", () => {
		expect(parsePflichtfachTable(["Erste juristische Staatsprüfung"])).toBe(
			null,
		);
	});
});
