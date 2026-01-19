import { Link } from "@tanstack/react-router";
import { Bell, LogOut, User } from "lucide-react";
import { Button, LinkButton } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function Header() {
	const { data: session } = authClient.useSession();

	return (
		<header className="px-6 py-4 flex items-center justify-between bg-nb-coral border-b-4 border-nb-black">
			<Link
				to="/"
				className="flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
			>
				<div className="bg-nb-yellow p-2 border-3 border-nb-black shadow-[var(--nb-shadow-sm)]">
					<Bell className="w-6 h-6 text-nb-black" />
				</div>
				<span className="text-2xl font-black text-nb-black uppercase tracking-tight">
					Examensradar
				</span>
			</Link>

			<nav className="flex items-center gap-4">
				{session?.user ? (
					<>
						<LinkButton to="/dashboard" variant="secondary" size="sm">
							Dashboard
						</LinkButton>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2 bg-nb-white border-3 border-nb-black px-3 py-1.5 shadow-[var(--nb-shadow-sm)]">
								{session.user.image ? (
									<img
										src={session.user.image}
										alt=""
										className="w-7 h-7 border-2 border-nb-black"
									/>
								) : (
									<User className="w-5 h-5" />
								)}
								<span className="text-sm font-bold hidden sm:inline">
									{session.user.name || session.user.email}
								</span>
							</div>
							<Button
								variant="icon"
								size="icon"
								onClick={() => authClient.signOut()}
								title="Abmelden"
							>
								<LogOut className="w-5 h-5" />
							</Button>
						</div>
					</>
				) : (
					<LinkButton to="/auth/login" size="sm">
						Anmelden
					</LinkButton>
				)}
			</nav>
		</header>
	);
}
