import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Radar, Settings, User } from "lucide-react";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function Header() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const handleSignOut = async () => {
		await authClient.signOut();
		navigate({ to: "/" });
	};

	return (
		<header className="px-6 py-4 flex items-center justify-between bg-nb-coral border-b-4 border-nb-black">
			<Link
				to="/"
				className="flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 transition-transform"
			>
				<div className="bg-nb-yellow p-2 border-3 border-nb-black shadow-[var(--nb-shadow-sm)]">
					<Radar className="w-6 h-6 text-nb-black" />
				</div>
				<span className="text-2xl font-black text-nb-black uppercase tracking-tight">
					Examensradar
				</span>
			</Link>

			<nav className="flex items-center gap-4">
				{session?.user ? (
					<div className="relative">
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							{session.user.image ? (
								<img
									src={session.user.image}
									alt=""
									className="w-6 h-6 border-2 border-nb-black"
								/>
							) : (
								<User className="w-5 h-5" />
							)}
							<span className="hidden sm:inline">
								{session.user.name || session.user.email}
							</span>
						</Button>

						{isMenuOpen && (
							<>
								<button
									type="button"
									className="fixed inset-0 z-40 cursor-default"
									onClick={() => setIsMenuOpen(false)}
									onKeyDown={(e) => e.key === "Escape" && setIsMenuOpen(false)}
									aria-label="Menü schließen"
								/>
								<div className="absolute right-0 mt-2 w-56 bg-nb-white border-3 border-nb-black shadow-[var(--nb-shadow)] z-50">
									<Link
										to="/subscriptions"
										onClick={() => setIsMenuOpen(false)}
										className="w-full flex items-center gap-3 px-4 py-3 font-bold text-sm hover:bg-nb-yellow transition-colors cursor-pointer"
									>
										<Radar className="w-4 h-4 shrink-0" />
										<span>Benachrichtigungen</span>
									</Link>
									<div className="border-t-2 border-nb-black" />
									<Link
										to="/account"
										onClick={() => setIsMenuOpen(false)}
										className="w-full flex items-center gap-3 px-4 py-3 font-bold text-sm hover:bg-nb-yellow transition-colors cursor-pointer"
									>
										<Settings className="w-4 h-4 shrink-0" />
										<span>Konto</span>
									</Link>
									<div className="border-t-2 border-nb-black" />
									<button
										type="button"
										onClick={() => {
											setIsMenuOpen(false);
											handleSignOut();
										}}
										className="w-full flex items-center gap-3 px-4 py-3 font-bold text-sm hover:bg-nb-yellow transition-colors cursor-pointer"
									>
										<LogOut className="w-4 h-4 shrink-0" />
										<span>Abmelden</span>
									</button>
								</div>
							</>
						)}
					</div>
				) : (
					<LinkButton to="/auth/login" size="sm">
						Anmelden
					</LinkButton>
				)}
			</nav>
		</header>
	);
}
