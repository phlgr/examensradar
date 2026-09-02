import { Link } from "@tanstack/react-router";
import { ArrowRight, Radar } from "lucide-react";
import type { ReleasePrediction } from "@/lib/prediction";
import { CONFIDENCE_LABEL, formatDayMonth } from "@/lib/release-summary";
import { cn } from "@/lib/utils";

interface NotificationPreviewProps {
	jpa: { id: string; name: string } | undefined;
	prediction: ReleasePrediction | null;
	lastRelease: Date | null;
	className?: string;
}

/**
 * The email you will get, rendered as it lands in the inbox — subject, body
 * and button mirror `renderResultsMail`. Keyed on the office so a change in
 * the form slides a fresh notification in.
 */
export function NotificationPreview({
	jpa,
	prediction,
	lastRelease,
	className,
}: NotificationPreviewProps) {
	const name = jpa?.name ?? "dein Justizprüfungsamt";

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

				<div
					key={jpa?.id ?? "none"}
					className="animate-notify relative bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)]"
				>
					<div className="flex items-center gap-3 px-4 py-3 border-b-4 border-nb-black">
						<div className="bg-nb-yellow border-3 border-nb-black p-1.5 shrink-0">
							<Radar className="w-4 h-4" />
						</div>
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
						<p className="text-[11px] font-black uppercase tracking-wider text-nb-black/50 mb-1">
							Betreff
						</p>
						<p className="font-black text-lg sm:text-xl leading-tight mb-4">
							Neue Ergebnisse: {name}
						</p>
						<p className="font-medium text-sm sm:text-base">
							Das <strong>{name}</strong> hat neue Examensergebnisse
							veröffentlicht.
						</p>
						{/* Where the real mail links to the office, the preview keeps
						    visitors on the site and answers "when?" instead. */}
						<Link
							to="/history"
							className="mt-5 inline-flex items-center gap-2 h-11 px-5 bg-nb-yellow border-4 border-nb-black font-black uppercase text-sm shadow-[var(--nb-shadow-sm)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-black focus-visible:ring-offset-2"
						>
							Zur Historie
							<ArrowRight className="w-4 h-4" />
						</Link>
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
				</div>
			</div>

			{prediction && (
				<p className="mt-4 text-sm font-bold">
					Nächste voraussichtlich am{" "}
					<span className="bg-nb-teal px-1">
						{formatDayMonth(prediction.date)}
					</span>{" "}
					<span className="font-medium text-nb-black/60">
						· {CONFIDENCE_LABEL[prediction.confidence]}
					</span>
				</p>
			)}
		</div>
	);
}
