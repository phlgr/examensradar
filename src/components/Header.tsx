import { Link, type LinkProps, useRouterState } from "@tanstack/react-router";
import { Bell, CalendarClock, type LucideIcon, Radar } from "lucide-react";
import { IconBox } from "@/components/ui/icon-box";
import { cn } from "@/lib/utils";

function NavLink({
	to,
	icon: Icon,
	desk,
	children,
}: {
	to: LinkProps["to"];
	icon: LucideIcon;
	desk: boolean;
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
			className={
				desk
					? "ui inline-flex items-center gap-1.5 h-10 px-2 text-sm text-ink/75 underline-offset-4 decoration-1 hover:text-ink hover:underline"
					: "inline-flex items-center gap-2 h-10 px-2.5 sm:px-3 border-3 border-transparent font-black uppercase text-sm transition-colors [&:not([data-status=active])]:hover:border-nb-black [&:not([data-status=active])]:hover:bg-nb-white data-[status=active]:border-nb-black data-[status=active]:bg-nb-black data-[status=active]:text-nb-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
			}
		>
			<Icon className={cn("shrink-0", desk ? "w-4 h-4" : "w-5 h-5")} />
			<span className="hidden md:inline">{children}</span>
		</Link>
	);
}

export default function Header() {
	// Style preview: the landing page is trying out the "desk" look while the
	// app pages stay brutalist, so the header follows whichever page it is on.
	const desk = useRouterState({
		select: (state) => state.location.pathname === "/",
	});

	return (
		<header
			className={
				desk
					? "desk sticky top-0 z-40 bg-paper border-b border-ink/15"
					: "sticky top-0 z-40 bg-nb-yellow border-b-4 border-nb-black"
			}
		>
			<div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
				<Link
					to="/"
					className={
						desk
							? "flex items-center gap-2"
							: "flex items-center gap-2.5 cursor-pointer hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
					}
				>
					{desk ? (
						<>
							<Radar className="w-5 h-5 text-seal" strokeWidth={2.25} />
							<span className="headline text-[1.35rem] leading-none">
								Examensradar
							</span>
						</>
					) : (
						<>
							<IconBox color="white" size="sm" shadow>
								<Radar className="w-5 h-5" />
							</IconBox>
							<span className="font-display-wide uppercase text-lg sm:text-xl leading-none">
								Examensradar
							</span>
						</>
					)}
				</Link>

				<nav className="flex items-center gap-1 sm:gap-2">
					<NavLink to="/history" icon={CalendarClock} desk={desk}>
						Historie
					</NavLink>
					<NavLink to="/subscriptions" icon={Bell} desk={desk}>
						Benachrichtigungen
					</NavLink>
				</nav>
			</div>
		</header>
	);
}
