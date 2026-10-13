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

/** One calendar page for the office expected to publish next. */
function CalendarLeaf({ summary }: { summary: JpaReleaseSummary }) {
	const { prediction, daysUntil } = summary;
	if (!prediction || daysUntil === null) return null;
	const overdue = daysUntil < 0;

	return (
		<div className="rounded-lg bg-sheet ring-1 ring-ink/10 overflow-hidden">
			<div className="bg-seal text-sheet px-5 sm:px-6 py-2.5 flex items-center justify-between">
				<span className="text-sm font-semibold tracking-wide uppercase">
					{prediction.date.toLocaleDateString("de-DE", { month: "long" })}
				</span>
				<span className="figures text-xs opacity-80">
					{prediction.date.getFullYear()}
				</span>
			</div>
			<div className="px-5 sm:px-6 pt-4 pb-5 grid grid-cols-[auto_1fr] gap-x-6 items-center">
				<p className="headline text-[6.5rem] sm:text-[8rem] leading-[0.85] tracking-[-0.05em]">
					{prediction.date.getDate()}
				</p>
				<div className="min-w-0">
					<p className="text-sm text-ink/50">
						{prediction.date.toLocaleDateString("de-DE", {
							weekday: "long",
						})}
					</p>
					<p className="text-xl font-semibold leading-tight mt-0.5">
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
			<div className="figures px-5 sm:px-6 py-3 border-t border-ink/10 flex justify-between text-[11px] text-ink/50">
				<span>zuletzt {formatDayMonthShort(summary.lastRelease)}</span>
				<span>
					{prediction.windowStart.getTime() !== prediction.windowEnd.getTime()
						? `zwischen ${formatDayMonthShort(prediction.windowStart)} und ${formatDayMonthShort(prediction.windowEnd)}`
						: formatDayMonthShort(prediction.date)}
				</span>
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
					<h2 className="headline text-[2.6rem] sm:text-6xl leading-[1.02] mb-6">
						Wann kommen die Ergebnisse?
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
						<div className="h-72 rounded-lg bg-sheet ring-1 ring-ink/10 animate-pulse" />
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
