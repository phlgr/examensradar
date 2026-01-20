import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
	steps: string[];
	currentStep: number;
	className?: string;
}

export function ProgressSteps({
	steps,
	currentStep,
	className,
}: ProgressStepsProps) {
	return (
		<div className={cn("flex items-center justify-center gap-2", className)}>
			{steps.map((step, index) => {
				const isCompleted = index < currentStep;
				const isCurrent = index === currentStep;

				return (
					<React.Fragment key={step}>
						<div className="flex flex-col items-center">
							<div
								className={cn(
									"w-10 h-10 border-3 border-nb-black flex items-center justify-center font-black text-sm",
									isCompleted && "bg-nb-mint",
									isCurrent && "bg-nb-yellow",
									!isCompleted && !isCurrent && "bg-nb-white",
								)}
							>
								{isCompleted ? <Check className="w-5 h-5" /> : index + 1}
							</div>
							<span className="text-xs font-bold mt-1 text-center max-w-[60px] hidden sm:block">
								{step}
							</span>
						</div>
						{index < steps.length - 1 && (
							<div
								className={cn(
									"w-8 h-1 border-2 border-nb-black sm:mb-5",
									isCompleted ? "bg-nb-mint" : "bg-nb-white",
								)}
							/>
						)}
					</React.Fragment>
				);
			})}
		</div>
	);
}
