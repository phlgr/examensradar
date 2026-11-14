import { Link } from "@tanstack/react-router";
import { groupByLand, type Land } from "@/lib/laender";
import { jpaParam } from "@/lib/seo";

interface FooterProps {
	jpas: Array<{ slug: string; name: string; land: Land | null }>;
}

export function Footer({ jpas }: FooterProps) {
	const groups = groupByLand(jpas);
	return (
		<footer className="px-4 sm:px-6 py-8 border-t border-ink/10">
			<div className="max-w-6xl mx-auto flex flex-col gap-6 text-sm text-ink/50">
				{groups.length > 0 && (
					<nav aria-label="Examensergebnisse nach Prüfungsamt">
						<p className="mb-3 font-medium text-ink/70">
							Examensergebnisse nach Prüfungsamt
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
							{groups.map(({ heading, offices }) => (
								<div key={heading}>
									<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
										{heading}
									</p>
									<ul className="flex flex-col gap-1">
										{offices.map((jpa) => (
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
								</div>
							))}
						</div>
					</nav>
				)}
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
					<p>
						&copy; {new Date().getFullYear()}{" "}
						<span className="headline text-base text-ink/80">Examensradar</span>
					</p>
					<nav className="flex items-center gap-6">
						<Link to="/ergebnisse" className="hover:text-ink transition-colors">
							Ergebnisse
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
