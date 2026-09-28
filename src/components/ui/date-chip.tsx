import { cva, type VariantProps } from "class-variance-authority";
import type { ReleasePrediction } from "@/lib/prediction";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	relativeLabel,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

const dateChipVariants = cva("inline-block", {
	variants: {
		tone: {
			/** Expected in the future. */
			upcoming: "bg-nb-teal",
			/** Predicted date has passed. */
			overdue: "bg-nb-coral",
		},
		size: {
			inline: "px-1",
			label: "px-1 border-2 border-nb-black",
			display:
				"font-display-wide text-xl sm:text-2xl leading-none px-1.5 py-0.5 border-2 border-nb-black",
		},
	},
	defaultVariants: { tone: "upcoming", size: "inline" },
});

interface DateChipProps extends VariantProps<typeof dateChipVariants> {
	date: Date;
	className?: string;
}

/** A highlighted day-and-month, coloured by whether it is still ahead. */
export function DateChip({ date, tone, size, className }: DateChipProps) {
	return (
		<span className={cn(dateChipVariants({ tone, size }), className)}>
			{formatDayMonth(date)}
		</span>
	);
}

interface PredictionNoteProps {
	prediction: ReleasePrediction;
	/** Days until the predicted date; negative means overdue. */
	daysUntil: number;
	/** Lead-in before the date. */
	prefix?: string;
	/** What follows the date: how sure we are, or how far away it is. */
	detail?: "confidence" | "relative";
	chipSize?: DateChipProps["size"];
	className?: string;
}

/**
 * "Voraussichtlich am [16. November] · grobe Schätzung" in one consistent
 * shape. Once the date has passed the sentence changes tense and says how
 * long it has been, so the coral chip is never the only signal.
 */
export function PredictionNote({
	prediction,
	daysUntil,
	prefix = "Voraussichtlich am",
	detail = "confidence",
	chipSize,
	className,
}: PredictionNoteProps) {
	const overdue = daysUntil < 0;
	return (
		<span className={cn("text-sm font-bold", className)}>
			{overdue ? "Erwartet am" : prefix}{" "}
			<DateChip
				date={prediction.date}
				tone={overdue ? "overdue" : "upcoming"}
				size={chipSize}
			/>{" "}
			<span className="font-medium text-nb-black/60">
				{detail === "confidence" && !overdue
					? `· ${CONFIDENCE_LABEL[prediction.confidence]}`
					: `· ${relativeLabel(daysUntil)}`}
			</span>
		</span>
	);
}
