import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
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
		<Card className="p-5 sm:p-6 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-10">
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

function JpaSection({ summary }: { summary: JpaReleaseSummary }) {
	const { prediction, daysUntil } = summary;
	const overdue = daysUntil !== null && daysUntil < 0;

	return (
		<Card className="p-5 sm:p-6">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-5">
				<h2 className="text-xl sm:text-2xl font-black uppercase leading-tight">
					{summary.name}
				</h2>
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

			<div className="grid gap-5 md:grid-cols-[1fr_1fr]">
				{/* Next release */}
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
							Für eine Prognose brauchen wir mindestens zwei Veröffentlichungen.
							Bisher ist eine erfasst.
						</p>
					)}
				</div>

				{/* Pattern */}
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

			<div className="mt-5 pt-4 border-t-2 border-nb-black/10">
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
		</Card>
	);
}

function HistoryPage() {
	const historyQuery = trpc.jpa.getHistory.useQuery();

	if (historyQuery.isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	const summaries = summarizeReleases(historyQuery.data ?? [], new Date());

	return (
		<div className="flex-1 py-8 sm:py-12 px-4 sm:px-6 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8 sm:mb-10 max-w-2xl">
					<h1 className="font-display-wide uppercase text-4xl sm:text-5xl leading-none mb-4">
						Wann kommen die Ergebnisse?
					</h1>
					<p className="font-bold text-base sm:text-lg">
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
						<div className="space-y-6">
							{summaries.map((summary) => (
								<JpaSection key={summary.slug} summary={summary} />
							))}
						</div>
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
