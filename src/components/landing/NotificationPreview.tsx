import { Link } from "@tanstack/react-router";
import { ArrowRight, Radar } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReleasePrediction } from "@/lib/prediction";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	relativeLabel,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

interface NotificationPreviewProps {
	jpa: { id: string; name: string } | undefined;
	prediction: ReleasePrediction | null;
	daysUntil: number | null;
	lastRelease: Date | null;
	loading: boolean;
	className?: string;
}

function Stamp({ className }: { className?: string }) {
	const id = useId();
	return (
		<svg
			viewBox="0 0 120 120"
			className={cn("text-seal mix-blend-multiply", className)}
			aria-hidden
		>
			<defs>
				<path
					id={`${id}-ring`}
					d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0"
				/>
				<filter id={`${id}-ink`}>
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.9"
						numOctaves="2"
						seed="4"
					/>
					<feDisplacementMap in="SourceGraphic" scale="2.2" />
					<feComponentTransfer>
						<feFuncA type="discrete" tableValues="0 1 1 1 0.85 1" />
					</feComponentTransfer>
				</filter>
			</defs>
			<g filter={`url(#${id}-ink)`} fill="currentColor" stroke="currentColor">
				<circle cx="60" cy="60" r="55" fill="none" strokeWidth="3.5" />
				<circle cx="60" cy="60" r="31" fill="none" strokeWidth="1.5" />
				<text
					fontSize="11"
					fontWeight="700"
					letterSpacing="1.9"
					stroke="none"
					style={{ fontFamily: "var(--font-figures)" }}
				>
					<textPath href={`#${id}-ring`}>
						ERGEBNISSE DA ✱ EXAMENSRADAR ✱
					</textPath>
				</text>
				<text
					x="60"
					y="68"
					textAnchor="middle"
					fontSize="23"
					stroke="none"
					className="headline"
					style={{ fontStyle: "italic" }}
				>
					Neu
				</text>
			</g>
		</svg>
	);
}

export function NotificationPreview({
	jpa,
	prediction,
	daysUntil,
	lastRelease,
	loading,
	className,
}: NotificationPreviewProps) {
	const name = jpa?.name ?? "Justizprüfungsamt";

	const [swap, setSwap] = useState(0);
	const previousId = useRef(jpa?.id);
	useEffect(() => {
		if (jpa?.id && previousId.current && previousId.current !== jpa.id) {
			setSwap((n) => n + 1);
		}
		previousId.current = jpa?.id;
	}, [jpa?.id]);

	const overdue = daysUntil !== null && daysUntil < 0;

	return (
		<div className={cn("relative", className)}>
			<div className="relative">
				<div
					className="absolute inset-0 rounded-lg bg-sheet ring-1 ring-ink/10 shadow-paper rotate-[3.5deg] translate-x-3 translate-y-2"
					aria-hidden
				/>
				<div
					className="absolute inset-0 rounded-lg bg-sheet ring-1 ring-ink/10 shadow-paper -rotate-[2.5deg] -translate-x-2 translate-y-1"
					aria-hidden
				/>

				<article
					key={swap}
					className={cn(
						"relative rounded-lg bg-sheet ring-1 ring-ink/10 shadow-lift overflow-hidden",
						swap > 0 && "animate-notify",
					)}
				>
					<div className="flex items-center gap-3 px-5 py-3.5 border-b border-ink/10">
						<span className="w-9 h-9 shrink-0 rounded-full bg-seal text-sheet grid place-items-center">
							<Radar className="w-[18px] h-[18px]" />
						</span>
						<div className="flex-1 min-w-0 leading-tight">
							<p className="font-semibold text-[15px]">Examensradar</p>
							<p className="text-xs text-ink/50 truncate">
								noreply@examensradar.de
							</p>
						</div>
						<p className="figures text-xs text-ink/45 shrink-0 inline-flex items-center gap-1.5">
							<span className="w-1.5 h-1.5 rounded-full bg-seal" />
							jetzt
						</p>
					</div>

					<div className="px-5 sm:px-6 pt-5 pb-6">
						<p className="headline text-[1.6rem] sm:text-[1.85rem] leading-[1.1] mb-3 pr-16 sm:pr-20">
							Neue Ergebnisse: {name}
						</p>
						<p className="text-[15px] text-ink/75 leading-relaxed">
							Das <strong className="font-semibold text-ink">{name}</strong> hat
							neue Examensergebnisse veröffentlicht.
						</p>
						<Link
							to="/history"
							className="group mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-full ring-1 ring-ink/20 text-sm font-semibold transition-colors hover:bg-ink hover:text-sheet hover:ring-ink"
						>
							Zur Historie
							<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
					</div>

					<div className="figures px-5 sm:px-6 py-3 bg-paper/60 border-t border-ink/10 text-[11px] text-ink/50">
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

					<Stamp
						key={`stamp-${swap}`}
						className="absolute right-3 top-16 sm:right-4 sm:top-[4.25rem] w-20 sm:w-24 -rotate-[14deg] opacity-90 animate-stamp"
					/>
				</article>
			</div>

			<p className="mt-7 min-h-[3rem] text-[15px] text-ink/70 leading-relaxed">
				{prediction && daysUntil !== null ? (
					<>
						{overdue
							? "Nächste Veröffentlichung erwartet am"
							: "Nächste Veröffentlichung voraussichtlich am"}{" "}
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
							{overdue
								? relativeLabel(daysUntil)
								: CONFIDENCE_LABEL[prediction.confidence]}
						</span>
					</>
				) : (
					<span className="text-ink/45">
						{loading
							? "Prognose wird geladen …"
							: "Für eine Prognose fehlen noch Daten."}
					</span>
				)}
			</p>
		</div>
	);
}
