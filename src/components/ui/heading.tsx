import type * as React from "react";
import { cn } from "@/lib/utils";

/** Small label above a value, e.g. "Zuletzt" over a date. */
export function Eyebrow({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-[13px] font-medium text-ink/50", className)}
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

/** Serif title plus one intro paragraph — the opening of every page. */
export function SectionIntro({
	as: Tag = "h2",
	title,
	children,
	className,
	textClassName,
}: SectionIntroProps) {
	return (
		<div className={className}>
			<Tag
				lang="de"
				className="headline text-[2.4rem] sm:text-6xl leading-[1.02] mb-5 break-words [hyphens:auto] sm:[hyphens:manual]"
			>
				{title}
			</Tag>
			<p
				className={cn(
					"text-lg text-ink/70 leading-relaxed max-w-2xl",
					textClassName,
				)}
			>
				{children}
			</p>
		</div>
	);
}
