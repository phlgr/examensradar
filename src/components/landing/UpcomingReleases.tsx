import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	formatDayMonthShort,
	type JpaReleaseSummary,
	relativeLabel,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

/** Offices listed under the calendar page before "und N weitere". */
const MAX_ROWS = 3;

interface UpcomingReleasesProps {
	summaries: JpaReleaseSummary[];
	loading: boolean;
}

/** How far we are from the last release to the predicted one, 0–1. */
function elapsed(from: Date, to: Date, now: Date): number {
	const span = to.getTime() - from.getTime();
	if (span <= 0) return 1;
	return Math.min(1, Math.max(0, (now.getTime() - from.getTime()) / span));
}

/** One tear-off calendar page for the office expected to publish next. */
function CalendarLeaf({ summary }: { summary: JpaReleaseSummary }) {
	const { prediction, daysUntil } = summary;
	if (!prediction || daysUntil === null) return null;
	const overdue = daysUntil < 0;
	const progress = elapsed(summary.lastRelease, prediction.date, new Date());

	return (
		<div className="relative">
			{/* Pages already torn off underneath. */}
			<div
				className="absolute inset-x-3 -bottom-2 h-full rounded-2xl bg-sheet ring-1 ring-ink/10"
				aria-hidden
			/>
			<div
				className="absolute inset-x-6 -bottom-4 h-full rounded-2xl bg-sheet/70 ring-1 ring-ink/10"
				aria-hidden
			/>
			<div className="relative rounded-2xl bg-sheet ring-1 ring-ink/10 shadow-lift overflow-hidden">
				<div className="bg-seal text-sheet px-5 sm:px-6 py-2.5 flex items-center justify-between">
					<span className="text-sm font-semibold tracking-wide uppercase">
						{prediction.date.toLocaleDateString("de-DE", { month: "long" })}
					</span>
					<span className="figures text-xs opacity-80">
						{prediction.date.getFullYear()}
					</span>
				</div>
				{/* Binding holes. */}
				<div className="flex justify-center gap-24 -mt-1.5" aria-hidden>
					<span className="w-3 h-3 rounded-full bg-paper ring-1 ring-ink/15" />
					<span className="w-3 h-3 rounded-full bg-paper ring-1 ring-ink/15" />
				</div>

				<div className="px-5 sm:px-6 pt-2 pb-6 grid grid-cols-[auto_1fr] gap-x-6 items-center">
					<p className="headline text-[6.5rem] sm:text-[8rem] leading-[0.85] tracking-[-0.05em]">
						{prediction.date.getDate()}
					</p>
					<div className="min-w-0">
						<p className="text-sm text-ink/50">
							{prediction.date.toLocaleDateString("de-DE", {
								weekday: "long",
							})}
						</p>
						<p className="headline text-2xl sm:text-[1.7rem] leading-tight mt-0.5">
							{summary.name}
						</p>
						<p
							className={cn(
								"mt-2 text-sm font-semibold",
								overdue ? "text-seal" : "text-ink",
							)}
						>
							<span className={overdue ? undefined : "marker"}>
								{relativeLabel(daysUntil)}
							</span>
							<span className="font-normal text-ink/45">
								{" "}
								· {CONFIDENCE_LABEL[prediction.confidence]}
							</span>
						</p>
					</div>
				</div>

				<div className="px-5 sm:px-6 pb-5">
					<div className="relative h-1.5 rounded-full bg-ink/8">
						<div
							className={cn(
								"absolute inset-y-0 left-0 rounded-full",
								overdue ? "bg-seal" : "bg-ink",
							)}
							style={{ width: `${progress * 100}%` }}
						/>
						<span
							className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-sheet ring-2 ring-ink"
							style={{ left: `${progress * 100}%` }}
							aria-hidden
						>
							<span className="absolute inset-0 rounded-full bg-seal/60 animate-ping-slow" />
						</span>
					</div>
					<div className="figures mt-2.5 flex justify-between text-[11px] text-ink/50">
						<span>zuletzt {formatDayMonthShort(summary.lastRelease)}</span>
						<span>
							{prediction.windowStart.getTime() !==
							prediction.windowEnd.getTime()
								? `zwischen ${formatDayMonthShort(prediction.windowStart)} und ${formatDayMonthShort(prediction.windowEnd)}`
								: formatDayMonthShort(prediction.date)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The "when?" section: the next expected publications from the real log, as
 * a teaser for the history page. Charts and patterns stay over there.
 */
export function UpcomingReleases({
	summaries,
	loading,
}: UpcomingReleasesProps) {
	const predicted = summaries.filter((s) => s.prediction !== null);
	const [next, ...others] = predicted;
	const rows = others.slice(0, MAX_ROWS - 1);
	const hidden = summaries.length - 1 - rows.length;

	// Nothing to tease yet — don't show an empty promise.
	if (!loading && !next) return null;

	return (
		<section className="border-t border-ink/10 py-20 sm:py-28 px-4 sm:px-6">
			<div className="max-w-6xl mx-auto grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:items-center">
				<Reveal>
					<p className="text-sm font-semibold text-seal mb-4">Die Prognose</p>
					<h2 className="headline text-[2.6rem] sm:text-6xl leading-[1.02] mb-6">
						Wann kommen <em className="italic font-[450]">die Ergebnisse?</em>
					</h2>
					<p className="text-lg text-ink/70 leading-relaxed max-w-md mb-8">
						Jedes Prüfungsamt hat seinen eigenen Rhythmus. Aus allen bisherigen
						Veröffentlichungen rechnen wir hoch, wann es das nächste Mal so weit
						ist. In der Historie findest du jeden Termin mit Wochentag und
						Uhrzeit.
					</p>
					<Link
						to="/history"
						className="group inline-flex items-center gap-2 text-[15px] font-semibold border-b-2 border-ink pb-0.5 transition-colors hover:text-seal hover:border-seal"
					>
						Alle bisherigen Termine
						<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
					</Link>
				</Reveal>

				<Reveal delay={120} className="lg:pl-4">
					{next ? (
						<CalendarLeaf summary={next} />
					) : (
						<div className="h-72 rounded-2xl bg-sheet ring-1 ring-ink/10 animate-pulse" />
					)}

					{(rows.length > 0 || hidden > 0) && (
						<ol className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
							{rows.map((summary) => {
								const { prediction, daysUntil } = summary;
								if (!prediction || daysUntil === null) return null;
								return (
									<li
										key={summary.slug}
										className="py-3.5 flex items-baseline justify-between gap-4"
									>
										<span className="font-medium truncate">{summary.name}</span>
										<span className="text-sm shrink-0">
											<span
												className={cn(
													"font-semibold",
													daysUntil < 0 ? "text-seal" : "marker",
												)}
											>
												{formatDayMonth(prediction.date)}
											</span>
											<span className="text-ink/45">
												{" "}
												· {relativeLabel(daysUntil)}
											</span>
										</span>
									</li>
								);
							})}
							{hidden > 0 && (
								<li className="py-3.5 text-sm text-ink/50">
									und {hidden} weitere{" "}
									{hidden === 1 ? "Prüfungsamt" : "Prüfungsämter"} in der
									Historie
								</li>
							)}
						</ol>
					)}
				</Reveal>
			</div>
		</section>
	);
}
