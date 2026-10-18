import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CalendarClock,
	ChevronDown,
	ExternalLink,
} from "lucide-react";
import { Fragment, useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import {
	JpaSearchEmpty,
	JpaSearchInput,
	useJpaSearch,
} from "@/components/jpa-search";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import { historyFaqs } from "@/lib/faq";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	formatDayMonthShort,
	type JpaReleaseSummary,
	monthPositionLabel,
	relativeLabel,
	summarizeReleases,
} from "@/lib/release-summary";
import { faqJsonLd, jpaParam, seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getPublicData } from "@/server/public-data";

export const Route = createFileRoute("/history/")({
	loader: () => getPublicData(),
	head: () => ({
		...seo({
			title:
				"Wann kommen die Examensergebnisse? Termine & Prognose | Examensradar",
			description:
				"Alle bisherigen Veröffentlichungstermine der Justizprüfungsämter im ersten Staatsexamen mit Wochentag und Uhrzeit – und wann die nächsten Examensergebnisse voraussichtlich kommen.",
			path: "/history",
		}),
		scripts: [faqJsonLd(historyFaqs)],
	}),
	component: HistoryPage,
});

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAYS_FULL = [
	"Sonntag",
	"Montag",
	"Dienstag",
	"Mittwoch",
	"Donnerstag",
	"Freitag",
	"Samstag",
] as const;

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function mostCommonWeekdays(counts: Map<number, number>): number[] {
	const seen = WEEK_ORDER.filter((weekday) => (counts.get(weekday) ?? 0) > 0);
	const max = Math.max(0, ...counts.values());
	const top = seen.filter((weekday) => counts.get(weekday) === max);
	return top.length < seen.length ? top : [];
}

function WeekdayBar({ weekdayCounts }: { weekdayCounts: Map<number, number> }) {
	const max = Math.max(...weekdayCounts.values(), 1);
	return (
		<div className="flex gap-1.5 items-end">
			{WEEK_ORDER.map((weekday) => {
				const count = weekdayCounts.get(weekday) ?? 0;
				const height = Math.round((count / max) * 32) + 4;
				return (
					<div key={weekday} className="flex flex-col items-center gap-1.5">
						<div
							className={cn(
								"w-6 rounded-[3px]",
								count === max && count > 0
									? "bg-seal"
									: count > 0
										? "bg-ink/70"
										: "bg-ink/10",
							)}
							style={{ height }}
							title={`${WEEKDAYS_FULL[weekday]}: ${count}×`}
						/>
						<span className="figures text-[10px] text-ink/45">
							{WEEKDAYS[weekday]}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function Overview({ summaries }: { summaries: JpaReleaseSummary[] }) {
	const total = summaries.reduce((sum, s) => sum + s.releaseCount, 0);
	const weekdayCounts = new Map<number, number>();
	for (const summary of summaries) {
		for (const [weekday, count] of summary.weekdayCounts) {
			weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + count);
		}
	}
	const topWeekdays = mostCommonWeekdays(weekdayCounts);

	return (
		<Card className="p-6 sm:p-8 mb-12 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-10">
			<div className="flex-1">
				<p className="headline text-6xl sm:text-7xl leading-none">{total}</p>
				<p className="text-lg mt-3">
					Veröffentlichungen von {summaries.length}{" "}
					{summaries.length === 1
						? "Justizprüfungsamt"
						: "Justizprüfungsämtern"}{" "}
					erfasst
				</p>
				{topWeekdays.length > 0 && (
					<p className="text-[15px] text-ink/60 mt-1">
						Am häufigsten an einem{" "}
						{topWeekdays.map((weekday, index) => (
							<Fragment key={weekday}>
								{index > 0 &&
									(index === topWeekdays.length - 1 ? " oder " : ", ")}
								<span className="marker font-semibold text-ink">
									{WEEKDAYS_FULL[weekday]}
								</span>
							</Fragment>
						))}
					</p>
				)}
			</div>
			<div>
				<Eyebrow className="mb-2">Wochentage</Eyebrow>
				<WeekdayBar weekdayCounts={weekdayCounts} />
			</div>
		</Card>
	);
}

function JpaDetails({
	summary,
	defaultOpen,
}: {
	summary: JpaReleaseSummary;
	defaultOpen: boolean;
}) {
	const { prediction, daysUntil } = summary;
	const overdue = daysUntil !== null && daysUntil < 0;
	const [open, setOpen] = useState(defaultOpen);

	return (
		<Card className="overflow-hidden">
			<details
				open={open}
				onToggle={(event) => setOpen(event.currentTarget.open)}
				className="group"
			>
				{/* <summary> only allows phrasing content, so everything in the row
				    is a span; the office name is the disclosure's own label. */}
				<summary className="list-none cursor-pointer select-none px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4 transition-colors hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
					<span className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-5">
						<span className="block sm:flex-1 min-w-0">
							<span className="block text-lg font-semibold leading-tight">
								{summary.name}
							</span>
							<span className="block text-[13px] text-ink/50 mt-0.5">
								zuletzt am {formatDayMonth(summary.lastRelease)}
							</span>
						</span>
						<span className="block mt-2 sm:mt-0">
							{prediction && daysUntil !== null ? (
								<PredictionNote
									prediction={prediction}
									daysUntil={daysUntil}
									prefix="voraussichtlich"
									detail="relative"
								/>
							) : (
								<span className="text-[15px] text-ink/45">
									noch keine Prognose
								</span>
							)}
						</span>
					</span>
					<ChevronDown
						className="w-5 h-5 shrink-0 text-ink/40 transition-transform group-open:rotate-180"
						aria-hidden
					/>
				</summary>

				<div className="border-t border-ink/10 px-5 py-5 sm:px-6 sm:py-6">
					<div className="grid gap-6 md:grid-cols-2">
						<div
							className={cn(
								"rounded-md p-5",
								overdue ? "bg-seal-soft" : "bg-paper/70 ring-1 ring-ink/5",
							)}
						>
							<Eyebrow className="mb-2">Nächste Veröffentlichung</Eyebrow>
							{prediction && daysUntil !== null ? (
								<>
									<p className="headline text-4xl leading-none">
										<span className={overdue ? undefined : "marker"}>
											{formatDayMonth(prediction.date)}
										</span>
									</p>
									<p
										className={cn("font-semibold mt-3", overdue && "text-seal")}
									>
										{relativeLabel(daysUntil)}
									</p>
									<p className="text-[13px] mt-1 text-ink/55">
										Wahrscheinlich zwischen dem{" "}
										{formatDayMonthShort(prediction.windowStart)} und dem{" "}
										{formatDayMonthShort(prediction.windowEnd)} ·{" "}
										{CONFIDENCE_LABEL[prediction.confidence]}
									</p>
								</>
							) : (
								<p className="text-[15px] text-ink/70">
									Für eine Prognose brauchen wir mindestens zwei
									Veröffentlichungen. Bisher ist eine erfasst
									{summary.dates.length > 1
										? ` (${summary.dates.length} Meldungen innerhalb einer Woche).`
										: "."}
								</p>
							)}
						</div>

						<div className="flex flex-col justify-between gap-5">
							<dl className="space-y-3">
								<div>
									<dt>
										<Eyebrow>Zuletzt</Eyebrow>
									</dt>
									<dd className="font-medium">
										{summary.lastRelease.toLocaleString("de-DE", {
											dateStyle: "long",
											timeStyle: "short",
										})}{" "}
										Uhr
									</dd>
								</div>
								<div>
									<dt>
										<Eyebrow>Typisch</Eyebrow>
									</dt>
									<dd className="font-medium">
										{prediction
											? `${monthPositionLabel(prediction.medianOffsetDays)}, `
											: ""}
										gegen {summary.typicalHour} Uhr
									</dd>
								</div>
							</dl>
							<WeekdayBar weekdayCounts={summary.weekdayCounts} />
						</div>
					</div>

					<div className="mt-6 pt-5 border-t border-ink/10 flex flex-wrap items-end justify-between gap-4">
						<div>
							<Eyebrow className="mb-2">Erfasste Meldungen</Eyebrow>
							<ul className="flex flex-wrap gap-1.5">
								{summary.dates.map((date) => (
									<li
										key={date.getTime()}
										className="figures text-xs rounded-md bg-ink/[0.05] px-2 py-1 text-ink/70"
									>
										{date.toLocaleString("de-DE", {
											day: "numeric",
											month: "short",
											year: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</li>
								))}
							</ul>
						</div>
						<div className="flex flex-wrap gap-x-6 gap-y-2">
							<Link
								to="/ergebnisse/$jpa"
								params={{ jpa: jpaParam(summary.slug) }}
								className="text-sm font-medium inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2"
							>
								Examensergebnisse {summary.name}
								<ArrowRight className="w-3.5 h-3.5 shrink-0" />
							</Link>
							{summary.websiteUrl && (
								<a
									href={summary.websiteUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm font-medium text-seal inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2"
								>
									Website des Prüfungsamts
									<ExternalLink className="w-3.5 h-3.5 shrink-0" />
								</a>
							)}
						</div>
					</div>
				</div>
			</details>
		</Card>
	);
}

function HistoryPage() {
	const { jpas, history } = Route.useLoaderData();
	const summaries = summarizeReleases(history, new Date());
	const search = useJpaSearch(summaries);

	return (
		<>
			<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
				<div className="max-w-4xl mx-auto">
					<SectionIntro
						as="h1"
						title="Wann kommen die Ergebnisse?"
						className="mb-10 sm:mb-14"
					>
						Hier siehst du, wann die Justizprüfungsämter bisher
						Examensergebnisse veröffentlicht haben – und wann die nächsten
						voraussichtlich kommen.
					</SectionIntro>

					{summaries.length === 0 ? (
						<Card className="p-10 text-center">
							<CalendarClock className="w-8 h-8 mx-auto mb-4 text-seal" />
							<p className="text-lg text-ink/70">
								Noch keine Veröffentlichungen erfasst. Sobald ein Prüfungsamt
								Ergebnisse veröffentlicht, erscheint es hier.
							</p>
						</Card>
					) : (
						<>
							<Overview summaries={summaries} />

							<div className="flex flex-wrap items-end justify-between gap-4 mb-5">
								<div>
									<h2 className="text-2xl font-semibold leading-tight">
										Nach Prüfungsamt
									</h2>
									<p className="text-[15px] text-ink/55 mt-1">
										Sortiert nach der nächsten erwarteten Veröffentlichung.
										Wähle ein Amt aus, um Details zu sehen.
									</p>
								</div>
								{search.searchable && (
									<JpaSearchInput
										value={search.search}
										onChange={search.setSearch}
									/>
								)}
							</div>

							{search.empty ? (
								<JpaSearchEmpty query={search.search} />
							) : (
								<div className="space-y-3">
									{search.visible.map((summary, index) => (
										<JpaDetails
											key={summary.slug}
											summary={summary}
											defaultOpen={index === 0}
										/>
									))}
								</div>
							)}
						</>
					)}

					<section className="mt-16">
						<h2 className="text-2xl font-semibold leading-tight mb-5">
							Zu den Prognosen
						</h2>
						<FaqList faqs={historyFaqs} />
					</section>
				</div>
			</div>
			<Footer jpas={jpas} />
		</>
	);
}
