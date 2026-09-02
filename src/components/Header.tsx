import { Link, type LinkProps } from "@tanstack/react-router";
import { Bell, CalendarClock, type LucideIcon, Radar } from "lucide-react";

function NavLink({
	to,
	icon: Icon,
	children,
}: {
	to: LinkProps["to"];
	icon: LucideIcon;
	children: string;
}) {
	return (
		<Link
			to={to}
			aria-label={children}
			title={children}
			className="inline-flex items-center gap-2 h-10 px-2.5 sm:px-3 border-3 border-transparent font-black uppercase text-sm transition-colors hover:border-nb-black hover:bg-nb-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
			activeProps={{
				className:
					"border-nb-black bg-nb-black text-nb-white hover:bg-nb-black",
			}}
		>
			<Icon className="w-5 h-5 shrink-0" />
			<span className="hidden md:inline">{children}</span>
		</Link>
	);
}

export default function Header() {
	return (
		<header className="sticky top-0 z-40 bg-nb-yellow border-b-4 border-nb-black">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
				<Link
					to="/"
					className="flex items-center gap-2.5 cursor-pointer hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
				>
					<div className="bg-nb-white p-1.5 border-3 border-nb-black shadow-[var(--nb-shadow-sm)]">
						<Radar className="w-5 h-5 text-nb-black" />
					</div>
					<span className="font-display-wide uppercase text-lg sm:text-xl leading-none">
						Examensradar
					</span>
				</Link>

				<nav className="flex items-center gap-1 sm:gap-2">
					<NavLink to="/history" icon={CalendarClock}>
						Historie
					</NavLink>
					<NavLink to="/subscriptions" icon={Bell}>
						Benachrichtigungen
					</NavLink>
				</nav>
			</div>
		</header>
	);
}
