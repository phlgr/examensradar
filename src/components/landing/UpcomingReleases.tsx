import { Link } from "@tanstack/react-router";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	formatDayMonthShort,
	type JpaReleaseSummary,
	relativeLabel,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

/** Offices listed before "und N weitere". */
const MAX_ROWS = 4;

interface UpcomingReleasesProps {
	summaries: JpaReleaseSummary[];
	loading: boolean;
}

/**
 * The "when?" section: the next expected publications from the real log, set
 * like a timetable, as a teaser for the history page. Charts and patterns
 * stay over there.
 */
export function UpcomingReleases({
	summaries,
	loading,
}: UpcomingReleasesProps) {
	const rows = summaries
		.filter((s) => s.prediction !== null)
		.slice(0, MAX_ROWS);
	const hidden = summaries.length - rows.length;

	// Nothing to tease yet — don't show an empty promise.
	if (!loading && rows.length === 0) return null;

	return (
		<section className="border-t border-ink/15 py-16 sm:py-24 px-4 sm:px-6">
			<div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-20">
				<div>
					<h2 className="headline text-4xl sm:text-5xl leading-[1.05] mb-5">
						Wann kommen die Ergebnisse?
					</h2>
					<p className="text-lg text-ink/75 leading-relaxed mb-5">
						Jedes Prüfungsamt hat seinen eigenen Rhythmus. Aus allen bisherigen
						Veröffentlichungen rechnen wir hoch, wann es das nächste Mal so weit
						ist.
					</p>
					<Link
						to="/history"
						className="text-lg text-seal underline decoration-1 underline-offset-[3px] hover:decoration-2"
					>
						Alle bisherigen Termine in der Historie
					</Link>
				</div>

				<div className="lg:pt-2">
					<ol className="border-t-2 border-ink">
						{loading &&
							rows.length === 0 &&
							[0, 1].map((i) => (
								<li key={i} className="py-5 border-b border-ink/15">
									<div className="h-4 w-40 bg-ink/10 mb-3" />
									<div className="h-8 w-64 bg-ink/10" />
								</li>
							))}
						{rows.map((summary, index) => {
							const { prediction, daysUntil } = summary;
							if (!prediction || daysUntil === null) return null;
							const overdue = daysUntil < 0;
							return (
								<li
									key={summary.slug}
									className="py-5 border-b border-ink/15 grid gap-x-6 gap-y-1 sm:grid-cols-[1fr_auto] sm:items-baseline"
								>
									<div className="min-w-0">
										<p className="ui text-[13px] text-ink/60">{summary.name}</p>
										<p
											className={cn(
												"headline leading-tight mt-1",
												index === 0 ? "text-3xl sm:text-4xl" : "text-2xl",
											)}
										>
											<span
												className={
													overdue
														? "underline decoration-seal decoration-2 underline-offset-4"
														: "marker"
												}
											>
												{prediction.date.toLocaleDateString("de-DE", {
													weekday: "long",
												})}
												, {formatDayMonth(prediction.date)}
											</span>
										</p>
										{index === 0 && (
											<p className="text-[15px] text-ink/55 mt-2">
												wahrscheinlich zwischen dem{" "}
												{formatDayMonthShort(prediction.windowStart)} und dem{" "}
												{formatDayMonthShort(prediction.windowEnd)}, zuletzt am{" "}
												{formatDayMonth(summary.lastRelease)}
											</p>
										)}
									</div>
									<p
										className={cn(
											"text-[17px] sm:text-right",
											overdue ? "text-seal" : "text-ink/75",
										)}
									>
										{relativeLabel(daysUntil)}
										<span className="block text-[15px] text-ink/50 italic">
											{CONFIDENCE_LABEL[prediction.confidence]}
										</span>
									</p>
								</li>
							);
						})}
						{hidden > 0 && (
							<li className="py-4 border-b border-ink/15 text-[15px] text-ink/55">
								und {hidden} weitere{" "}
								{hidden === 1 ? "Prüfungsamt" : "Prüfungsämter"} in der Historie
							</li>
						)}
					</ol>
				</div>
			</div>
		</section>
	);
}
