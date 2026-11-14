import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { SectionIntro } from "@/components/ui/heading";
import { historyFaqs } from "@/lib/faq";
import { groupByLand } from "@/lib/laender";
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
	const tiles = groupByLand(jpas).flatMap(({ heading, offices }) =>
		offices.map((jpa) => ({
			land: heading,
			jpa,
			summary: summaries.find((s) => s.slug === jpa.slug),
		})),
	);

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
						Examen nach eigenem Rhythmus. Such dir dein Amt aus und sieh, wann
						die nächsten Ergebnisse voraussichtlich kommen.
					</SectionIntro>

					<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{tiles.map(({ land, jpa, summary }) => (
							<li key={jpa.slug}>
								<Card className="h-full transition-colors hover:bg-ink/[0.02]">
									<Link
										to="/ergebnisse/$jpa"
										params={{ jpa: jpaParam(jpa.slug) }}
										className="flex h-full flex-col gap-2 px-4 py-3 rounded-lg"
									>
										<span className="flex items-start gap-2">
											<span className="flex-1 min-w-0">
												<span className="block text-[11px] font-semibold uppercase tracking-wider text-ink/45">
													{land}
												</span>
												<span className="block font-semibold leading-snug">
													{jpa.name}
												</span>
											</span>
											<ChevronRight
												className="w-4 h-4 mt-0.5 shrink-0 text-ink/40"
												aria-hidden
											/>
										</span>
										<span className="mt-auto text-sm">
											{summary?.prediction && summary.daysUntil !== null ? (
												<PredictionNote
													prediction={summary.prediction}
													daysUntil={summary.daysUntil}
													prefix="Nächste voraussichtlich"
													detail="relative"
													className="text-sm"
												/>
											) : (
												<span className="text-ink/45">noch keine Prognose</span>
											)}
											{summary && (
												<span className="block text-xs text-ink/50 mt-0.5">
													zuletzt am {formatDayMonth(summary.lastRelease)}
												</span>
											)}
										</span>
									</Link>
								</Card>
							</li>
						))}
					</ul>

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
