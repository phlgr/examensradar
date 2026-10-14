import { extractText, getDocumentProxy } from "unpdf";
import { type PflichtfachYear, parsePflichtfachTable } from "@/lib/bfj-statistics";

// Rebuilds src/data/bfj-pflichtfach.json from the Bundesamt für Justiz'
// Ausbildungsstatistik. The BfJ publishes once a year (the 2024 edition is
// dated June 2026), so this is a manual re-run rather than a job: bump
// LAST_YEAR when a new edition is out, run `bun run stats:bfj`, commit.
// The table exists since 2007, but until 2008 most candidates still sat the
// old-law Staatsprüfung (2007: 1,428 under new law nationwide), so those rates
// describe a self-selected minority and aren't comparable.
const FIRST_YEAR = 2009;
const LAST_YEAR = 2024;
const OUTPUT = "./src/data/bfj-pflichtfach.json";

const pdfUrl = (year: number) =>
	`https://www.bundesjustizamt.de/SharedDocs/Downloads/DE/Justizstatistiken/Juristenausbildung_${year}.pdf?__blob=publicationFile`;

const years: PflichtfachYear[] = [];
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
	const response = await fetch(pdfUrl(year));
	if (!response.ok) throw new Error(`${year}: HTTP ${response.status}`);
	const pdf = await getDocumentProxy(
		new Uint8Array(await response.arrayBuffer()),
	);
	const { text } = await extractText(pdf, { mergePages: false });
	const parsed = parsePflichtfachTable(text);
	if (!parsed) throw new Error(`${year}: no Pflichtfachprüfung table`);
	if (parsed.year !== year) {
		throw new Error(`${year}: edition is labelled ${parsed.year}`);
	}
	const failRate = ((parsed.total.failed / parsed.total.examined) * 100).toFixed(1);
	console.log(`${year}: ${parsed.total.examined} examined, ${failRate}% failed`);
	years.push(parsed);
}

await Bun.write(OUTPUT, `${JSON.stringify(years, null, "\t")}\n`);
console.log(`wrote ${years.length} years to ${OUTPUT}`);
