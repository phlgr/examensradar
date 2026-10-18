import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const labelClass = "block text-[13px] font-medium text-ink/60 mb-1.5";

export const fieldClass =
	"h-11 w-full rounded-md bg-paper/60 border border-ink/15 px-4 text-base text-ink transition-colors placeholder:text-ink/35 hover:border-ink/30 focus:outline-none focus:border-ink focus:bg-sheet focus:ring-4 focus:ring-mark/60 disabled:opacity-50";

export const Input = forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
	return <input ref={ref} className={cn(fieldClass, className)} {...props} />;
});

Input.displayName = "Input";
