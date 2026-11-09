import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { SectionIntro } from "@/components/ui/heading";
import { historyFaqs } from "@/lib/faq";
import { formatDayMonth } from "@/lib/release-summary";
import { faqJsonLd, jpaParam, jsonLd, SITE_URL, seo } from "@/lib/seo";
import { getPublicData } from "@/server/public-data";

export const Route = createFileRoute("/ergebnisse/")({
	loader: () => getPublicData(),
	head: () => ({
		...seo({
			title: "Examensergebnisse nach Prüfungsamt | Examensradar",
			description:
				"Wann kommen die Ergebnisse im ersten Staatsexamen? Alle Justizprüfungsämter mit der voraussichtlich nächsten Veröffentlichung, berechnet aus den bisherigen Terminen.",
			path: "/ergebnisse",
		}),
		scripts: [
			faqJsonLd(historyFaqs),
			jsonLd({
				"@type": "BreadcrumbList",
				itemListElement: [
					{
						"@type": "ListItem",
						position: 1,
						name: "Examensradar",
						item: SITE_URL,
					},
					{
						"@type": "ListItem",
						position: 2,
						name: "Ergebnisse",
						item: `${SITE_URL}/ergebnisse`,
					},
				],
			}),
		],
	}),
	component: ResultsIndexPage,
});

function ResultsIndexPage() {
	const { jpas, summaries } = Route.useLoaderData();
	const rows = [...jpas]
		.sort((a, b) => a.name.localeCompare(b.name, "de"))
		.map((jpa) => ({
			jpa,
			summary: summaries.find((s) => s.slug === jpa.slug),
		}));

	return (
		<>
			<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
				<div className="max-w-4xl mx-auto">
					<SectionIntro
						as="h1"
						title="Examensergebnisse nach Prüfungsamt"
						className="mb-10 sm:mb-14"
					>
						Jedes Justizprüfungsamt veröffentlicht die Ergebnisse im ersten
						Examen nach eigenem Rhythmus.
					</SectionIntro>

					<section>
						<h2 className="text-2xl font-semibold leading-tight mb-5">NRW</h2>
						<ul className="space-y-3">
							{rows.map(({ jpa, summary }) => (
								<li key={jpa.slug}>
									<Card className="transition-colors hover:bg-ink/[0.02]">
										<Link
											to="/ergebnisse/$jpa"
											params={{ jpa: jpaParam(jpa.slug) }}
											className="flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5 rounded-lg"
										>
											<span className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-5">
												<span className="block sm:flex-1 min-w-0">
													<span className="block text-lg font-semibold leading-tight">
														{jpa.name}
													</span>
													{summary && (
														<span className="block text-[13px] text-ink/50 mt-0.5">
															zuletzt am {formatDayMonth(summary.lastRelease)}
														</span>
													)}
												</span>
												<span className="block mt-2 sm:mt-0">
													{summary?.prediction && summary.daysUntil !== null ? (
														<PredictionNote
															prediction={summary.prediction}
															daysUntil={summary.daysUntil}
															prefix="nächste Ergebnisse voraussichtlich"
															detail="relative"
														/>
													) : (
														<span className="text-[15px] text-ink/45">
															noch keine Prognose
														</span>
													)}
												</span>
											</span>
											<ChevronRight
												className="w-5 h-5 shrink-0 text-ink/40"
												aria-hidden
											/>
										</Link>
									</Card>
								</li>
							))}
						</ul>
					</section>

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
