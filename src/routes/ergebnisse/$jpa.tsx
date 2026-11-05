import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import { formatSittingRange, formatStand } from "@/lib/exam-calendar";
import { expectedResultsPhrase, jpaFaqs, nextReleaseSentence } from "@/lib/faq";
import { clusterReleases } from "@/lib/prediction";
import {
	CONFIDENCE_LABEL,
	examSchedule,
	formatDayMonth,
	formatDayMonthShort,
	relativeLabel,
	summarizeReleases,
} from "@/lib/release-summary";
import {
	faqJsonLd,
	formatLongDate,
	jpaParam,
	jpaPath,
	jsonLd,
	SITE_URL,
	seo,
} from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getPublicData } from "@/server/public-data";

export const Route = createFileRoute("/ergebnisse/$jpa")({
	loader: async ({ params }) => {
		const { jpas, history } = await getPublicData();
		const jpa = jpas.find((j) => jpaParam(j.slug) === params.jpa);
		if (!jpa) throw notFound();
		const now = new Date();
		const summary = summarizeReleases(history, now).find(
			(s) => s.slug === jpa.slug,
		);
		const schedule = examSchedule(jpa.slug, summary?.dates ?? [], now);
		return { jpas, jpa, summary, schedule };
	},
	head: ({ loaderData }) => {
		if (!loaderData) return {};
		const { jpa, summary, schedule } = loaderData;
		const path = jpaPath(jpa.slug);
		const next = summary?.prediction
			? `Nächster Termin voraussichtlich am ${formatLongDate(summary.prediction.date)}. `
			: "";
		const page = seo({
			title: `Examensergebnisse ${jpa.name}: Wann kommen sie? | Examensradar`,
			description: `${next}Alle bisherigen Veröffentlichungen des Justizprüfungsamts beim ${jpa.name} im ersten Staatsexamen – und eine kostenlose E-Mail, sobald neue Ergebnisse online sind.`,
			path,
		});
		return {
			...page,
			scripts: [
				faqJsonLd(jpaFaqs(jpa.name, summary, schedule?.rows)),
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
							name: "Termine",
							item: `${SITE_URL}/history`,
						},
						{
							"@type": "ListItem",
							position: 3,
							name: `Examensergebnisse ${jpa.name}`,
							item: `${SITE_URL}${path}`,
						},
					],
				}),
			],
		};
	},
	component: JpaPage,
});

function JpaPage() {
	const { jpas, jpa, summary, schedule } = Route.useLoaderData();
	const [jpaId, setJpaId] = useState(jpa.id);
	const prediction = summary?.prediction ?? null;
	const daysUntil = summary?.daysUntil ?? null;
	const overdue = daysUntil !== null && daysUntil < 0;
	const releases = summary ? clusterReleases(summary.dates).reverse() : [];

	return (
		<>
			<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
				<div className="max-w-4xl mx-auto">
					<nav aria-label="Brotkrumen" className="text-sm text-ink/50 mb-6">
						<Link to="/" className="hover:text-ink">
							Examensradar
						</Link>
						{" / "}
						<Link to="/history" className="hover:text-ink">
							Termine
						</Link>
						{" / "}
						<span className="text-ink/70">{jpa.name}</span>
					</nav>

					<SectionIntro
						as="h1"
						title={`Examensergebnisse ${jpa.name}: Wann kommen sie?`}
						className="mb-10 sm:mb-14"
					>
						{summary
							? nextReleaseSentence(summary)
							: `Für das ${jpa.name} haben wir noch keine Veröffentlichung erfasst.`}{" "}
						Mit Examensradar bekommst du eine E-Mail, sobald die Ergebnisse
						online sind.
					</SectionIntro>

					<div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] mb-14">
						<Card
							className={cn(
								"p-6 sm:p-7",
								overdue && "bg-seal-soft ring-seal/20",
							)}
						>
							<Eyebrow className="mb-2">Nächste Veröffentlichung</Eyebrow>
							{prediction && daysUntil !== null ? (
								<>
									<p className="headline text-5xl leading-none">
										<span className={overdue ? undefined : "marker"}>
											{formatDayMonth(prediction.date)}
										</span>
									</p>
									<p
										className={cn("font-semibold mt-3", overdue && "text-seal")}
									>
										{relativeLabel(daysUntil)}
									</p>
									{prediction.sitting && (
										<p className="text-[13px] mt-1 text-ink/55">
											für die Klausuren vom{" "}
											{formatSittingRange(prediction.sitting)}
										</p>
									)}
									<p className="text-[13px] mt-1 text-ink/55">
										Wahrscheinlich zwischen dem{" "}
										{formatDayMonthShort(prediction.windowStart)} und dem{" "}
										{formatDayMonthShort(prediction.windowEnd)} ·{" "}
										{CONFIDENCE_LABEL[prediction.confidence]}
									</p>
								</>
							) : (
								<p className="text-[15px] text-ink/70">
									Für eine Prognose brauchen wir mindestens zwei
									Veröffentlichungen.
								</p>
							)}
						</Card>

						<div>
							<SignupForm
								jpas={jpas}
								loading={false}
								error={false}
								jpaId={jpaId}
								onJpaChange={setJpaId}
								source="jpa"
							/>
						</div>
					</div>

					{schedule && schedule.rows.length > 0 && (
						<section className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								Klausurtermine
							</h2>
							<p className="text-[15px] text-ink/55 mb-5">
								Die schriftlichen Prüfungen der staatlichen Pflichtfachprüfung
								und wann die Ergebnisse voraussichtlich kommen.
							</p>
							<ul className="divide-y divide-ink/10 border-y border-ink/10">
								{schedule.rows.map((row) => (
									<li
										key={row.sitting.days[0].date}
										className="py-3 flex justify-between gap-4"
									>
										<span>
											<span className="font-medium">
												{formatSittingRange(row.sitting)}
											</span>
											<span className="block text-[13px] text-ink/55">
												{row.sitting.days.map((day) => day.subject).join(" · ")}
											</span>
										</span>
										<span className="text-right">
											<span
												className={cn(
													"block font-semibold",
													row.status === "läuft" && "text-seal",
												)}
											>
												{row.status}
											</span>
											<span className="block text-[13px] text-ink/55">
												Ergebnisse voraussichtlich {expectedResultsPhrase(row)}
											</span>
										</span>
									</li>
								))}
							</ul>
							<p className="text-[13px] text-ink/55 mt-3">
								Ohne Gewähr. Quelle:{" "}
								<a
									href={schedule.calendar.pageUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="underline decoration-1 underline-offset-4 hover:decoration-2"
								>
									Klausurtermine des Justizprüfungsamts beim {jpa.name}
								</a>
								{schedule.calendar.stand &&
									`, Stand ${formatStand(schedule.calendar.stand)}`}
								.
							</p>
						</section>
					)}

					{releases.length > 0 && (
						<section className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								Bisherige Veröffentlichungen
							</h2>
							<p className="text-[15px] text-ink/55 mb-5">
								Wann das Justizprüfungsamt beim {jpa.name} neue Ergebnisse
								online gestellt hat, neueste zuerst.
							</p>
							<ul className="divide-y divide-ink/10 border-y border-ink/10">
								{releases.map((date) => (
									<li
										key={date.getTime()}
										className="py-3 flex justify-between gap-4"
									>
										<span className="font-medium">
											{date.toLocaleDateString("de-DE", {
												weekday: "long",
												day: "numeric",
												month: "long",
												year: "numeric",
											})}
										</span>
										<span className="figures text-ink/55">
											{date.toLocaleTimeString("de-DE", {
												hour: "2-digit",
												minute: "2-digit",
											})}{" "}
											Uhr
										</span>
									</li>
								))}
							</ul>
						</section>
					)}

					<section className="mb-14">
						<h2 className="text-2xl font-semibold leading-tight mb-5">
							Häufige Fragen
						</h2>
						<FaqList faqs={jpaFaqs(jpa.name, summary, schedule?.rows)} />
					</section>

					{jpa.websiteUrl && (
						<p className="text-[15px] text-ink/60">
							Verbindlich sind nur die Angaben des Prüfungsamts:{" "}
							<a
								href={jpa.websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="font-medium text-seal inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2"
							>
								Website des Justizprüfungsamts beim {jpa.name}
								<ExternalLink className="w-3.5 h-3.5 shrink-0" />
							</a>
						</p>
					)}
				</div>
			</div>
			<Footer jpas={jpas} />
		</>
	);
}
