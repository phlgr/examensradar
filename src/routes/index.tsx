import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { NotificationPreview } from "@/components/landing/NotificationPreview";
import { Reveal } from "@/components/landing/Reveal";
import { UpcomingReleases } from "@/components/landing/UpcomingReleases";
import { SignupForm } from "@/components/SignupForm";
import { landingFaqs } from "@/lib/faq";
import { summarizeReleases } from "@/lib/release-summary";
import { faqJsonLd, seo } from "@/lib/seo";
import { getPublicData } from "@/server/public-data";

export const Route = createFileRoute("/")({
	loader: () => getPublicData(),
	head: ({ loaderData }) => {
		const page = seo({
			title: "Examensradar – E-Mail, sobald die Examensergebnisse da sind",
			description:
				"Wann kommen die Examensergebnisse? Examensradar schickt dir eine E-Mail, sobald dein Justizprüfungsamt neue Ergebnisse im ersten Staatsexamen veröffentlicht – mit Prognose für den nächsten Termin. Kostenlos, ohne Konto.",
			path: "/",
		});
		if (!loaderData) return page;
		const faqs = landingFaqs(
			loaderData.jpas.map((jpa) => jpa.name),
			summarizeReleases(loaderData.history, new Date()),
		);
		return { ...page, scripts: [faqJsonLd(faqs)] };
	},
	component: LandingPage,
});

const STEPS = [
	{
		title: "Eintragen",
		description:
			"Justizprüfungsamt auswählen, E-Mail-Adresse eingeben. Kein Passwort, kein Konto.",
	},
	{
		title: "Bestätigen",
		description:
			"Du bekommst einen Link von uns. Ein Klick darauf, und die Benachrichtigung ist scharf.",
	},
	{
		title: "Abschalten",
		description:
			"Ab jetzt behalten wir die Ergebnisseite im Blick. Steht dort etwas Neues, hast du eine E-Mail im Postfach.",
	},
] as const;

function Keycap({ children }: { children: string }) {
	return (
		<kbd className="shadow-[0_5px_0_0_#d9d0bd,0_6px_0_0_rgb(23_23_26/0.3)] relative inline-grid place-items-center align-[0.14em] min-w-[1.45em] h-[1.18em] px-[0.18em] mx-[0.04em] rounded-[0.2em] bg-gradient-to-b from-sheet to-[#efe8d8] ring-1 ring-ink/15 font-sans font-semibold text-[0.62em] tracking-normal text-ink/80">
			<span className="-translate-y-[0.04em]">{children}</span>
		</kbd>
	);
}

function LandingPage() {
	const { jpas, history } = Route.useLoaderData();
	const [jpaId, setJpaId] = useState(jpas[0]?.id ?? "");

	const selectedJpa = jpas.find((jpa) => jpa.id === jpaId);
	const summaries = summarizeReleases(history, new Date());
	const faqs = landingFaqs(
		jpas.map((jpa) => jpa.name),
		summaries,
	);
	const summary = selectedJpa
		? summaries.find((s) => s.slug === selectedJpa.slug)
		: undefined;

	return (
		<div className="flex-1">
			<section className="relative overflow-hidden">
				<div
					className="absolute inset-0 bg-ruled [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
					aria-hidden
				/>
				<div
					className="absolute inset-y-0 left-[max(1rem,calc(50%-36rem))] w-px bg-seal/25 hidden sm:block"
					aria-hidden
				/>

				<div className="relative max-w-6xl mx-auto px-4 sm:px-6 sm:pl-12 pt-12 pb-20 sm:pt-20 sm:pb-28 grid gap-16 lg:gap-16 lg:grid-cols-[1.1fr_0.9fr] items-center">
					<div>
						<p
							className="animate-rise text-sm font-semibold uppercase tracking-wide text-seal mb-5"
							style={{ animationDelay: "20ms" }}
						>
							Examensergebnisse per E-Mail · Erstes Staatsexamen
						</p>
						<h1
							className="animate-rise headline text-[clamp(3rem,11vw,5.6rem)] leading-[0.98] mb-7"
							style={{ animationDelay: "60ms" }}
						>
							Schluss mit
							<br />
							<span className="whitespace-nowrap">
								<Keycap>F5</Keycap>
								<span className="marker marker-draw italic font-[430]">
									-Drücken.
								</span>
							</span>
						</h1>

						<p
							className="animate-rise text-lg sm:text-xl text-ink/70 leading-relaxed max-w-xl mb-10"
							style={{ animationDelay: "140ms" }}
						>
							<strong className="font-semibold text-ink">
								Die Klausuren im ersten Examen hast du geschrieben. Das Warten
								übernehmen wir.
							</strong>{" "}
							Examensradar behält die Ergebnisseite deines Justizprüfungsamts im
							Blick und schickt dir eine E-Mail, sobald neue Ergebnisse online
							sind.
						</p>

						<div
							className="animate-rise max-w-xl"
							style={{ animationDelay: "220ms" }}
						>
							<SignupForm
								jpas={jpas}
								loading={false}
								error={false}
								jpaId={jpaId}
								onJpaChange={setJpaId}
								source="landing"
							/>
						</div>
					</div>

					<div
						className="animate-rise lg:pl-4 max-w-md w-full mx-auto lg:max-w-none"
						style={{ animationDelay: "180ms" }}
					>
						<NotificationPreview
							jpa={selectedJpa}
							prediction={summary?.prediction ?? null}
							daysUntil={summary?.daysUntil ?? null}
							lastRelease={summary?.lastRelease ?? null}
							loading={false}
						/>
					</div>
				</div>
			</section>

			<section className="bg-sheet border-t border-ink/10 py-20 sm:py-28 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto">
					<Reveal className="max-w-2xl mb-14 sm:mb-20">
						<h2 className="headline text-[2.6rem] sm:text-6xl leading-[1.02]">
							Einfacher als jede Klausur.
						</h2>
						<p className="mt-6 text-lg text-ink/70 leading-relaxed">
							Eintragen, bestätigen, fertig. Das Ganze dauert keine Minute.
						</p>
					</Reveal>

					<ol className="grid md:grid-cols-3 border-t border-ink">
						{STEPS.map((step, index) => (
							<li
								key={step.title}
								className="border-b md:border-b-0 md:border-r last:border-r-0 border-ink/10 md:[&:not(:first-child)]:pl-8 md:pr-8"
							>
								<Reveal delay={index * 120} className="pt-7 pb-9 md:pb-2">
									<p className="headline text-seal text-5xl sm:text-6xl leading-none mb-6">
										§&thinsp;{index + 1}
									</p>
									<h3 className="text-lg font-semibold leading-tight mb-2">
										{step.title}
									</h3>
									<p className="text-ink/65 leading-relaxed">
										{step.description}
									</p>
								</Reveal>
							</li>
						))}
					</ol>
				</div>
			</section>

			<UpcomingReleases summaries={summaries} loading={false} />

			<section className="bg-sheet border-t border-ink/10 py-20 sm:py-28 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto">
					<Reveal className="max-w-2xl mb-12 sm:mb-16">
						<h2 className="headline text-[2.6rem] sm:text-6xl leading-[1.02]">
							Häufige Fragen
						</h2>
					</Reveal>
					<FaqList faqs={faqs} />
				</div>
			</section>

			<Footer jpas={jpas} />
		</div>
	);
}
