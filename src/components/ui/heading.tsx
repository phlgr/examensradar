import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const displayHeadingVariants = cva("font-display-wide uppercase", {
	variants: {
		size: {
			/** The one-line brand statement in the landing hero. */
			hero: "text-[clamp(2.25rem,9.5vw,4rem)] lg:text-[3.9rem] leading-[0.95] mb-6",
			/** A landing section or page title. Long single words (Benachrichtigungen)
			 *  hyphenate on phones only. */
			page: "text-3xl sm:text-5xl leading-none mb-4 break-words [hyphens:auto] sm:[hyphens:manual]",
		},
	},
	defaultVariants: { size: "page" },
});

interface DisplayHeadingProps
	extends React.HTMLAttributes<HTMLHeadingElement>,
		VariantProps<typeof displayHeadingVariants> {
	as?: "h1" | "h2";
}

/** Wide, heavy display type for page and section titles. */
export function DisplayHeading({
	as: Tag = "h2",
	size,
	className,
	...props
}: DisplayHeadingProps) {
	return (
		<Tag
			lang="de"
			className={cn(displayHeadingVariants({ size }), className)}
			{...props}
		/>
	);
}

/** Tiny caps label above a value or field. Use for `<label>`s via `eyebrowClass`. */
export const eyebrowClass = "text-[11px] font-black uppercase tracking-wider";

interface EyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
	/** Greyed out (default) for captions; solid for labels on coloured panels. */
	muted?: boolean;
}

export function Eyebrow({ muted = true, className, ...props }: EyebrowProps) {
	return (
		<p
			className={cn(eyebrowClass, muted && "text-nb-black/50", className)}
			{...props}
		/>
	);
}

interface SectionIntroProps {
	as?: "h1" | "h2";
	title: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	/** Width cap for the intro paragraph; the title may run wider. */
	textClassName?: string;
}

/** Title plus one intro paragraph — the opening of every page and section. */
export function SectionIntro({
	as = "h2",
	title,
	children,
	className,
	textClassName,
}: SectionIntroProps) {
	return (
		<div className={className}>
			<DisplayHeading as={as}>{title}</DisplayHeading>
			<p className={cn("font-bold text-base sm:text-lg", textClassName)}>
				{children}
			</p>
		</div>
	);
}
