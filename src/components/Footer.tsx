import { Link } from "@tanstack/react-router";
import { jpaParam } from "@/lib/seo";

interface FooterProps {
	jpas: Array<{ slug: string; name: string }>;
}

export function Footer({ jpas }: FooterProps) {
	return (
		<footer className="px-4 sm:px-6 py-8 border-t border-ink/10">
			<div className="max-w-6xl mx-auto flex flex-col gap-6 text-sm text-ink/50">
				{jpas.length > 0 && (
					<nav aria-label="Examensergebnisse nach Prüfungsamt">
						<p className="mb-2 font-medium text-ink/70">
							Examensergebnisse nach Prüfungsamt
						</p>
						<ul className="flex flex-wrap gap-x-6 gap-y-1">
							{jpas.map((jpa) => (
								<li key={jpa.slug}>
									<Link
										to="/ergebnisse/$jpa"
										params={{ jpa: jpaParam(jpa.slug) }}
										className="hover:text-ink transition-colors"
									>
										{jpa.name}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				)}
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
					<p>
						&copy; {new Date().getFullYear()}{" "}
						<span className="headline text-base text-ink/80">Examensradar</span>
					</p>
					<nav className="flex items-center gap-6">
						<Link to="/history" className="hover:text-ink transition-colors">
							Historie
						</Link>
						<Link
							to="/subscriptions"
							className="hover:text-ink transition-colors"
						>
							Benachrichtigungen
						</Link>
					</nav>
				</div>
			</div>
		</footer>
	);
}
