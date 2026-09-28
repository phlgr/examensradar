import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
	children: ReactNode;
	className?: string;
	/** Stagger offset in ms, applied as a transition delay. */
	delay?: number;
}

/**
 * Fades and lifts its children in once they scroll into view. Content is
 * rendered visible (SSR, crawlers, no JS) and only hidden after mount when it
 * actually sits below the fold, so nothing can get stuck invisible.
 * prefers-reduced-motion disables the movement in CSS.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [hidden, setHidden] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element || !("IntersectionObserver" in window)) return;
		if (element.getBoundingClientRect().top <= window.innerHeight) return;

		setHidden(true);
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setHidden(false);
					observer.disconnect();
				}
			},
			{ threshold: 0.15 },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={ref}
			className={cn("reveal", hidden && "reveal-hidden", className)}
			style={delay ? { transitionDelay: `${delay}ms` } : undefined}
		>
			{children}
		</div>
	);
}
