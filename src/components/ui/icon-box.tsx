import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const iconBoxVariants = cva(
	"flex items-center justify-center shrink-0 border-nb-black",
	{
		variants: {
			color: {
				yellow: "bg-nb-yellow",
				white: "bg-nb-white",
				teal: "bg-nb-teal",
				mint: "bg-nb-mint",
				coral: "bg-nb-coral",
			},
			size: {
				sm: "w-8 h-8 border-3",
				md: "w-10 h-10 border-3",
				lg: "w-16 h-16 border-4",
			},
			shadow: {
				true: "shadow-[var(--nb-shadow-sm)]",
				false: "",
			},
		},
		defaultVariants: { color: "yellow", size: "md", shadow: false },
	},
);

// `color` is also a (deprecated) HTML attribute; the variant wins here.
interface IconBoxProps
	extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
		VariantProps<typeof iconBoxVariants> {}

/** The bordered colour square that frames an icon or a step number. */
export function IconBox({
	color,
	size,
	shadow,
	className,
	...props
}: IconBoxProps) {
	return (
		<div
			className={cn(iconBoxVariants({ color, size, shadow }), className)}
			{...props}
		/>
	);
}
