import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
	return (
		<input
			ref={ref}
			className={cn(
				"h-12 w-full bg-nb-white px-4 py-3 border-4 border-nb-black font-bold text-base placeholder:text-nb-black/40 placeholder:font-medium focus:outline-none focus:bg-nb-cream disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
});

Input.displayName = "Input";
