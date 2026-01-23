import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva("border-4 border-nb-black", {
	variants: {
		variant: {
			default: "bg-nb-white shadow-[var(--nb-shadow)]",
			flat: "bg-nb-white",
			primary: "bg-nb-yellow shadow-[var(--nb-shadow)]",
			accent: "bg-nb-teal shadow-[var(--nb-shadow)]",
			success: "bg-nb-mint shadow-[var(--nb-shadow)]",
			destructive: "bg-nb-coral shadow-[var(--nb-shadow)]",
			muted: "bg-nb-cream shadow-[var(--nb-shadow)]",
		},
		hover: {
			true: "transition-all cursor-pointer hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5",
			false: "",
		},
	},
	defaultVariants: {
		variant: "default",
		hover: false,
	},
});

interface CardProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
	({ className, variant, hover, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(cardVariants({ variant, hover, className }))}
			{...props}
		/>
	),
);
Card.displayName = "Card";

const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardContent };
