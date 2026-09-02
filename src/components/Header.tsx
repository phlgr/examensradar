import { Link, type LinkProps } from "@tanstack/react-router";
import { Bell, CalendarClock, type LucideIcon, Radar } from "lucide-react";
import { IconBox } from "@/components/ui/icon-box";

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
			// TanStack sets data-status="active" on the current route's link; the
			// hover styles only apply to the others so the active pill stays
			// black-on-white-text under the cursor.
			className="inline-flex items-center gap-2 h-10 px-2.5 sm:px-3 border-3 border-transparent font-black uppercase text-sm transition-colors [&:not([data-status=active])]:hover:border-nb-black [&:not([data-status=active])]:hover:bg-nb-white data-[status=active]:border-nb-black data-[status=active]:bg-nb-black data-[status=active]:text-nb-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
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
					<IconBox color="white" size="sm" shadow>
						<Radar className="w-5 h-5" />
					</IconBox>
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
