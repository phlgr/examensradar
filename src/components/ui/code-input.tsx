import * as React from "react";
import { cn } from "@/lib/utils";

interface CodeInputProps {
	length?: number;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	error?: boolean;
	className?: string;
}

export function CodeInput({
	length = 6,
	value,
	onChange,
	disabled = false,
	error = false,
	className,
}: CodeInputProps) {
	const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

	const handleChange = (index: number, char: string) => {
		// Only allow digits
		if (char && !/^\d$/.test(char)) return;

		const newValue = value.split("");
		newValue[index] = char;
		const result = newValue.join("").slice(0, length);
		onChange(result);

		// Auto-focus next input
		if (char && index < length - 1) {
			inputRefs.current[index + 1]?.focus();
		}
	};

	const handleKeyDown = (
		index: number,
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Backspace" && !value[index] && index > 0) {
			// Move to previous input on backspace if current is empty
			inputRefs.current[index - 1]?.focus();
		} else if (e.key === "ArrowLeft" && index > 0) {
			inputRefs.current[index - 1]?.focus();
		} else if (e.key === "ArrowRight" && index < length - 1) {
			inputRefs.current[index + 1]?.focus();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
		onChange(pasted.slice(0, length));

		// Focus last filled input or next empty one
		const focusIndex = Math.min(pasted.length, length - 1);
		inputRefs.current[focusIndex]?.focus();
	};

	return (
		<div className={cn("flex gap-2 justify-center", className)}>
			{Array.from({ length }).map((_, index) => (
				<input
					// biome-ignore lint/suspicious/noArrayIndexKey: array index key
					key={index}
					ref={(el) => {
						inputRefs.current[index] = el;
					}}
					type="text"
					inputMode="numeric"
					maxLength={1}
					value={value[index] || ""}
					onChange={(e) => handleChange(index, e.target.value)}
					onKeyDown={(e) => handleKeyDown(index, e)}
					onPaste={handlePaste}
					disabled={disabled}
					className={cn(
						"w-12 h-14 text-center text-2xl font-black border-3 border-nb-black bg-nb-white",
						"focus:outline-none focus:ring-4 focus:ring-nb-yellow focus:ring-offset-2",
						"disabled:opacity-50 disabled:cursor-not-allowed",
						error && "border-nb-coral bg-nb-coral/10",
					)}
				/>
			))}
		</div>
	);
}
