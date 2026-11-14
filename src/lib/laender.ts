export const LAENDER = [
	"Baden-Württemberg",
	"Bayern",
	"Berlin",
	"Brandenburg",
	"Bremen",
	"Hamburg",
	"Hessen",
	"Mecklenburg-Vorpommern",
	"Niedersachsen",
	"Nordrhein-Westfalen",
	"Rheinland-Pfalz",
	"Saarland",
	"Sachsen",
	"Sachsen-Anhalt",
	"Schleswig-Holstein",
	"Thüringen",
] as const;
export type Land = (typeof LAENDER)[number];

const NO_LAND_HEADING = "Weitere";

export function groupByLand<T extends { name: string; land: Land | null }>(
	offices: T[],
): { heading: string; offices: T[] }[] {
	const byName = (a: T, b: T) => a.name.localeCompare(b.name, "de");
	const groups: { heading: string; offices: T[] }[] = LAENDER.map((land) => ({
		heading: land,
		offices: offices.filter((office) => office.land === land).sort(byName),
	}))
		.filter((group) => group.offices.length > 0)
		.sort((a, b) => a.heading.localeCompare(b.heading, "de"));
	const unassigned = offices.filter((office) => office.land === null);
	if (unassigned.length > 0) {
		groups.push({
			heading: NO_LAND_HEADING,
			offices: unassigned.sort(byName),
		});
	}
	return groups;
}
