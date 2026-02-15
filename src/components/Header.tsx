import { Link } from "@tanstack/react-router";
import { Bell, Radar } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function Header() {
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
				<LinkButton
					to="/subscriptions"
					variant="default"
					size="icon"
					aria-label="Benachrichtigungen"
					className="border-3 shadow-[var(--nb-shadow-sm)] hover:translate-x-1 hover:translate-y-1"
				>
					<Bell className="w-5 h-5" />
				</LinkButton>
			</nav>
		</header>
	);
}
