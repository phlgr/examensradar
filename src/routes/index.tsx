import { createFileRoute } from "@tanstack/react-router";
import { History, Plus, Smartphone, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
	const steps = [
		{
			icon: <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />,
			title: "1. ntfy einrichten",
			description: "Installiere die ntfy App auf deinem Smartphone.",
			color: "bg-nb-coral",
		},
		{
			icon: <Plus className="w-6 h-6 sm:w-8 sm:h-8" />,
			title: "2. JPA auswählen",
			description: "Wähle dein Justizprüfungsamt und abonniere den Kanal.",
			color: "bg-nb-teal",
		},
		{
			icon: <Zap className="w-6 h-6 sm:w-8 sm:h-8" />,
			title: "3. Benachrichtigt werden",
			description:
				"Erhalte sofort eine Push-Nachricht, wenn neue Ergebnisse da sind.",
			color: "bg-nb-yellow",
		},
	];

	return (
		<div className="min-h-screen">
			{/* Hero Section */}
			<section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-nb-mint">
				<div className="max-w-4xl mx-auto">
					<Card className="pt-6 px-6 pb-3 sm:pt-8 sm:px-8 sm:pb-4 md:pt-12 md:px-12 md:pb-6">
						<h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-nb-black mb-4 sm:mb-6 uppercase leading-tight">
							Schluss mit
							<br />
							<span className="bg-nb-coral px-2 inline-block -rotate-1">
								F5-Drücken
							</span>
						</h1>
						<p className="text-lg sm:text-xl md:text-2xl font-bold mb-6 sm:mb-8 max-w-2xl">
							Wir benachrichtigen dich sofort, wenn das Justizprüfungsamt neue
							Examensergebnisse veröffentlicht.
						</p>
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
							<LinkButton
								to="/subscriptions"
								size="lg"
								className="w-full sm:w-auto"
							>
								Jetzt starten
							</LinkButton>
							<LinkButton
								to="/history"
								variant="ghost"
								size="sm"
								className="w-full sm:w-auto gap-1.5"
							>
								<History className="w-4 h-4" />
								Ergebnis-Historie
							</LinkButton>
						</div>
					</Card>
				</div>
			</section>

			{/* How it works */}
			<section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-nb-cream">
				<div className="max-w-5xl mx-auto">
					<h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-center mb-8 sm:mb-12 md:mb-16 uppercase">
						So funktioniert's
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
						{steps.map((step) => (
							<Card key={step.title} hover>
								<CardContent className="p-4 sm:p-6">
									<div
										className={`w-12 h-12 sm:w-16 sm:h-16 ${step.color} border-3 sm:border-4 border-nb-black flex items-center justify-center mb-3 sm:mb-4 shadow-[var(--nb-shadow-sm)]`}
									>
										{step.icon}
									</div>
									<h3 className="text-lg sm:text-xl font-black uppercase mb-2 sm:mb-3">
										{step.title}
									</h3>
									<p className="font-medium text-sm sm:text-base">
										{step.description}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* History Teaser */}
			<section className="py-12 sm:py-16 px-4 sm:px-6 bg-nb-teal">
				<div className="max-w-4xl mx-auto">
					<Card variant="primary" className="p-6 sm:p-8">
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
							<div className="w-14 h-14 bg-nb-black border-4 border-nb-black flex items-center justify-center shrink-0 shadow-[var(--nb-shadow-sm)]">
								<History className="w-7 h-7 text-nb-yellow" />
							</div>
							<div className="flex-1">
								<h2 className="text-xl sm:text-2xl font-black uppercase mb-1">
									Wann veröffentlicht dein JPA?
								</h2>
								<p className="font-medium text-sm sm:text-base">
									In der Historie siehst du, an welchen Tagen die Prüfungsämter
									in der Vergangenheit Ergebnisse veröffentlicht haben —
									inklusive typischem Tag und Uhrzeit.
								</p>
							</div>
							<LinkButton
								to="/history"
								variant="default"
								size="lg"
								className="shrink-0 w-full sm:w-auto"
							>
								Zur Historie
							</LinkButton>
						</div>
					</Card>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-nb-coral">
				<div className="max-w-3xl mx-auto">
					<Card variant="primary" className="p-6 sm:p-8 md:p-12 text-center">
						<h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase mb-3 sm:mb-4">
							Bereit für stressfreies Warten?
						</h2>
						<p className="text-base sm:text-lg font-bold mb-6 sm:mb-8">
							Starte jetzt und verpasse keine Ergebnisveröffentlichung mehr.
						</p>
						<LinkButton
							to="/subscriptions"
							className="bg-nb-black text-nb-white shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:shadow-none w-full sm:w-auto"
							size="lg"
						>
							Kostenlos starten
						</LinkButton>
					</Card>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-6 px-6 bg-nb-black text-nb-white border-t-4 border-nb-black">
				<div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
					<p className="font-bold">
						&copy; {new Date().getFullYear()} EXAMENSRADAR
					</p>
				</div>
			</footer>
		</div>
	);
}
