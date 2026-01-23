import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center border-2 border-nb-black px-3 py-1 font-bold text-xs uppercase transition-colors",
	{
		variants: {
			variant: {
				default: "bg-nb-yellow text-nb-black",
				secondary: "bg-nb-white text-nb-black",
				accent: "bg-nb-teal text-nb-black",
				success: "bg-nb-mint text-nb-black",
				destructive: "bg-nb-coral text-nb-black",
				outline: "bg-transparent text-nb-black",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge };
