import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MailCheck, Zap } from "lucide-react";
import { buildTargets, Radar } from "@/components/landing/Radar";
import { Reveal } from "@/components/landing/Reveal";
import { SignupForm } from "@/components/landing/SignupForm";
import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

const STEPS = [
	{
		icon: Mail,
		title: "Amt wählen, Mail eintragen",
		description:
			"Such dein Justizprüfungsamt aus und trag deine E-Mail-Adresse ein. Keine App, kein Konto, kein Passwort.",
		color: "bg-nb-coral",
	},
	{
		icon: MailCheck,
		title: "Link im Postfach klicken",
		description:
			"Wir schicken dir einen Bestätigungslink. Ein Klick, und dein Prüfungsamt ist auf dem Radar.",
		color: "bg-nb-teal",
	},
	{
		icon: Zap,
		title: "Mail bekommen, wenn es losgeht",
		description:
			"Der Radar prüft die Ergebnisseite rund um die Uhr. Ändert sie sich, landet die Nachricht in deinem Postfach.",
		color: "bg-nb-yellow",
	},
];

const STATIC_TICKER = [
	"Keine App",
	"Kein Konto",
	"Eine Mail pro Veröffentlichung",
	"Abmelden mit einem Klick",
];

const tickerDate = (date: Date) =>
	date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

function LandingPage() {
	const jpasQuery = trpc.jpa.getAll.useQuery();
	const historyQuery = trpc.jpa.getHistory.useQuery();

	const jpaCount = jpasQuery.data?.length ?? 0;
	const targets = historyQuery.data
		? buildTargets(historyQuery.data, new Date())
		: [];

	const tickerItems = [
		...targets.flatMap((target) => [
			`${target.short}: zuletzt ${tickerDate(target.lastRelease)} um ${target.typicalHour} Uhr`,
			...(target.prediction
				? [
						`${target.short}: nächste voraussichtlich ${tickerDate(target.prediction.date)}`,
					]
				: []),
		]),
		...STATIC_TICKER,
	];

	return (
		<div className="flex-1">
			{/* Hero */}
			<section className="bg-graph-paper border-b-4 border-nb-black">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-20 grid gap-10 lg:gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
					<div>
						<p
							className="animate-rise inline-flex items-center gap-2 bg-nb-black text-nb-white text-[11px] font-black uppercase tracking-wider px-3 py-1.5 mb-6"
							style={{ animationDelay: "0ms" }}
						>
							<span className="w-2 h-2 bg-nb-mint animate-blink" aria-hidden />
							Radar aktiv
							{jpaCount > 0 && (
								<span className="text-white/60 font-bold normal-case tracking-normal">
									· beobachtet{" "}
									{jpaCount === 1
										? "1 Prüfungsamt"
										: `${jpaCount} Prüfungsämter`}
								</span>
							)}
						</p>

						<h1
							className="animate-rise font-display-wide uppercase text-[clamp(2.25rem,9.5vw,4rem)] lg:text-[3.9rem] leading-[0.95] mb-6"
							style={{ animationDelay: "80ms" }}
						>
							Schluss mit
							<br />
							<span className="whitespace-nowrap">
								<span className="animate-keypress inline-block align-baseline bg-nb-white border-4 border-nb-black px-2 sm:px-3 leading-none py-1 mr-1 shadow-[0_8px_0_0_var(--nb-black)]">
									F5
								</span>
								-Drücken.
							</span>
						</h1>

						<p
							className="animate-rise text-base sm:text-lg font-bold max-w-xl mb-8"
							style={{ animationDelay: "160ms" }}
						>
							Examensradar beobachtet die Ergebnisseite deines
							Justizprüfungsamts und schreibt dir eine E-Mail, sobald die
							Examensergebnisse online sind. Du wartest, wir laden neu.
						</p>

						<div className="animate-rise" style={{ animationDelay: "240ms" }}>
							<SignupForm jpas={jpasQuery.data} loading={jpasQuery.isLoading} />
						</div>
					</div>

					<div className="animate-rise" style={{ animationDelay: "200ms" }}>
						<Radar
							entries={historyQuery.data}
							loading={historyQuery.isLoading}
						/>
					</div>
				</div>
			</section>

			{/* Ticker */}
			<div
				className="bg-nb-black text-nb-yellow border-b-4 border-nb-black overflow-hidden py-3 group"
				aria-hidden
			>
				<div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
					{[0, 1].map((copy) => (
						<ul key={copy} className="flex shrink-0 items-center">
							{tickerItems.map((item) => (
								<li
									key={`${copy}-${item}`}
									className="flex items-center gap-6 pr-6 text-sm font-black uppercase whitespace-nowrap"
								>
									{item}
									<span className="w-2.5 h-2.5 bg-nb-yellow" />
								</li>
							))}
						</ul>
					))}
				</div>
			</div>

			{/* How it works */}
			<section className="bg-nb-cream py-14 sm:py-20 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto">
					<Reveal className="mb-10 sm:mb-14 max-w-2xl">
						<h2 className="font-display-wide uppercase text-4xl sm:text-5xl leading-none mb-4">
							So läuft's
						</h2>
						<p className="font-bold text-base sm:text-lg">
							Drei Schritte, zwei Minuten, danach nie wieder die Ergebnisseite
							neu laden.
						</p>
					</Reveal>

					<ol className="relative grid gap-6 md:grid-cols-3 md:gap-8 md:before:absolute md:before:top-10 md:before:left-8 md:before:right-8 md:before:h-1 md:before:bg-nb-black">
						{STEPS.map((step, index) => (
							<li key={step.title} className="relative">
								<Reveal delay={index * 140} className="h-full">
									<div className="h-full bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)] p-5 sm:p-6 transition-transform duration-200 hover:-translate-y-1.5">
										<div className="flex items-end justify-between mb-5">
											<div
												className={cn(
													"w-16 h-16 border-4 border-nb-black flex items-center justify-center shadow-[var(--nb-shadow-sm)] font-display-wide text-4xl leading-none",
													step.color,
												)}
											>
												{index + 1}
											</div>
											<step.icon className="w-8 h-8 text-nb-black/40" />
										</div>
										<h3 className="text-lg sm:text-xl font-black uppercase mb-2 leading-tight">
											{step.title}
										</h3>
										<p className="font-medium text-sm sm:text-base">
											{step.description}
										</p>
									</div>
								</Reveal>
							</li>
						))}
					</ol>
				</div>
			</section>

			{/* Final call */}
			<section className="bg-nb-coral border-y-4 border-nb-black py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
				<Reveal className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
					<h2 className="font-display-wide uppercase text-[clamp(2.25rem,8vw,3.5rem)] lg:text-6xl leading-[0.95] max-w-3xl">
						Der Radar läuft rund um die Uhr.{" "}
						<span className="bg-nb-black text-nb-coral px-3 inline-block mt-3 -rotate-1">
							Du musst nicht.
						</span>
					</h2>
					<a
						href="#anmelden"
						className={cn(
							buttonVariants({ size: "lg" }),
							"bg-nb-black text-nb-white shadow-[6px_6px_0_0_var(--nb-white)] hover:shadow-none w-full sm:w-auto",
						)}
					>
						Kostenlos eintragen
					</a>
				</Reveal>
			</section>

			{/* Footer */}
			<footer className="py-6 px-4 sm:px-6 bg-nb-black text-nb-white">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-bold">
					<p>&copy; {new Date().getFullYear()} EXAMENSRADAR</p>
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
