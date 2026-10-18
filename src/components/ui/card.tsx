import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-lg ring-1", {
	variants: {
		variant: {
			default: "bg-sheet ring-ink/10",
			muted: "bg-ink/[0.03] ring-ink/10",
			success: "bg-ok-soft ring-ok/20",
			destructive: "bg-seal-soft ring-seal/20",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

interface CardProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
	({ className, variant, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(cardVariants({ variant, className }))}
			{...props}
		/>
	),
);
Card.displayName = "Card";

export { Card };
