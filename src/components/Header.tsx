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
			// TanStack sets data-status="active" on the current route's link.
			className="inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-ink/70 transition-colors hover:text-ink hover:bg-ink/5 data-[status=active]:text-ink data-[status=active]:bg-ink/[0.07]"
		>
			<Icon className="w-4 h-4 shrink-0" />
			<span className="hidden md:inline">{children}</span>
		</Link>
	);
}

export default function Header() {
	return (
		<header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-ink/10">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
				<Link to="/" className="flex items-center gap-2.5 rounded-lg">
					<span className="w-8 h-8 rounded-[9px] bg-seal text-sheet grid place-items-center shadow-[inset_0_-2px_0_rgb(0_0_0/0.2)]">
						<Radar className="w-[18px] h-[18px]" />
					</span>
					<span className="headline text-[1.4rem] leading-none">
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
