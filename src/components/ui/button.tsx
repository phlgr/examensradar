import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-ink text-sheet hover:bg-seal",
				secondary:
					"bg-sheet text-ink ring-1 ring-ink/20 hover:ring-ink/50 hover:bg-sheet",
				destructive: "bg-seal text-sheet hover:bg-seal-deep",
				ghost: "bg-transparent text-ink/70 hover:text-ink hover:bg-ink/5",
				icon: "bg-transparent text-ink/60 hover:text-ink hover:bg-ink/5",
			},
			size: {
				default: "h-11 px-5 text-[15px]",
				sm: "h-9 px-3.5 text-sm",
				lg: "h-12 px-6 text-base",
				icon: "h-9 w-9 p-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

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

export { Button };
