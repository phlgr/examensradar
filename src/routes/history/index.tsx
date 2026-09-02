import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
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

/** Above this many offices the list gets a search field. */
const SEARCH_THRESHOLD = 6;

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
	const total = summaries.reduce((sum, s) => sum + s.dates.length, 0);
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
				<p className="text-[11px] font-black uppercase tracking-wider text-nb-black/50 mb-2">
					Wochentage
				</p>
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

	return (
		<details
			open={defaultOpen}
			className="group bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)]"
		>
			<summary className="list-none cursor-pointer select-none p-4 sm:p-5 flex items-center gap-4 hover:bg-nb-cream transition-colors [&::-webkit-details-marker]:hidden">
				<div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-5">
					<div className="sm:flex-1 min-w-0">
						<h2 className="font-black uppercase text-base sm:text-lg leading-tight">
							{summary.name}
						</h2>
						<p className="text-xs font-medium text-nb-black/60 mt-0.5">
							zuletzt am {formatDayMonth(summary.lastRelease)}
						</p>
					</div>
					<p className="mt-2 sm:mt-0 text-sm font-bold">
						{prediction && daysUntil !== null ? (
							<>
								voraussichtlich{" "}
								<span
									className={cn(
										"px-1 border-2 border-nb-black",
										overdue ? "bg-nb-coral" : "bg-nb-teal",
									)}
								>
									{formatDayMonth(prediction.date)}
								</span>{" "}
								<span className="font-medium text-nb-black/60">
									{relativeLabel(daysUntil)}
								</span>
							</>
						) : (
							<span className="font-medium text-nb-black/60">
								noch keine Prognose
							</span>
						)}
					</p>
				</div>
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
						<p className="text-[11px] font-black uppercase tracking-wider mb-2">
							Nächste Veröffentlichung
						</p>
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
								Veröffentlichungen. Bisher ist eine erfasst.
							</p>
						)}
					</div>

					<div className="flex flex-col justify-between gap-4">
						<dl className="text-sm space-y-2">
							<div>
								<dt className="text-[11px] font-black uppercase tracking-wider text-nb-black/50">
									Zuletzt
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
								<dt className="text-[11px] font-black uppercase tracking-wider text-nb-black/50">
									Typisch
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
						<p className="text-[11px] font-black uppercase tracking-wider text-nb-black/50 mb-2">
							Bisherige Veröffentlichungen
						</p>
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
	);
}

function HistoryPage() {
	const historyQuery = trpc.jpa.getHistory.useQuery();
	const [search, setSearch] = useState("");

	if (historyQuery.isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	const summaries = summarizeReleases(historyQuery.data ?? [], new Date());
	const needle = search.trim().toLowerCase();
	const visible = needle
		? summaries.filter((s) => s.name.toLowerCase().includes(needle))
		: summaries;

	return (
		<div className="flex-1 py-8 sm:py-12 px-4 sm:px-6 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8 sm:mb-10">
					<h1
						lang="de"
						className="font-display-wide uppercase text-3xl sm:text-5xl leading-none mb-4 break-words [hyphens:auto] sm:[hyphens:manual]"
					>
						Wann kommen die Ergebnisse?
					</h1>
					<p className="font-bold text-base sm:text-lg max-w-2xl">
						Hier siehst du, wann die Justizprüfungsämter bisher
						Examensergebnisse veröffentlicht haben – und wann die nächsten
						voraussichtlich kommen.
					</p>
				</div>

				{summaries.length === 0 ? (
					<Card className="p-8 text-center">
						<div className="w-16 h-16 bg-nb-yellow border-4 border-nb-black flex items-center justify-center mx-auto mb-4">
							<CalendarClock className="w-8 h-8" />
						</div>
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
							{summaries.length > SEARCH_THRESHOLD && (
								<Input
									type="search"
									placeholder="Prüfungsamt suchen"
									aria-label="Prüfungsamt suchen"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									className="h-10 text-sm sm:max-w-xs"
								/>
							)}
						</div>

						{visible.length === 0 ? (
							<Card variant="flat" className="p-6 text-center">
								<p className="font-bold">
									Kein Prüfungsamt passt zu „{search.trim()}“.
								</p>
							</Card>
						) : (
							<div className="space-y-4">
								{visible.map((summary, index) => (
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

				<Card
					variant="primary"
					className="mt-8 sm:mt-10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
				>
					<div className="flex-1">
						<p className="font-black uppercase text-lg">
							Nicht selbst nachschauen müssen?
						</p>
						<p className="text-sm font-medium mt-1">
							Wir schicken dir eine E-Mail, sobald dein Prüfungsamt neue
							Ergebnisse veröffentlicht.
						</p>
					</div>
					<LinkButton
						to="/subscriptions"
						className="bg-nb-black text-nb-white shadow-[6px_6px_0_0_var(--nb-white)] hover:shadow-none w-full sm:w-auto shrink-0"
					>
						Benachrichtigen lassen
					</LinkButton>
				</Card>
			</div>
		</div>
	);
}
