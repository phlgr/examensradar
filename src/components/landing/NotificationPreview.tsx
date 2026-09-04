import { ArrowRight, Radar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { PredictionNote } from "@/components/ui/date-chip";
import { Eyebrow } from "@/components/ui/heading";
import { IconBox } from "@/components/ui/icon-box";
import { LinkButton } from "@/components/ui/link-button";
import type { ReleasePrediction } from "@/lib/prediction";
import { cn } from "@/lib/utils";

interface NotificationPreviewProps {
	jpa: { id: string; name: string } | undefined;
	prediction: ReleasePrediction | null;
	daysUntil: number | null;
	lastRelease: Date | null;
	/** History still loading — keep the line's space, show a placeholder. */
	loading: boolean;
	className?: string;
}

/**
 * The email you will get, rendered as it lands in the inbox — subject and body
 * mirror `renderResultsMail`. When the visitor picks a different office in the
 * form, a fresh notification slides in; the initial load (and the preselect
 * once the office list arrives) is left to the hero's own entrance animation
 * so the card doesn't jump twice.
 */
export function NotificationPreview({
	jpa,
	prediction,
	daysUntil,
	lastRelease,
	loading,
	className,
}: NotificationPreviewProps) {
	// Generic but grammatical stand-in until the office list arrives:
	// "Das Justizprüfungsamt hat …" reads fine, "Das dein …" does not.
	const name = jpa?.name ?? "Justizprüfungsamt";

	// Bumped only on a real office-to-office change; remounts the card.
	const [swap, setSwap] = useState(0);
	const previousId = useRef(jpa?.id);
	useEffect(() => {
		if (jpa?.id && previousId.current && previousId.current !== jpa.id) {
			setSwap((n) => n + 1);
		}
		previousId.current = jpa?.id;
	}, [jpa?.id]);

	return (
		<div className={cn("pt-6", className)}>
			<div className="relative">
				{/* Stack behind the live card: earlier notifications. */}
				<div
					className="absolute inset-x-3 -top-3 h-full border-4 border-nb-black bg-nb-white/70"
					aria-hidden
				/>
				<div
					className="absolute inset-x-6 -top-6 h-full border-4 border-nb-black bg-nb-white/40"
					aria-hidden
				/>

				<Card
					key={swap}
					className={cn("relative", swap > 0 && "animate-notify")}
				>
					<div className="flex items-center gap-3 px-4 py-3 border-b-4 border-nb-black">
						<IconBox size="sm">
							<Radar className="w-4 h-4" />
						</IconBox>
						<div className="flex-1 min-w-0 leading-tight">
							<p className="font-black text-sm">Examensradar</p>
							<p className="text-[11px] font-medium text-nb-black/50 truncate">
								noreply@examensradar.de
							</p>
						</div>
						<p className="text-[11px] font-bold text-nb-black/50 shrink-0">
							jetzt
						</p>
					</div>

					<div className="px-4 sm:px-5 py-5">
						<Eyebrow className="mb-1">Betreff</Eyebrow>
						<p className="font-black text-lg sm:text-xl leading-tight mb-4">
							Neue Ergebnisse: {name}
						</p>
						<p className="font-medium text-sm sm:text-base">
							Das <strong>{name}</strong> hat neue Examensergebnisse
							veröffentlicht.
						</p>
						{/* Where the real mail links to the office, the preview keeps
						    visitors on the site and answers "when?" instead. */}
						<LinkButton to="/history" size="sm" className="mt-5 h-11">
							Zur Historie
							<ArrowRight className="w-4 h-4" />
						</LinkButton>
					</div>

					<div className="px-4 sm:px-5 py-3 border-t-2 border-nb-black/10 text-xs font-medium text-nb-black/60">
						{lastRelease ? (
							<>
								Zuletzt verschickt am{" "}
								{lastRelease.toLocaleString("de-DE", {
									dateStyle: "long",
									timeStyle: "short",
								})}{" "}
								Uhr
							</>
						) : (
							"So sieht die E-Mail aus, die du bekommst."
						)}
					</div>
				</Card>
			</div>

			{/* Always rendered with reserved height, so the hero doesn't shift
			    when the history query resolves. */}
			<p className="mt-4 min-h-[2.75rem] text-sm font-bold">
				{prediction && daysUntil !== null ? (
					<PredictionNote
						prediction={prediction}
						daysUntil={daysUntil}
						prefix="Nächste voraussichtlich am"
					/>
				) : (
					<span className="font-medium text-nb-black/60">
						{loading
							? "Prognose wird geladen …"
							: "Für eine Prognose fehlen noch Daten."}
					</span>
				)}
			</p>
		</div>
	);
}
