import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NotificationPreview } from "@/components/landing/NotificationPreview";
import { SignupForm } from "@/components/landing/SignupForm";
import { UpcomingReleases } from "@/components/landing/UpcomingReleases";
import { summarizeReleases } from "@/lib/release-summary";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/")({ component: LandingPage });

const STEPS = [
	{
		title: "Eintragen.",
		description:
			"Justizprüfungsamt auswählen, E-Mail-Adresse eingeben. Kein Passwort, kein Konto.",
	},
	{
		title: "Bestätigen.",
		description:
			"Du bekommst einen Link von uns. Ein Klick darauf, und die Benachrichtigung ist scharf.",
	},
	{
		title: "Abschalten.",
		description:
			"Ab jetzt behalten wir die Ergebnisseite im Blick. Steht dort etwas Neues, hast du eine E-Mail im Postfach.",
	},
] as const;

/** The F5 key as a real keycap, pressed every few seconds. */
function Keycap({ children }: { children: string }) {
	return (
		<kbd className="ui animate-keypress relative inline-grid place-items-center align-[0.14em] min-w-[1.45em] h-[1.18em] px-[0.18em] mx-[0.04em] rounded-[0.14em] bg-gradient-to-b from-sheet to-[#efe8d8] ring-1 ring-ink/20 font-semibold text-[0.6em] tracking-normal text-ink/80">
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
			{/* Hero, on ruled exam paper with its red margin line. */}
			<section className="relative overflow-hidden">
				<div
					className="absolute inset-0 bg-ruled [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
					aria-hidden
				/>
				<div
					className="absolute inset-y-0 left-[max(1rem,calc(50%-36rem))] w-px bg-seal/30 hidden sm:block"
					aria-hidden
				/>

				<div className="relative max-w-6xl mx-auto px-4 sm:px-6 sm:pl-12 pt-12 pb-16 sm:pt-20 sm:pb-24 grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 items-start">
					<div>
						<h1 className="headline text-[clamp(2.9rem,10vw,5.25rem)] leading-[1] mb-7">
							Schluss mit
							<br />
							<span className="whitespace-nowrap">
								<Keycap>F5</Keycap>
								<span className="marker marker-draw">-Drücken.</span>
							</span>
						</h1>

						<p className="text-xl text-ink/80 leading-relaxed max-w-xl mb-10">
							Die Klausuren im ersten Examen hast du geschrieben. Das Warten
							übernehmen wir: Examensradar behält die Ergebnisseite deines
							Justizprüfungsamts im Blick und schickt dir eine E-Mail, sobald
							neue Ergebnisse online sind.
						</p>

						<div className="max-w-xl">
							<SignupForm
								jpas={jpasQuery.data}
								loading={jpasQuery.isLoading}
								error={jpasQuery.isError}
								jpaId={jpaId}
								onJpaChange={setJpaId}
							/>
						</div>
					</div>

					<div className="max-w-md w-full mx-auto lg:max-w-none lg:mt-3">
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

			{/* How it works, set like statute text: § in the margin, run-in titles. */}
			<section className="bg-sheet border-t border-ink/15 py-16 sm:py-24 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[5fr_7fr] lg:gap-20">
					<div>
						<h2 className="headline text-4xl sm:text-5xl leading-[1.05] mb-5">
							Einfacher als jede Klausur.
						</h2>
						<p className="text-lg text-ink/75 leading-relaxed">
							Eintragen, bestätigen, fertig. Das Ganze dauert keine Minute.
						</p>
					</div>

					<ol className="border-t-2 border-ink lg:mt-2">
						{STEPS.map((step, index) => (
							<li
								key={step.title}
								className="grid grid-cols-[3.25rem_1fr] sm:grid-cols-[4.5rem_1fr] py-5 border-b border-ink/15"
							>
								<span
									className="headline text-seal text-2xl sm:text-3xl leading-none pt-0.5"
									aria-hidden
								>
									§&thinsp;{index + 1}
								</span>
								<p className="text-lg leading-relaxed text-ink/80">
									<strong className="font-bold text-ink">{step.title}</strong>{" "}
									{step.description}
								</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			<UpcomingReleases
				summaries={summaries}
				loading={historyQuery.isLoading}
			/>

			{/* Closing line and footer. */}
			<section className="border-t border-ink/15 px-4 sm:px-6 py-16 sm:py-20">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-6">
					<div>
						<h2 className="headline text-4xl sm:text-5xl leading-[1.05]">
							Mach den Tab zu. Wir melden uns.
						</h2>
						<p className="text-lg text-ink/75 mt-4">
							Eine E-Mail, wenn dein Prüfungsamt Ergebnisse veröffentlicht. Kein
							Newsletter, keine Werbung.
						</p>
					</div>
					<a
						href="#anmelden"
						className="ui shrink-0 inline-flex items-center justify-center h-11 px-5 rounded-[3px] bg-seal text-sheet text-[15px] font-semibold hover:bg-seal-deep"
					>
						Benachrichtigen lassen
					</a>
				</div>
			</section>

			<footer className="ui border-t border-ink/15 px-4 sm:px-6 py-6">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-ink/55">
					<p>&copy; {new Date().getFullYear()} Examensradar</p>
					<nav className="flex items-center gap-5">
						<Link to="/history" className="hover:text-ink hover:underline">
							Historie
						</Link>
						<Link
							to="/subscriptions"
							className="hover:text-ink hover:underline"
						>
							Benachrichtigungen
						</Link>
					</nav>
				</div>
			</footer>
		</div>
	);
}
