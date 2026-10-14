import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import bfjData from "@/data/bfj-pflichtfach.json";
import {
	LAENDER,
	type PflichtfachResult,
	type PflichtfachYear,
} from "@/lib/bfj-statistics";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/statistik/")({
	component: StatisticsPage,
});

const YEARS = bfjData as PflichtfachYear[];
const BFJ_URL =
	"https://www.bundesjustizamt.de/DE/Service/Justizstatistiken/Justizstatistiken_node.html";

const failRate = (r: PflichtfachResult) => r.failed / r.examined;
/** "Prädikat": vollbefriedigend or better, as a share of everyone examined. */
const praedikatRate = (r: PflichtfachResult) =>
	(r.grades.vollbefriedigend + r.grades.gut + r.grades.sehrGut) / r.examined;

const percent = (share: number) =>
	`${(share * 100).toLocaleString("de-DE", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	})}\u00a0%`;
const count = (n: number) => n.toLocaleString("de-DE");

const formatAsOf = (iso: string) =>
	new Date(iso).toLocaleDateString("de-DE", { dateStyle: "long" });

function formatExamMonth(examMonth: string | null): string {
	if (!examMonth) return "Klausuren";
	const [year, month] = examMonth.split("-").map(Number);
	const name = new Date(year, month - 1).toLocaleDateString("de-DE", {
		month: "long",
	});
	return `${name}-Klausuren ${year}`;
}

function FailedLists() {
	const listsQuery = trpc.jpa.getFailedLists.useQuery();
	const lists = listsQuery.data ?? [];
	if (lists.length === 0) return null;

	return (
		<section className="mb-14">
			<h2 className="text-2xl font-semibold leading-tight">
				Bei den Klausuren durchgefallen
			</h2>
			<p className="text-[15px] text-ink/55 mt-1 mb-5 max-w-2xl">
				Einige Prüfungsämter veröffentlichen jeden Monat die Kennziffern
				derjenigen, die schon an den Klausuren gescheitert sind. Wir zählen sie
				mit. Wie viele mitgeschrieben haben, steht dort nicht – eine
				Durchfallquote lässt sich daraus also nicht ablesen.
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				{lists.map((list) => (
					<Card key={list.url} className="p-5 flex items-end gap-5">
						<p className="headline text-5xl leading-none">
							{count(list.failedCount)}
						</p>
						<div className="min-w-0">
							<p className="font-semibold leading-tight">{list.jpaName}</p>
							<p className="text-[13px] text-ink/55 mt-0.5">
								{formatExamMonth(list.examMonth)} ·{" "}
								<a
									href={list.url}
									target="_blank"
									rel="noopener noreferrer"
									className="underline decoration-1 underline-offset-2 hover:decoration-2"
								>
									Liste
								</a>
							</p>
						</div>
					</Card>
				))}
			</div>
		</section>
	);
}

function Trend({ selected }: { selected: number }) {
	const max = Math.max(...YEARS.map((y) => failRate(y.total)));
	return (
		<div className="flex gap-1 sm:gap-1.5 items-end h-24">
			{YEARS.map((year) => {
				const rate = failRate(year.total);
				return (
					<div
						key={year.year}
						className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
						title={`${year.year}: ${percent(rate)} nicht bestanden (${count(year.total.failed)} von ${count(year.total.examined)})`}
					>
						<div
							className={cn(
								"w-full max-w-6 rounded-t-[3px]",
								year.year === selected ? "bg-seal" : "bg-ink/70",
							)}
							style={{ height: `${Math.round((rate / max) * 100)}%` }}
						/>
						<span className="figures text-[10px] text-ink/45">
							{String(year.year).slice(2)}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function LaenderTable({ year }: { year: PflichtfachYear }) {
	const rows = [...LAENDER].sort(
		(a, b) => failRate(year.laender[b]) - failRate(year.laender[a]),
	);
	const maxRate = failRate(year.laender[rows[0]]);
	const withFinal = year.total.failedFinal !== null;

	return (
		<Card className="overflow-x-auto">
			<table className="w-full text-[15px]">
				<thead>
					<tr className="text-left text-[13px] text-ink/50 border-b border-ink/10">
						<th className="font-medium px-5 py-3">Land</th>
						<th className="hidden sm:table-cell font-medium px-3 py-3 text-right">
							Geprüft
						</th>
						<th className="font-medium px-3 py-3 w-full sm:min-w-44">
							Nicht bestanden
						</th>
						<th className="font-medium px-3 py-3 text-right">Prädikat</th>
						{withFinal && (
							<th className="hidden sm:table-cell font-medium px-5 py-3 text-right">
								Endgültig
							</th>
						)}
					</tr>
				</thead>
				<tbody className="figures">
					{rows.map((land) => {
						const result = year.laender[land];
						const rate = failRate(result);
						return (
							<tr key={land} className="border-b border-ink/5 last:border-0">
								<td className="font-sans font-medium px-4 sm:px-5 py-2.5 sm:whitespace-nowrap">
									{land}
								</td>
								<td className="hidden sm:table-cell px-3 py-2.5 text-right text-ink/70">
									{count(result.examined)}
								</td>
								<td className="px-3 py-2.5">
									<div className="flex items-center gap-3">
										<span className="w-14 text-right shrink-0">
											{percent(rate)}
										</span>
										<div className="flex-1 min-w-8">
											<div
												className="h-2 rounded-r-[3px] bg-seal/80"
												style={{ width: `${(rate / maxRate) * 100}%` }}
												title={`${count(result.failed)} von ${count(result.examined)}`}
											/>
										</div>
									</div>
								</td>
								<td className="px-3 py-2.5 text-right text-ink/70">
									{percent(praedikatRate(result))}
								</td>
								{withFinal && (
									<td className="hidden sm:table-cell px-5 py-2.5 text-right text-ink/70">
										{count(result.failedFinal ?? 0)}
									</td>
								)}
							</tr>
						);
					})}
				</tbody>
				<tfoot className="figures">
					<tr className="border-t border-ink/10 font-semibold">
						<td className="font-sans px-5 py-3">Bundesweit</td>
						<td className="hidden sm:table-cell px-3 py-3 text-right">
							{count(year.total.examined)}
						</td>
						<td className="px-3 py-3">{percent(failRate(year.total))}</td>
						<td className="px-3 py-3 text-right">
							{percent(praedikatRate(year.total))}
						</td>
						{withFinal && (
							<td className="hidden sm:table-cell px-5 py-3 text-right">
								{count(year.total.failedFinal ?? 0)}
							</td>
						)}
					</tr>
				</tfoot>
			</table>
		</Card>
	);
}

function StatisticsPage() {
	const latest = YEARS[YEARS.length - 1];
	const [selectedYear, setSelectedYear] = useState(latest.year);
	const year = YEARS.find((y) => y.year === selectedYear) ?? latest;

	return (
		<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
			<div className="max-w-4xl mx-auto">
				<SectionIntro
					as="h1"
					title="Wie viele bestehen?"
					className="mb-10 sm:mb-14"
				>
					Zahlen zur staatlichen Pflichtfachprüfung: wie viele durchfallen, wie
					viele ein Prädikat schaffen – bundesweit und in jedem Land.
				</SectionIntro>

				<FailedLists />

				<Card className="p-6 sm:p-8 mb-12 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-10">
					<div className="sm:w-64 shrink-0">
						<p className="headline text-6xl sm:text-7xl leading-none">
							{percent(failRate(latest.total))}
						</p>
						<p className="text-lg mt-3">
							haben {latest.year} bundesweit nicht bestanden
						</p>
						<p className="text-[15px] text-ink/60 mt-1">
							{count(latest.total.failed)} von {count(latest.total.examined)}{" "}
							Prüflingen
						</p>
					</div>
					<div className="flex-1 min-w-0">
						<Eyebrow className="mb-2">
							Nicht bestanden, {YEARS[0].year}–{latest.year}
						</Eyebrow>
						<Trend selected={year.year} />
					</div>
				</Card>

				<div className="flex flex-wrap items-end justify-between gap-4 mb-5">
					<div>
						<h2 className="text-2xl font-semibold leading-tight">
							Nach Bundesland
						</h2>
						<p className="text-[15px] text-ink/55 mt-1">
							Sortiert nach dem Anteil, der nicht bestanden hat.
						</p>
					</div>
					<label className="text-sm font-medium text-ink/70 flex items-center gap-2">
						Jahr
						<select
							value={year.year}
							onChange={(event) => setSelectedYear(Number(event.target.value))}
							className="figures h-10 rounded-md bg-sheet ring-1 ring-ink/15 px-3 text-ink"
						>
							{[...YEARS].reverse().map((y) => (
								<option key={y.year} value={y.year}>
									{y.year}
								</option>
							))}
						</select>
					</label>
				</div>

				<LaenderTable year={year} />

				<p className="text-[13px] text-ink/55 mt-5 leading-relaxed max-w-3xl">
					Quelle:{" "}
					<a
						href={BFJ_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-0.5 underline decoration-1 underline-offset-2 hover:decoration-2"
					>
						Ausbildungsstatistik des Bundesamts für Justiz
						<ExternalLink className="w-3 h-3 shrink-0" />
					</a>
					{year.asOf && <>, Stand {formatAsOf(year.asOf)}</>}. Gezählt sind alle
					im Jahr abgeschlossenen Prüfungen, auch Wiederholungen und – in den
					meisten Ländern – Versuche zur Notenverbesserung; die Quoten sind also
					keine Erstversuchsquoten. Prädikat heißt „vollbefriedigend“ oder
					besser. „Endgültig“ zählt, wer keinen Versuch mehr hat. Das Bundesamt
					veröffentlicht mit gut einem Jahr Verzögerung.
				</p>
			</div>
		</div>
	);
}
