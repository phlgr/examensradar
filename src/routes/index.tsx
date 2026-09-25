import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationPreview } from "@/components/landing/NotificationPreview";
import { Reveal } from "@/components/landing/Reveal";
import { SignupForm } from "@/components/landing/SignupForm";
import { UpcomingReleases } from "@/components/landing/UpcomingReleases";
import { summarizeReleases } from "@/lib/release-summary";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/")({ component: LandingPage });

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

/** The F5 key as a real keycap, pressed every few seconds. */
function Keycap({ children }: { children: string }) {
	return (
		<kbd className="animate-keypress relative inline-grid place-items-center align-[0.14em] min-w-[1.45em] h-[1.18em] px-[0.18em] mx-[0.04em] rounded-[0.2em] bg-gradient-to-b from-sheet to-[#efe8d8] ring-1 ring-ink/15 font-sans font-semibold text-[0.62em] tracking-normal text-ink/80">
			<span className="-translate-y-[0.04em]">{children}</span>
		</kbd>
	);
}

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
		<div className="desk flex-1">
			{/* Hero */}
			<section className="relative overflow-hidden">
				{/* Ruled lines fading out towards the bottom, like a Klausurbogen. */}
				<div
					className="absolute inset-0 bg-ruled [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
					aria-hidden
				/>
				{/* The margin line every exam sheet has. */}
				<div
					className="absolute inset-y-0 left-[max(1rem,calc(50%-36rem))] w-px bg-seal/25 hidden sm:block"
					aria-hidden
				/>

				<div className="relative max-w-6xl mx-auto px-4 sm:px-6 sm:pl-12 pt-12 pb-20 sm:pt-20 sm:pb-28 grid gap-16 lg:gap-16 lg:grid-cols-[1.1fr_0.9fr] items-center">
					<div>
						<p
							className="animate-rise inline-flex items-center gap-2 text-sm font-medium text-ink/60 mb-7"
							style={{ animationDelay: "0ms" }}
						>
							<span className="relative flex w-2 h-2">
								<span className="absolute inset-0 rounded-full bg-seal animate-ping-slow" />
								<span className="relative w-2 h-2 rounded-full bg-seal" />
							</span>
							Für das erste Staatsexamen
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
								Die Klausuren hast du geschrieben. Das Warten übernehmen wir.
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
								jpas={jpasQuery.data}
								loading={jpasQuery.isLoading}
								error={jpasQuery.isError}
								jpaId={jpaId}
								onJpaChange={setJpaId}
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
							loading={historyQuery.isLoading}
						/>
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="bg-sheet border-t border-ink/10 py-20 sm:py-28 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto">
					<Reveal className="max-w-2xl mb-14 sm:mb-20">
						<p className="text-sm font-semibold text-seal mb-4">
							In drei Schritten
						</p>
						<h2 className="headline text-[2.6rem] sm:text-6xl leading-[1.02]">
							Einfacher als <em className="italic font-[450]">jede Klausur.</em>
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
									<h3 className="headline text-2xl leading-tight mb-3">
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

			{/* When? */}
			<UpcomingReleases
				summaries={summaries}
				loading={historyQuery.isLoading}
			/>

			{/* Closing call + footer, on the dark end of the desk. */}
			<div className="bg-ink text-sheet">
				<section className="px-4 sm:px-6 py-24 sm:py-32">
					<Reveal className="max-w-4xl mx-auto text-center">
						<h2 className="headline text-[2.6rem] sm:text-7xl leading-[1.02] mb-6">
							Mach den Tab zu.
							<br />
							<em className="italic font-[430] text-mark">Wir melden uns.</em>
						</h2>
						<p className="text-lg text-sheet/60 mb-10">
							Eine E-Mail, wenn dein Prüfungsamt Ergebnisse veröffentlicht. Kein
							Newsletter, keine Werbung.
						</p>
						<a
							href="#anmelden"
							className="group inline-flex items-center justify-center gap-2 h-14 px-8 w-full sm:w-auto rounded-full bg-mark text-ink text-base font-semibold transition-transform hover:-translate-y-0.5"
						>
							Kostenlos benachrichtigen lassen
							<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
						</a>
					</Reveal>
				</section>

				<footer className="px-4 sm:px-6 py-8 border-t border-sheet/10">
					<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-sheet/50">
						<p>
							&copy; {new Date().getFullYear()}{" "}
							<span className="headline text-base text-sheet/80">
								Examensradar
							</span>
						</p>
						<nav className="flex items-center gap-6">
							<Link
								to="/history"
								className="hover:text-sheet transition-colors"
							>
								Historie
							</Link>
							<Link
								to="/subscriptions"
								className="hover:text-sheet transition-colors"
							>
								Benachrichtigungen
							</Link>
						</nav>
					</div>
				</footer>
			</div>
		</div>
	);
}
