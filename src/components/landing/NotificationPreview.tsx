import { Link } from "@tanstack/react-router";
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
	/** History still loading — keep the line's space, show a placeholder. */
	loading: boolean;
	className?: string;
}

/**
 * A rubber stamp, the way an office marks a decision: ring text, a rough
 * ink edge, pressed on slightly askew.
 */
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
					fontSize="10.5"
					fontWeight="700"
					letterSpacing="0"
					stroke="none"
					style={{ fontFamily: "var(--font-ui)" }}
				>
					<textPath
						href={`#${id}-ring`}
						textLength="252"
						lengthAdjust="spacingAndGlyphs"
					>
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

/**
 * The email you will get, rendered as it lands in the inbox — subject and body
 * mirror `renderResultsMail`. When the visitor picks a different office in the
 * form, a fresh notification drops in and gets stamped; the initial load (and
 * the preselect once the office list arrives) is left to the hero's own
 * entrance animation so the card doesn't jump twice.
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

	const overdue = daysUntil !== null && daysUntil < 0;

	return (
		<div className={cn("relative", className)}>
			<div className="relative">
				{/* The previous one, still lying underneath. */}
				<div
					className="absolute inset-0 rounded-[3px] bg-sheet border border-ink/15 rotate-[2deg] translate-x-2 translate-y-1.5"
					aria-hidden
				/>

				{/* Set like a printed mail: header block, then the text. */}
				<article
					key={swap}
					className={cn(
						"relative rounded-[3px] bg-sheet border border-ink/15 shadow-paper",
						swap > 0 && "animate-notify",
					)}
				>
					<dl className="ui px-5 sm:px-6 pt-4 pb-3 border-b border-ink/15 text-[13px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink/55">
						<dt>Von</dt>
						<dd className="text-ink truncate">
							Examensradar &lt;noreply@examensradar.de&gt;
						</dd>
						<dt>An</dt>
						<dd className="text-ink truncate">dich</dd>
					</dl>

					<div className="px-5 sm:px-6 pt-5 pb-6">
						<p className="headline text-[1.55rem] sm:text-[1.75rem] leading-[1.15] mb-3 pr-16 sm:pr-24">
							Neue Ergebnisse: {name}
						</p>
						<p className="text-[17px] text-ink/80 leading-relaxed">
							Das {name} hat neue Examensergebnisse veröffentlicht.
						</p>
						{/* Where the real mail links to the office, the preview keeps
						    visitors on the site and answers "when?" instead. */}
						<Link
							to="/history"
							className="inline-block mt-4 text-[17px] text-seal underline decoration-1 underline-offset-[3px] hover:decoration-2"
						>
							Zur Historie
						</Link>
						<p className="mt-5 text-[15px] italic text-ink/50">
							{lastRelease ? (
								<>
									Zuletzt verschickt am{" "}
									{lastRelease.toLocaleString("de-DE", {
										dateStyle: "long",
										timeStyle: "short",
									})}{" "}
									Uhr.
								</>
							) : (
								"So sieht die E-Mail aus, die du bekommst."
							)}
						</p>
					</div>

					<Stamp
						key={`stamp-${swap}`}
						className="absolute right-3 top-9 sm:right-5 sm:top-10 w-24 sm:w-28 -rotate-[12deg] opacity-85 animate-stamp"
					/>
				</article>
			</div>

			{/* Always rendered with reserved height, so the hero doesn't shift
			    when the history query resolves. */}
			<p className="mt-6 min-h-[3rem] text-[17px] text-ink/75 leading-relaxed">
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
