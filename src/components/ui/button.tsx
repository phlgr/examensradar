import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 font-black uppercase transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-nb-yellow text-nb-black border-4 border-nb-black shadow-[var(--nb-shadow)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5",
				secondary:
					"bg-nb-white text-nb-black border-4 border-nb-black shadow-[var(--nb-shadow)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5",
				destructive:
					"bg-nb-coral text-nb-black border-4 border-nb-black shadow-[var(--nb-shadow)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5",
				success:
					"bg-nb-mint text-nb-black border-4 border-nb-black shadow-[var(--nb-shadow)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5",
				accent:
					"bg-nb-teal text-nb-black border-4 border-nb-black shadow-[var(--nb-shadow)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5",
				outline:
					"bg-transparent text-nb-black border-4 border-nb-black shadow-[var(--nb-shadow)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5 hover:bg-nb-yellow",
				ghost:
					"bg-transparent text-nb-black border-4 border-transparent hover:border-nb-black hover:bg-nb-yellow",
				link: "text-nb-black underline decoration-2 underline-offset-4 hover:bg-nb-yellow",
				icon: "bg-nb-black text-nb-white border-3 border-nb-black hover:bg-nb-teal hover:text-nb-black",
			},
			size: {
				default: "h-12 px-6 py-3 text-base",
				sm: "h-10 px-4 py-2 text-sm",
				lg: "h-14 px-8 py-4 text-lg",
				icon: "h-10 w-10 p-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, ...props }, ref) => {
		return (
			<button
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
