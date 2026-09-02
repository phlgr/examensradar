import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { LinkButton } from "@/components/ui/link-button";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	type JpaReleaseSummary,
	relativeLabel,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

/** Rows shown before the list collapses into "und N weitere". */
const MAX_ROWS = 3;

interface UpcomingReleasesProps {
	summaries: JpaReleaseSummary[];
	loading: boolean;
}

/**
 * The "when?" section: the next expected publications from the real log, as
 * a teaser for the history page. Charts and patterns stay over there.
 */
export function UpcomingReleases({
	summaries,
	loading,
}: UpcomingReleasesProps) {
	const withPrediction = summaries.filter((s) => s.prediction !== null);
	const rows = withPrediction.slice(0, MAX_ROWS);
	const hidden = summaries.length - rows.length;

	// Nothing to tease yet — don't show an empty promise.
	if (!loading && rows.length === 0) return null;

	return (
		<section className="bg-nb-white border-t-4 border-nb-black py-14 sm:py-20 px-4 sm:px-6">
			<div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:items-start">
				<Reveal>
					<h2 className="font-display-wide uppercase text-4xl sm:text-5xl leading-none mb-4">
						Wann ist es so weit?
					</h2>
					<p className="font-bold text-base sm:text-lg mb-6">
						Aus den bisherigen Veröffentlichungen lässt sich ziemlich gut
						ablesen, wann ein Prüfungsamt das nächste Mal dran ist. Die Historie
						zeigt dir alle Termine, Wochentage und Uhrzeiten.
					</p>
					<LinkButton to="/history" className="w-full sm:w-auto">
						Zur Historie
						<ArrowRight className="w-5 h-5" />
					</LinkButton>
				</Reveal>

				<Reveal delay={120}>
					<ol className="border-4 border-nb-black bg-nb-cream shadow-[var(--nb-shadow)] divide-y-4 divide-nb-black">
						{loading &&
							rows.length === 0 &&
							[0, 1, 2].map((i) => (
								<li key={i} className="p-4 sm:p-5">
									<div className="h-5 w-2/3 bg-nb-black/10 mb-2" />
									<div className="h-4 w-1/2 bg-nb-black/10" />
								</li>
							))}
						{rows.map((summary) => {
							const prediction = summary.prediction;
							const daysUntil = summary.daysUntil;
							if (!prediction || daysUntil === null) return null;
							const overdue = daysUntil < 0;
							return (
								<li
									key={summary.slug}
									className="p-4 sm:p-5 grid gap-x-6 gap-y-1 sm:grid-cols-[1fr_auto] sm:items-center"
								>
									<div className="min-w-0">
										<p className="font-black uppercase text-base sm:text-lg leading-tight">
											{summary.name}
										</p>
										<p className="text-xs font-medium text-nb-black/60 mt-0.5">
											{CONFIDENCE_LABEL[prediction.confidence]} · zuletzt am{" "}
											{formatDayMonth(summary.lastRelease)}
										</p>
									</div>
									<div className="sm:text-right">
										<p
											className={cn(
												"inline-block font-display-wide text-xl sm:text-2xl leading-none px-1.5 py-0.5 border-2 border-nb-black",
												overdue ? "bg-nb-coral" : "bg-nb-teal",
											)}
										>
											{formatDayMonth(prediction.date)}
										</p>
										<p className="text-xs font-bold mt-1">
											{relativeLabel(daysUntil)}
										</p>
									</div>
								</li>
							);
						})}
						{hidden > 0 && (
							<li className="p-4 sm:p-5 text-sm font-medium text-nb-black/60">
								und {hidden} weitere{" "}
								{hidden === 1 ? "Prüfungsamt" : "Prüfungsämter"} in der Historie
							</li>
						)}
					</ol>
				</Reveal>
			</div>
		</section>
	);
}
