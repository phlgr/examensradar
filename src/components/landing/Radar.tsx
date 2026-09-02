import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
	CONFIDENCE_LABEL,
	formatDayMonth,
	type HistoryEntry,
	type JpaReleaseSummary,
	relativeLabel,
	summarizeReleases,
} from "@/lib/release-summary";
import { cn } from "@/lib/utils";

// --- Geometry -------------------------------------------------------------

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = 176;

/** Distance rings: days from today → fraction of the radius. */
const RINGS = [
	{ days: 7, fraction: 0.34, label: "7 Tage" },
	{ days: 30, fraction: 0.67, label: "30 Tage" },
	{ days: 90, fraction: 0.97, label: "90 Tage" },
] as const;

function radiusFraction(daysUntil: number | null): number {
	if (daysUntil === null) return RINGS[2].fraction;
	if (daysUntil <= 0) return 0.1;
	let previous = { days: 0, fraction: 0.1 };
	for (const ring of RINGS) {
		if (daysUntil <= ring.days) {
			const t = (daysUntil - previous.days) / (ring.days - previous.days);
			return previous.fraction + t * (ring.fraction - previous.fraction);
		}
		previous = ring;
	}
	return RINGS[2].fraction;
}

function blipPosition(index: number, count: number, daysUntil: number | null) {
	// Spread offices evenly, starting upper-right so the first label has room.
	const angle = ((-55 + (index * 360) / Math.max(count, 1)) * Math.PI) / 180;
	const r = radiusFraction(daysUntil) * RADIUS;
	return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

// --- Components -----------------------------------------------------------

function Blip({
	summary,
	index,
	count,
}: {
	summary: JpaReleaseSummary;
	index: number;
	count: number;
}) {
	const { x, y } = blipPosition(index, count, summary.daysUntil);
	const pending = summary.daysUntil === null;
	const overdue = summary.daysUntil !== null && summary.daysUntil < 0;
	const fill = pending
		? "var(--nb-white)"
		: overdue
			? "var(--nb-coral)"
			: "var(--nb-teal)";
	const labelLeft = x > CENTER;
	const labelX = labelLeft ? x - 16 : x + 16;
	const detail = pending
		? "noch keine Prognose"
		: relativeLabel(summary.daysUntil ?? 0);

	return (
		<g>
			{!pending && (
				<circle
					cx={x}
					cy={y}
					r={7}
					fill="none"
					stroke={fill}
					strokeWidth={2}
					className="animate-blip"
					style={{
						transformBox: "fill-box",
						transformOrigin: "center",
						animationDelay: `${index * 0.6}s`,
					}}
				/>
			)}
			<circle
				cx={x}
				cy={y}
				r={7}
				fill={fill}
				stroke="var(--nb-black)"
				strokeWidth={2.5}
			/>
			<text
				x={labelX}
				y={y - 2}
				textAnchor={labelLeft ? "end" : "start"}
				className="fill-nb-black text-[13px] font-black uppercase"
			>
				{summary.short}
			</text>
			<text
				x={labelX}
				y={y + 12}
				textAnchor={labelLeft ? "end" : "start"}
				className="fill-nb-black/60 text-[11px] font-bold"
			>
				{detail}
			</text>
		</g>
	);
}

function RadarScreen({ summaries }: { summaries: JpaReleaseSummary[] }) {
	// A 60° wedge whose leading edge sits at 12 o'clock.
	const wedgeEndX = CENTER + RADIUS * Math.sin(Math.PI / 3);
	const wedgeEndY = CENTER - RADIUS * Math.cos(Math.PI / 3);

	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			className="w-full h-auto select-none"
			role="img"
			aria-label="Zeitstrahl der nächsten erwarteten Veröffentlichungen"
		>
			<defs>
				<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="var(--nb-teal)" stopOpacity="0" />
					<stop offset="1" stopColor="var(--nb-teal)" stopOpacity="0.35" />
				</linearGradient>
				<clipPath id="screen">
					<circle cx={CENTER} cy={CENTER} r={RADIUS} />
				</clipPath>
			</defs>

			{RINGS.map((ring) => (
				<circle
					key={ring.days}
					cx={CENTER}
					cy={CENTER}
					r={ring.fraction * RADIUS}
					fill="none"
					stroke="var(--nb-black)"
					strokeOpacity={ring.days === 90 ? 1 : 0.2}
					strokeWidth={ring.days === 90 ? 3 : 1.5}
				/>
			))}
			<line
				x1={CENTER}
				y1={CENTER - RADIUS}
				x2={CENTER}
				y2={CENTER + RADIUS}
				stroke="var(--nb-black)"
				strokeOpacity={0.12}
			/>
			<line
				x1={CENTER - RADIUS}
				y1={CENTER}
				x2={CENTER + RADIUS}
				y2={CENTER}
				stroke="var(--nb-black)"
				strokeOpacity={0.12}
			/>
			{RINGS.map((ring) => (
				<text
					key={ring.label}
					x={CENTER + 6}
					y={CENTER + ring.fraction * RADIUS - 5}
					className="fill-nb-black/45 text-[10px] font-bold uppercase"
				>
					{ring.label}
				</text>
			))}

			<g
				clipPath="url(#screen)"
				className="animate-sweep"
				style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
			>
				<path
					d={`M${CENTER},${CENTER} L${CENTER},${CENTER - RADIUS} A${RADIUS},${RADIUS} 0 0 1 ${wedgeEndX},${wedgeEndY} Z`}
					fill="url(#sweep)"
					transform={`rotate(-60 ${CENTER} ${CENTER})`}
				/>
				<line
					x1={CENTER}
					y1={CENTER}
					x2={CENTER}
					y2={CENTER - RADIUS}
					stroke="var(--nb-teal)"
					strokeWidth={2.5}
				/>
			</g>

			<rect
				x={CENTER - 6}
				y={CENTER - 6}
				width={12}
				height={12}
				fill="var(--nb-yellow)"
				stroke="var(--nb-black)"
				strokeWidth={2.5}
			/>
			<text
				x={CENTER}
				y={CENTER + 24}
				textAnchor="middle"
				className="fill-nb-black text-[10px] font-black uppercase"
			>
				heute
			</text>

			{summaries.map((summary, index) => (
				<Blip
					key={summary.slug}
					summary={summary}
					index={index}
					count={summaries.length}
				/>
			))}
		</svg>
	);
}

interface RadarProps {
	entries: HistoryEntry[] | undefined;
	loading: boolean;
	className?: string;
}

/**
 * Each Justizprüfungsamt is a dot whose distance from the centre is the time
 * until its next expected publication; the list below carries the details.
 */
export function Radar({ entries, loading, className }: RadarProps) {
	const summaries = entries ? summarizeReleases(entries, new Date()) : [];
	const totalReleases = summaries.reduce((sum, s) => sum + s.releaseCount, 0);

	return (
		<div
			className={cn(
				"bg-nb-white border-4 border-nb-black shadow-[var(--nb-shadow)]",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-3 px-4 py-3 border-b-4 border-nb-black">
				<p className="text-xs font-black uppercase tracking-wider">
					Nächste Veröffentlichungen
				</p>
				<p className="text-[11px] font-bold text-nb-black/50">Prognose</p>
			</div>

			<div className="px-3 pt-3 sm:px-6 sm:pt-4">
				<RadarScreen summaries={summaries} />
			</div>

			<ul className="mt-2 border-t-2 border-nb-black/10">
				{loading && (
					<li className="px-4 py-3 text-sm font-medium text-nb-black/50">
						Lädt …
					</li>
				)}
				{!loading && summaries.length === 0 && (
					<li className="px-4 py-3 text-sm font-medium text-nb-black/50">
						Noch keine Veröffentlichungen erfasst.
					</li>
				)}
				{summaries.map((summary) => {
					const overdue = summary.daysUntil !== null && summary.daysUntil < 0;
					return (
						<li
							key={summary.slug}
							className="px-4 py-3 border-b-2 border-nb-black/10 last:border-b-0"
						>
							<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
								<p className="font-black uppercase text-sm">{summary.name}</p>
								<p className="text-xs font-medium text-nb-black/60">
									zuletzt am {formatDayMonth(summary.lastRelease)}
								</p>
							</div>
							<p className="text-sm font-bold mt-1">
								{summary.prediction ? (
									<>
										Voraussichtlich am{" "}
										<span
											className={cn(
												"px-1",
												overdue ? "bg-nb-coral" : "bg-nb-teal",
											)}
										>
											{formatDayMonth(summary.prediction.date)}
										</span>{" "}
										<span className="font-medium text-nb-black/60">
											· {CONFIDENCE_LABEL[summary.prediction.confidence]}
										</span>
									</>
								) : (
									<span className="font-medium text-nb-black/60">
										Für eine Prognose fehlen noch Daten.
									</span>
								)}
							</p>
						</li>
					);
				})}
			</ul>

			<div className="flex items-center justify-between gap-3 px-4 py-3 border-t-2 border-nb-black/10 text-xs font-bold">
				<span className="text-nb-black/60">
					{totalReleases > 0
						? `Grundlage: ${totalReleases} erfasste Veröffentlichungen`
						: "Grundlage sind die bisherigen Veröffentlichungen."}
				</span>
				<Link
					to="/history"
					className="inline-flex items-center gap-1 uppercase whitespace-nowrap underline decoration-2 underline-offset-4 hover:bg-nb-yellow px-1 transition-colors"
				>
					Alle Termine
					<ArrowRight className="w-3.5 h-3.5" />
				</Link>
			</div>
		</div>
	);
}
