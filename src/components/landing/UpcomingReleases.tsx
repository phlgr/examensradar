import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { Card } from "@/components/ui/card";
import { DateChip } from "@/components/ui/date-chip";
import { SectionIntro } from "@/components/ui/heading";
import { LinkButton } from "@/components/ui/link-button";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	type JpaReleaseSummary,
	relativeLabel,
} from "@/lib/release-summary";

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
	const rows = summaries
		.filter((s) => s.prediction !== null)
		.slice(0, MAX_ROWS);
	const hidden = summaries.length - rows.length;

	// Nothing to tease yet — don't show an empty promise.
	if (!loading && rows.length === 0) return null;

	return (
		<section className="bg-nb-white border-t-4 border-nb-black py-14 sm:py-20 px-4 sm:px-6">
			<div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:items-start">
				<Reveal>
					<SectionIntro title="Wann ist es so weit?" className="mb-6">
						Aus den bisherigen Veröffentlichungen lässt sich ziemlich gut
						ablesen, wann ein Prüfungsamt das nächste Mal dran ist. Die Historie
						zeigt dir alle Termine, Wochentage und Uhrzeiten.
					</SectionIntro>
					<LinkButton to="/history" className="w-full sm:w-auto">
						Zur Historie
						<ArrowRight className="w-5 h-5" />
					</LinkButton>
				</Reveal>

				<Reveal delay={120}>
					<Card variant="muted" className="divide-y-4 divide-nb-black">
						<ol className="divide-y-4 divide-nb-black">
							{loading &&
								rows.length === 0 &&
								[0, 1, 2].map((i) => (
									<li key={i} className="p-4 sm:p-5">
										<div className="h-5 w-2/3 bg-nb-black/10 mb-2" />
										<div className="h-4 w-1/2 bg-nb-black/10" />
									</li>
								))}
							{rows.map((summary) => {
								const { prediction, daysUntil } = summary;
								if (!prediction || daysUntil === null) return null;
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
											<DateChip
												date={prediction.date}
												tone={daysUntil < 0 ? "overdue" : "upcoming"}
												size="display"
											/>
											<p className="text-xs font-bold mt-1">
												{relativeLabel(daysUntil)}
											</p>
										</div>
									</li>
								);
							})}
						</ol>
						{hidden > 0 && (
							<p className="p-4 sm:p-5 text-sm font-medium text-nb-black/60">
								und {hidden} weitere{" "}
								{hidden === 1 ? "Prüfungsamt" : "Prüfungsämter"} in der Historie
							</p>
						)}
					</Card>
				</Reveal>
			</div>
		</section>
	);
}
