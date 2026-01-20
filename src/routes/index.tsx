import { createFileRoute } from "@tanstack/react-router";
import { Smartphone, UserPlus, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export const Route = createFileRoute("/")({ component: LandingPage });

function LandingPage() {
	const steps = [
		{
			icon: <UserPlus className="w-6 h-6 sm:w-8 sm:h-8" />,
			title: "1. Anmelden",
			description: "Erstelle ein Konto mit deinem Google-Account.",
			color: "bg-nb-coral",
		},
		{
			icon: <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />,
			title: "2. ntfy einrichten",
			description:
				"Installiere die ntfy App und abonniere deinen persönlichen Kanal.",
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
					<Card className="p-6 sm:p-8 md:p-12">
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
						<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
							<LinkButton
								to="/auth/login"
								size="lg"
								className="w-full sm:w-auto"
							>
								Jetzt starten
							</LinkButton>
							<LinkButton
								to="/subscriptions"
								variant="secondary"
								size="lg"
								className="w-full sm:w-auto"
							>
								Deine Benachrichtigungen
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

			{/* CTA Section */}
			<section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-nb-coral">
				<div className="max-w-3xl mx-auto">
					<Card variant="primary" className="p-6 sm:p-8 md:p-12 text-center">
						<h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase mb-3 sm:mb-4">
							Bereit für stressfreies Warten?
						</h2>
						<p className="text-base sm:text-lg font-bold mb-6 sm:mb-8">
							Melde dich jetzt an und verpasse keine Ergebnisveröffentlichung
							mehr.
						</p>
						<LinkButton
							to="/auth/login"
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
