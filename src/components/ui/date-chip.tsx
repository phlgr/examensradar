import type { ReleasePrediction } from "@/lib/prediction";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	relativeLabel,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

interface PredictionNoteProps {
	prediction: ReleasePrediction;
	daysUntil: number;
	prefix?: string;
	detail?: "confidence" | "relative";
	className?: string;
}

export function PredictionNote({
	prediction,
	daysUntil,
	prefix = "Voraussichtlich am",
	detail = "confidence",
	className,
}: PredictionNoteProps) {
	const overdue = daysUntil < 0;
	return (
		<span className={cn("text-[15px] text-ink/70", className)}>
			{overdue ? "Erwartet am" : prefix}{" "}
			<span
				className={cn(
					"font-semibold text-ink whitespace-nowrap",
					overdue
						? "underline decoration-seal decoration-2 underline-offset-4"
						: "marker",
				)}
			>
				{formatDayMonth(prediction.date)}
			</span>
			<span className="text-ink/45">
				{" "}
				·{" "}
				{detail === "confidence" && !overdue
					? CONFIDENCE_LABEL[prediction.confidence]
					: relativeLabel(daysUntil)}
			</span>
		</span>
	);
}
