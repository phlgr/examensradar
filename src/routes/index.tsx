import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MailCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationPreview } from "@/components/landing/NotificationPreview";
import { Reveal } from "@/components/landing/Reveal";
import { SignupForm } from "@/components/landing/SignupForm";
import { UpcomingReleases } from "@/components/landing/UpcomingReleases";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DisplayHeading, SectionIntro } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";
import { summarizeReleases } from "@/lib/release-summary";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

const STEPS = [
	{
		icon: Mail,
		title: "Prüfungsamt wählen",
		description:
			"Wähle dein Justizprüfungsamt aus und trag deine E-Mail-Adresse ein. Das dauert keine Minute.",
		color: "coral",
	},
	{
		icon: MailCheck,
		title: "E-Mail bestätigen",
		description:
			"Wir schicken dir einen Bestätigungslink. Ein Klick genügt, dann ist alles eingerichtet.",
		color: "teal",
	},
	{
		icon: Zap,
		title: "Benachrichtigung erhalten",
		description:
			"Sobald das Prüfungsamt neue Ergebnisse veröffentlicht, bekommst du eine E-Mail von uns.",
		color: "yellow",
	},
] as const;

function LandingPage() {
	const jpasQuery = trpc.jpa.getAll.useQuery();
	const historyQuery = trpc.jpa.getHistory.useQuery();
	const [jpaId, setJpaId] = useState("");

	// Preselect the first office once the list is in, so a single-office
	// deployment needs no extra click and the preview has something to show.
	useEffect(() => {
		if (!jpaId && jpasQuery.data?.[0]) setJpaId(jpasQuery.data[0].id);
	}, [jpasQuery.data, jpaId]);

	const selectedJpa = jpasQuery.data?.find((jpa) => jpa.id === jpaId);
	const summaries = summarizeReleases(historyQuery.data ?? [], new Date());
	const summary = selectedJpa
		? summaries.find((s) => s.slug === selectedJpa.slug)
		: undefined;

	return (
		<div className="flex-1">
			{/* Hero */}
			<section className="bg-graph-paper border-b-4 border-nb-black">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-20 grid gap-10 lg:gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
					<div>
						<DisplayHeading
							as="h1"
							size="hero"
							className="animate-rise"
							style={{ animationDelay: "0ms" }}
						>
							Schluss mit
							<br />
							<span className="whitespace-nowrap">
								<span className="animate-keypress inline-block align-baseline bg-nb-white border-4 border-nb-black px-2 sm:px-3 leading-none py-1 mr-1 shadow-[0_8px_0_0_var(--nb-black)]">
									F5
								</span>
								-Drücken.
							</span>
						</DisplayHeading>

						<p
							className="animate-rise text-base sm:text-lg font-bold max-w-xl mb-8"
							style={{ animationDelay: "100ms" }}
						>
							Examensradar prüft die Ergebnisseite deines Justizprüfungsamts für
							dich und schickt dir eine E-Mail, sobald neue Examensergebnisse
							veröffentlicht sind.
						</p>

						<div className="animate-rise" style={{ animationDelay: "200ms" }}>
							<SignupForm
								jpas={jpasQuery.data}
								loading={jpasQuery.isLoading}
								jpaId={jpaId}
								onJpaChange={setJpaId}
							/>
						</div>
					</div>

					<div
						className="animate-rise lg:pl-6"
						style={{ animationDelay: "160ms" }}
					>
						<NotificationPreview
							jpa={selectedJpa}
							prediction={summary?.prediction ?? null}
							daysUntil={summary?.daysUntil ?? null}
							lastRelease={summary?.lastRelease ?? null}
							loading={historyQuery.isLoading}
						/>
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="bg-nb-cream py-14 sm:py-20 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto">
					<Reveal>
						<SectionIntro
							title="So funktioniert's"
							className="mb-10 sm:mb-14 max-w-2xl"
						>
							Drei Schritte – danach musst du die Ergebnisseite nie wieder
							selbst aufrufen.
						</SectionIntro>
					</Reveal>

					<ol className="relative grid gap-6 md:grid-cols-3 md:gap-8 md:before:absolute md:before:top-10 md:before:left-8 md:before:right-8 md:before:h-1 md:before:bg-nb-black">
						{STEPS.map((step, index) => (
							<li key={step.title} className="relative">
								<Reveal delay={index * 140} className="h-full">
									<Card className="h-full p-5 sm:p-6 transition-transform duration-200 hover:-translate-y-1.5">
										<div className="flex items-end justify-between mb-5">
											<IconBox
												color={step.color}
												size="lg"
												shadow
												className="font-display-wide text-4xl leading-none"
											>
												{index + 1}
											</IconBox>
											<step.icon className="w-8 h-8 text-nb-black/40" />
										</div>
										<h3 className="text-lg sm:text-xl font-black uppercase mb-2 leading-tight">
											{step.title}
										</h3>
										<p className="font-medium text-sm sm:text-base">
											{step.description}
										</p>
									</Card>
								</Reveal>
							</li>
						))}
					</ol>
				</div>
			</section>

			{/* When? */}
			<UpcomingReleases
				summaries={summaries}
				loading={historyQuery.isLoading}
			/>

			{/* Closing call */}
			<section className="bg-nb-mint border-y-4 border-nb-black py-16 sm:py-20 px-4 sm:px-6">
				<Reveal className="max-w-3xl mx-auto text-center">
					<SectionIntro
						title="Entspannt warten statt ständig neu laden."
						className="mb-8"
					>
						Trag dich ein – wir sagen dir Bescheid, wenn es so weit ist.
					</SectionIntro>
					<a
						href="#anmelden"
						className={cn(
							buttonVariants({ variant: "inverse", size: "lg" }),
							"w-full sm:w-auto",
						)}
					>
						Jetzt kostenlos anmelden
					</a>
				</Reveal>
			</section>

			{/* Footer */}
			<footer className="py-6 px-4 sm:px-6 bg-nb-black text-nb-white">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-bold">
					<p>&copy; {new Date().getFullYear()} Examensradar</p>
					<nav className="flex items-center gap-6 uppercase text-xs">
						<Link
							to="/history"
							className="underline decoration-2 underline-offset-4 hover:text-nb-yellow"
						>
							Historie
						</Link>
						<Link
							to="/subscriptions"
							className="underline decoration-2 underline-offset-4 hover:text-nb-yellow"
						>
							Benachrichtigungen
						</Link>
					</nav>
				</div>
			</footer>
		</div>
	);
}
