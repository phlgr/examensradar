import { load } from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";
import type { ExamSitting, OfficeSource } from "@/lib/exam-calendar";
import { SITTINGS_BY_LAND as PREVIOUS } from "@/lib/exam-calendar.data";
import { LAENDER, type Land } from "@/lib/laender";
import {
	collapseLetterSpacing,
	cutSection,
	inferSubjects,
	mergeLand,
	type ParsedDocument,
	parseSittings,
	parseStand,
} from "./exam-calendar/parse";

const OUTPUT = "./src/lib/exam-calendar.data.ts";
const USER_AGENT = "Mozilla/5.0";

interface Source {
	slug: string;
	land: Land;
	pageUrl: string;
	/** "page" reads the page itself; a regex picks linked documents by link text or URL, its `year` group naming the year. */
	documents: "page" | RegExp;
	section?: readonly [RegExp, RegExp];
}

const SOURCES: Source[] = [
	{
		slug: "hamm",
		land: "Nordrhein-Westfalen",
		pageUrl:
			"https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/02_staatl_pflichtfachpruefung/04_termine/01_aufsichtsarbeiten-schriftlich/",
		documents: /Jahresübersicht\s+(?<year>\d{4})/,
	},
	{
		slug: "köln",
		land: "Nordrhein-Westfalen",
		pageUrl:
			"https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/003_staatl-pflichtfachpruefung/003_aufsichtsarbeiten/002_terminuebersicht_2026/",
		documents: /Klausurtermine\s+(?<year>\d{4})/,
	},
	{
		slug: "düsseldorf",
		land: "Nordrhein-Westfalen",
		pageUrl:
			"https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06jpa-a-z/06aufsichtsarbeiten/",
		documents: /Klausurtermine\s+(?<year>\d{4})/,
	},
	{
		slug: "berlin-brandenburg",
		land: "Berlin",
		pageUrl:
			"https://www.berlin.de/sen/justiz/juristenausbildung/juristische-pruefungen/artikel.263624.php",
		documents: /klausurtermine-(?<year>\d{4})-1ex\.pdf/,
	},
	{
		slug: "schleswig-holstein",
		land: "Schleswig-Holstein",
		pageUrl:
			"https://www.schleswig-holstein.de/DE/justiz/gerichte-und-justizbehoerden/OLG/Aufgaben/Justizpruefungsamt/Termine/Klausurtermine",
		documents: "page",
	},
	{
		slug: "bremen",
		land: "Bremen",
		pageUrl:
			"https://www.oberlandesgericht.bremen.de/informationen/justizpruefungsamt/aktuelle-termine-1708",
		documents: /Termine Aufsichtsarbeiten\s+(?<year>\d{4})/,
	},
	{
		slug: "niedersachsen",
		land: "Niedersachsen",
		pageUrl:
			"https://justizportal.niedersachsen.de/startseite/karriere/landesjustizprufungsamt/staatliche_pflichtfachprufung_und_erste_prufung/meldung-zum-examen-158112.html",
		documents: /Terminplan[ _](?<year>\d{4})[ _]Neurecht/,
	},
	{
		slug: "baden-württemberg",
		land: "Baden-Württemberg",
		pageUrl:
			"https://jum.baden-wuerttemberg.de/de/justiz/justizpruefungsamt/juristenausbildung-und-pruefungen/staatspruefung-in-der-ersten-juristischen-pruefung",
		documents: /Examenstermin\s+(?:Frühjahr|Herbst)\s+(?<year>\d{4})/,
	},
	{
		slug: "bayern",
		land: "Bayern",
		pageUrl:
			"https://www.justiz.bayern.de/landesjustizpruefungsamt/erste-juristische-staatspruefung/",
		documents: "page",
		section: [/Prüfungstage der schriftlichen Prüfung/, /Hinweis/],
	},
	{
		slug: "thüringen",
		land: "Thüringen",
		pageUrl: "https://justiz.thueringen.de/jpa/pflichtfachpruefung",
		documents: "page",
		section: [
			/Voraussichtliche Termine zur Anfertigung der Aufsichtsarbeiten/,
			/Meldeschluss/,
		],
	},
];

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url, {
		headers: { "user-agent": USER_AGENT },
		signal: AbortSignal.timeout(30_000),
	}).catch((error) => {
		throw new Error(`${url}: ${error}`);
	});
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

const isPdf = (bytes: Uint8Array) =>
	new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";

async function documentText(bytes: Uint8Array): Promise<string> {
	if (isPdf(bytes)) {
		const { text } = await extractText(await getDocumentProxy(bytes), {
			mergePages: true,
		});
		return collapseLetterSpacing(text);
	}
	const $ = load(new TextDecoder().decode(bytes));
	$("script, style, noscript").remove();
	return $("body").text().replace(/\s+/g, " ");
}

function documentLinks(source: Source, pattern: RegExp, html: string) {
	const $ = load(html);
	const links: { url: string; year: number }[] = [];
	$("a[href]").each((_, a) => {
		const href = $(a).attr("href") ?? "";
		const year = `${$(a).text()} ${href}`.match(pattern)?.groups?.year;
		const url = new URL(href, source.pageUrl).href;
		if (year && !links.some((link) => link.url === url))
			links.push({ url, year: Number(year) });
	});
	if (links.length === 0)
		throw new Error(`${source.slug}: no calendar links on ${source.pageUrl}`);
	return links;
}

async function loadSource(source: Source) {
	const page = await fetchBytes(source.pageUrl);
	const targets =
		source.documents === "page"
			? [{ url: source.pageUrl, year: null }]
			: documentLinks(source, source.documents, new TextDecoder().decode(page));

	const documents: ParsedDocument[] = [];
	const stands: string[] = [];
	for (const { url, year } of targets) {
		const full = await documentText(
			url === source.pageUrl ? page : await fetchBytes(url),
		);
		const text = source.section ? cutSection(full, source.section) : full;
		const stand = parseStand(text);
		if (stand) stands.push(stand);
		const label = year ? `${source.slug} ${year}` : source.slug;
		try {
			const sittings = parseSittings(text);
			const outside = sittings.find(
				(s) => year && !s.start.startsWith(`${year}-`),
			);
			if (outside)
				throw new Error(`sitting ${outside.start} is not in ${year}`);
			documents.push({ url, year, result: { sittings } });
			console.log(`${label}: ${sittings.length} sittings (${url})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			documents.push({ url, year, result: { error: message } });
			console.log(`${label}: unreadable, ${message} (${url})`);
		}
	}
	return {
		office: { slug: source.slug, land: source.land, documents },
		stand: stands.sort().at(-1) ?? null,
	};
}

const loaded: Awaited<ReturnType<typeof loadSource>>[] = [];
for (const source of SOURCES) loaded.push(await loadSource(source));

const merged: Partial<Record<Land, ExamSitting[]>> = {};
for (const land of LAENDER) {
	const offices = loaded
		.map(({ office }) => office)
		.filter((office) => office.land === land);
	if (offices.length === 0) continue;
	const { sittings, warnings } = mergeLand(offices, PREVIOUS[land]);
	for (const warning of warnings) console.warn(`Warning: ${warning}`);
	merged[land] = sittings;
}
const sittingsByLand = inferSubjects(merged);

const sources: Record<string, OfficeSource> = Object.fromEntries(
	SOURCES.map(({ slug, land, pageUrl }, i) => [
		slug,
		{ land, pageUrl, stand: loaded[i].stand },
	]),
);

await Bun.write(
	OUTPUT,
	`// Generated by scripts/update-exam-calendar.ts (bun run calendar:update). Do not edit.
import type { ExamSitting, OfficeSource } from "@/lib/exam-calendar";
import type { Land } from "@/lib/laender";

export const SITTINGS_BY_LAND: Partial<Record<Land, readonly ExamSitting[]>> = ${JSON.stringify(sittingsByLand)};

export const OFFICE_SOURCES: Record<string, OfficeSource> = ${JSON.stringify(sources)};
`,
);
const format = Bun.spawnSync(["bunx", "biome", "format", "--write", OUTPUT]);
if (format.exitCode !== 0) throw new Error(format.stderr.toString());

console.log(
	`Wrote ${Object.entries(sittingsByLand)
		.map(([land, sittings]) => `${land}=${sittings?.length}`)
		.join(" ")}`,
);
