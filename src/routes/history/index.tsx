import { createFileRoute } from "@tanstack/react-router";
import { Bell, CalendarClock, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import {
	JpaSearchEmpty,
	JpaSearchInput,
	useJpaSearch,
} from "@/components/jpa-search";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";
import { PageSpinner } from "@/components/ui/spinner";
import { TeaserCard } from "@/components/ui/teaser-card";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	formatDayMonthShort,
	type JpaReleaseSummary,
	monthPositionLabel,
	relativeLabel,
	summarizeReleases,
} from "@/lib/release-summary";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history/")({
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

function mostCommonWeekday(counts: Map<number, number>): number | null {
	let best: number | null = null;
	let bestCount = 0;
	for (const [weekday, count] of counts) {
		if (count > bestCount) {
			best = weekday;
			bestCount = count;
		}
	}
	return best;
}

function WeekdayBar({ weekdayCounts }: { weekdayCounts: Map<number, number> }) {
	const max = Math.max(...weekdayCounts.values(), 1);
	const order = [1, 2, 3, 4, 5, 6, 0]; // Mo–So
	return (
		<div className="flex gap-1 items-end">
			{order.map((weekday) => {
				const count = weekdayCounts.get(weekday) ?? 0;
				const height = Math.round((count / max) * 28) + 6;
				return (
					<div key={weekday} className="flex flex-col items-center gap-1">
						<div
							className={cn(
								"w-7",
								count > 0
									? "bg-nb-yellow border-2 border-nb-black"
									: "bg-nb-black/5 border border-nb-black/15",
							)}
							style={{ height }}
							title={`${WEEKDAYS_FULL[weekday]}: ${count}×`}
						/>
						<span className="text-[10px] font-bold text-nb-black/50">
							{WEEKDAYS[weekday]}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function Overview({ summaries }: { summaries: JpaReleaseSummary[] }) {
	// Publication events, not raw notifications — a page edited twice in one
	// week is still one publication.
	const total = summaries.reduce((sum, s) => sum + s.releaseCount, 0);
	const weekdayCounts = new Map<number, number>();
	for (const summary of summaries) {
		for (const [weekday, count] of summary.weekdayCounts) {
			weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + count);
		}
	}
	const weekday = mostCommonWeekday(weekdayCounts);

	return (
		<Card className="p-5 sm:p-6 mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-10">
			<div className="flex-1">
				<p className="font-display-wide text-4xl sm:text-5xl leading-none">
					{total}
				</p>
				<p className="font-bold mt-2">
					Veröffentlichungen von {summaries.length}{" "}
					{summaries.length === 1
						? "Justizprüfungsamt"
						: "Justizprüfungsämtern"}{" "}
					erfasst
				</p>
				{weekday !== null && (
					<p className="text-sm font-medium mt-1">
						Am häufigsten an einem{" "}
						<span className="bg-nb-yellow px-1 font-bold">
							{WEEKDAYS_FULL[weekday]}
						</span>
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

/**
 * One office as a native <details>: the summary row carries what most people
 * came for (the next expected date), the body the pattern behind it. Native
 * disclosure keeps a long list scannable without any state of our own.
 */
function JpaDetails({
	summary,
	defaultOpen,
}: {
	summary: JpaReleaseSummary;
	defaultOpen: boolean;
}) {
	const { prediction, daysUntil } = summary;
	const overdue = daysUntil !== null && daysUntil < 0;
	// Owned per office (keyed by slug), so re-sorting the list after a search
	// never overrides what the reader opened or closed.
	const [open, setOpen] = useState(defaultOpen);

	return (
		<Card>
			<details
				open={open}
				onToggle={(event) => setOpen(event.currentTarget.open)}
				className="group"
			>
				{/* <summary> only allows phrasing content, so everything in the row
				    is a span; the office name is the disclosure's own label. */}
				<summary className="list-none cursor-pointer select-none p-4 sm:p-5 flex items-center gap-4 hover:bg-nb-cream transition-colors [&::-webkit-details-marker]:hidden">
					<span className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-5">
						<span className="block sm:flex-1 min-w-0">
							<span className="block font-black uppercase text-base sm:text-lg leading-tight">
								{summary.name}
							</span>
							<span className="block text-xs font-medium text-nb-black/60 mt-0.5">
								zuletzt am {formatDayMonth(summary.lastRelease)}
							</span>
						</span>
						<span className="block mt-2 sm:mt-0 text-sm font-bold">
							{prediction && daysUntil !== null ? (
								<PredictionNote
									prediction={prediction}
									daysUntil={daysUntil}
									prefix="voraussichtlich"
									detail="relative"
									chipSize="label"
								/>
							) : (
								<span className="font-medium text-nb-black/60">
									noch keine Prognose
								</span>
							)}
						</span>
					</span>
					<ChevronDown
						className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180"
						aria-hidden
					/>
				</summary>

				<div className="border-t-4 border-nb-black p-4 sm:p-5">
					<div className="grid gap-5 md:grid-cols-2">
						<div
							className={cn(
								"border-4 border-nb-black p-4 sm:p-5",
								prediction
									? overdue
										? "bg-nb-coral"
										: "bg-nb-teal"
									: "bg-nb-cream",
							)}
						>
							<Eyebrow muted={false} className="mb-2">
								Nächste Veröffentlichung
							</Eyebrow>
							{prediction && daysUntil !== null ? (
								<>
									<p className="font-display-wide text-3xl sm:text-4xl leading-none">
										{formatDayMonth(prediction.date)}
									</p>
									<p className="font-bold mt-2">{relativeLabel(daysUntil)}</p>
									<p className="text-xs font-medium mt-1 text-nb-black/70">
										Wahrscheinlich zwischen dem{" "}
										{formatDayMonthShort(prediction.windowStart)} und dem{" "}
										{formatDayMonthShort(prediction.windowEnd)} ·{" "}
										{CONFIDENCE_LABEL[prediction.confidence]}
									</p>
								</>
							) : (
								<p className="text-sm font-medium">
									Für eine Prognose brauchen wir mindestens zwei
									Veröffentlichungen. Bisher ist eine erfasst
									{summary.dates.length > 1
										? ` (${summary.dates.length} Meldungen innerhalb einer Woche).`
										: "."}
								</p>
							)}
						</div>

						<div className="flex flex-col justify-between gap-4">
							<dl className="text-sm space-y-2">
								<div>
									<dt>
										<Eyebrow>Zuletzt</Eyebrow>
									</dt>
									<dd className="font-bold">
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
									<dd className="font-bold">
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

					<div className="mt-5 pt-4 border-t-2 border-nb-black/10 flex flex-wrap items-start justify-between gap-3">
						<div>
							<Eyebrow className="mb-2">Erfasste Meldungen</Eyebrow>
							<ul className="flex flex-wrap gap-2">
								{summary.dates.map((date) => (
									<li
										key={date.getTime()}
										className="text-xs font-bold border-2 border-nb-black px-2 py-1 bg-nb-white"
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
						{summary.websiteUrl && (
							<a
								href={summary.websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs font-bold uppercase inline-flex items-center gap-1 underline decoration-2 underline-offset-4 hover:bg-nb-yellow transition-colors"
							>
								Website des Prüfungsamts
								<ExternalLink className="w-3.5 h-3.5 shrink-0" />
							</a>
						)}
					</div>
				</div>
			</details>
		</Card>
	);
}

function HistoryPage() {
	const historyQuery = trpc.jpa.getHistory.useQuery();
	const summaries = summarizeReleases(historyQuery.data ?? [], new Date());
	const search = useJpaSearch(summaries);

	if (historyQuery.isLoading) return <PageSpinner />;

	return (
		<div className="flex-1 py-8 sm:py-12 px-4 sm:px-6 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<SectionIntro
					as="h1"
					title="Wann kommen die Ergebnisse?"
					className="mb-8 sm:mb-10"
					textClassName="max-w-2xl"
				>
					Hier siehst du, wann die Justizprüfungsämter bisher Examensergebnisse
					veröffentlicht haben – und wann die nächsten voraussichtlich kommen.
				</SectionIntro>

				{summaries.length === 0 ? (
					<Card className="p-8 text-center">
						<IconBox size="lg" className="mx-auto mb-4">
							<CalendarClock className="w-8 h-8" />
						</IconBox>
						<p className="font-bold">
							Noch keine Veröffentlichungen erfasst. Sobald ein Prüfungsamt
							Ergebnisse veröffentlicht, erscheint es hier.
						</p>
					</Card>
				) : (
					<>
						<Overview summaries={summaries} />

						<div className="flex flex-wrap items-end justify-between gap-3 mb-4">
							<div>
								<h2 className="text-xl sm:text-2xl font-black uppercase">
									Nach Prüfungsamt
								</h2>
								<p className="text-sm font-medium text-nb-black/60">
									Sortiert nach der nächsten erwarteten Veröffentlichung. Wähle
									ein Amt aus, um Details zu sehen.
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
							<div className="space-y-4">
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

				<TeaserCard
					icon={Bell}
					title="Nicht selbst nachschauen müssen?"
					to="/subscriptions"
					action="Benachrichtigen lassen"
					variant="primary"
					className="mt-8 sm:mt-10"
				>
					Wir schicken dir eine E-Mail, sobald dein Prüfungsamt neue Ergebnisse
					veröffentlicht.
				</TeaserCard>
			</div>
		</div>
	);
}
