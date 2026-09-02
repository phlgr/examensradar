import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
	clusterReleases,
	type PredictionConfidence,
	predictNextRelease,
	type ReleasePrediction,
} from "@/lib/prediction";
import { cn } from "@/lib/utils";

/** One row of `jpa.getHistory`. */
export interface HistoryEntry {
	sentAt: Date | string | null;
	jpaName: string | null;
	jpaSlug: string | null;
	jpaWebsiteUrl: string | null;
}

export interface RadarTarget {
	slug: string;
	name: string;
	short: string;
	lastRelease: Date;
	releaseCount: number;
	typicalHour: number;
	prediction: ReleasePrediction | null;
	/** Days until the predicted release; negative = overdue; null = no prediction. */
	daysUntil: number | null;
}

const MS_PER_DAY = 86_400_000;

/** "Justizprüfungsamt NRW" → "JPA NRW", "Oberlandesgericht Hamm" → "OLG Hamm". */
function shortJpaName(name: string): string {
	return name
		.replace(/^Landesjustizprüfungsamt\b/, "LJPA")
		.replace(/^Justizprüfungsamt\b/, "JPA")
		.replace(/^Oberlandesgericht\b/, "OLG");
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
		: sorted[mid];
}

/** Groups the raw log into one radar target per JPA, soonest release first. */
export function buildTargets(
	entries: HistoryEntry[],
	now: Date,
): RadarTarget[] {
	const byJpa = new Map<string, { name: string; dates: Date[] }>();
	for (const entry of entries) {
		if (!entry.jpaSlug || !entry.jpaName || !entry.sentAt) continue;
		const group = byJpa.get(entry.jpaSlug) ?? {
			name: entry.jpaName,
			dates: [],
		};
		group.dates.push(new Date(entry.sentAt));
		byJpa.set(entry.jpaSlug, group);
	}

	const targets: RadarTarget[] = [];
	for (const [slug, group] of byJpa) {
		const prediction = predictNextRelease(group.dates, now);
		const daysUntil = prediction
			? Math.ceil((prediction.date.getTime() - now.getTime()) / MS_PER_DAY)
			: null;
		targets.push({
			slug,
			name: group.name,
			short: shortJpaName(group.name),
			lastRelease: new Date(Math.max(...group.dates.map((d) => d.getTime()))),
			releaseCount: clusterReleases(group.dates).length,
			typicalHour: median(group.dates.map((d) => d.getHours())),
			prediction,
			daysUntil,
		});
	}

	return targets.sort((a, b) => {
		if (a.daysUntil === null) return 1;
		if (b.daysUntil === null) return -1;
		return a.daysUntil - b.daysUntil;
	});
}

function relativeLabel(daysUntil: number): string {
	if (daysUntil < 0) {
		const overdue = Math.abs(daysUntil);
		return overdue < 7
			? `seit ${overdue} ${overdue === 1 ? "Tag" : "Tagen"} überfällig`
			: `seit ${Math.round(overdue / 7)} Wochen überfällig`;
	}
	if (daysUntil === 0) return "heute erwartet";
	if (daysUntil === 1) return "morgen erwartet";
	if (daysUntil <= 21) return `in ${daysUntil} Tagen`;
	return `in ${Math.round(daysUntil / 7)} Wochen`;
}

const CONFIDENCE_LABEL: Record<PredictionConfidence, string> = {
	high: "hohe Sicherheit",
	medium: "mittlere Sicherheit",
	low: "grobe Schätzung",
};

const longDate = (date: Date) =>
	date.toLocaleDateString("de-DE", { day: "numeric", month: "long" });

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
	// Spread targets evenly, starting upper-right so the first label has room.
	const angle = ((-55 + (index * 360) / Math.max(count, 1)) * Math.PI) / 180;
	const r = radiusFraction(daysUntil) * RADIUS;
	return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

// --- Components -----------------------------------------------------------

function Blip({
	target,
	index,
	count,
}: {
	target: RadarTarget;
	index: number;
	count: number;
}) {
	const { x, y } = blipPosition(index, count, target.daysUntil);
	const overdue = target.daysUntil !== null && target.daysUntil < 0;
	const pending = target.daysUntil === null;
	const color = pending
		? "rgb(255 255 255 / 0.45)"
		: overdue
			? "var(--nb-coral)"
			: "var(--nb-mint)";
	const labelLeft = x > CENTER;
	const labelX = labelLeft ? x - 16 : x + 16;
	const detail = pending
		? "sammelt noch Daten"
		: relativeLabel(target.daysUntil ?? 0);

	return (
		<g>
			{!pending && (
				<circle
					cx={x}
					cy={y}
					r={7}
					fill="none"
					stroke={color}
					strokeWidth={2}
					className="animate-blip"
					style={{
						transformBox: "fill-box",
						transformOrigin: "center",
						animationDelay: `${index * 0.6}s`,
					}}
				/>
			)}
			<circle cx={x} cy={y} r={7} fill={color} />
			<circle cx={x} cy={y} r={7} fill="none" stroke="black" strokeWidth={2} />
			<text
				x={labelX}
				y={y - 2}
				textAnchor={labelLeft ? "end" : "start"}
				className="fill-nb-white text-[13px] font-black uppercase"
			>
				{target.short}
			</text>
			<text
				x={labelX}
				y={y + 12}
				textAnchor={labelLeft ? "end" : "start"}
				className="fill-nb-white/70 text-[11px] font-bold"
			>
				{detail}
			</text>
		</g>
	);
}

function RadarScreen({ targets }: { targets: RadarTarget[] }) {
	// A 60° wedge; its leading edge (the bright line) sits at 12 o'clock.
	const wedgeEndX = CENTER + RADIUS * Math.sin(Math.PI / 3);
	const wedgeEndY = CENTER - RADIUS * Math.cos(Math.PI / 3);

	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			className="w-full h-auto select-none"
			role="img"
			aria-label="Radarschirm mit den nächsten erwarteten Veröffentlichungen"
		>
			<defs>
				<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="var(--nb-teal)" stopOpacity="0" />
					<stop offset="1" stopColor="var(--nb-teal)" stopOpacity="0.55" />
				</linearGradient>
				<clipPath id="screen">
					<circle cx={CENTER} cy={CENTER} r={RADIUS} />
				</clipPath>
			</defs>

			{/* Rings and crosshair */}
			{RINGS.map((ring) => (
				<circle
					key={ring.days}
					cx={CENTER}
					cy={CENTER}
					r={ring.fraction * RADIUS}
					fill="none"
					stroke="rgb(255 255 255 / 0.22)"
					strokeWidth={ring.days === 90 ? 3 : 1.5}
				/>
			))}
			<line
				x1={CENTER}
				y1={CENTER - RADIUS}
				x2={CENTER}
				y2={CENTER + RADIUS}
				stroke="rgb(255 255 255 / 0.15)"
			/>
			<line
				x1={CENTER - RADIUS}
				y1={CENTER}
				x2={CENTER + RADIUS}
				y2={CENTER}
				stroke="rgb(255 255 255 / 0.15)"
			/>
			{RINGS.map((ring) => (
				<text
					key={ring.label}
					x={CENTER + 6}
					y={CENTER + ring.fraction * RADIUS - 5}
					className="fill-nb-white/45 text-[10px] font-bold uppercase"
				>
					{ring.label}
				</text>
			))}

			{/* Sweep */}
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
					stroke="var(--nb-mint)"
					strokeWidth={3}
				/>
			</g>

			{/* Today */}
			<rect
				x={CENTER - 6}
				y={CENTER - 6}
				width={12}
				height={12}
				fill="var(--nb-yellow)"
				stroke="black"
				strokeWidth={2}
			/>
			<text
				x={CENTER}
				y={CENTER + 24}
				textAnchor="middle"
				className="fill-nb-yellow text-[10px] font-black uppercase"
			>
				heute
			</text>

			{targets.map((target, index) => (
				<Blip
					key={target.slug}
					target={target}
					index={index}
					count={targets.length}
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
 * The hero's signature: a radar screen where each Justizprüfungsamt is a blip
 * whose distance from the centre is the time until its next expected
 * publication, followed by a legend with the numbers behind each blip.
 */
export function Radar({ entries, loading, className }: RadarProps) {
	const targets = entries ? buildTargets(entries, new Date()) : [];
	const totalReleases = targets.reduce((sum, t) => sum + t.releaseCount, 0);

	return (
		<div
			className={cn(
				"bg-nb-black text-nb-white border-4 border-nb-black shadow-[8px_8px_0_0_var(--nb-yellow)]",
				className,
			)}
		>
			<div className="flex items-center justify-between px-4 py-3 border-b-2 border-white/15">
				<p className="text-xs font-black uppercase tracking-wider">
					Auf dem Radar
				</p>
				<p className="flex items-center gap-2 text-[11px] font-bold uppercase text-nb-mint">
					<span className="w-2.5 h-2.5 bg-nb-mint animate-blink" aria-hidden />
					live
				</p>
			</div>

			<div className="px-3 pt-3 sm:px-6 sm:pt-4">
				<RadarScreen targets={targets} />
			</div>

			<ul className="mt-2 border-t-2 border-white/15">
				{loading && (
					<li className="px-4 py-3 text-sm font-medium text-white/60">
						Radar startet …
					</li>
				)}
				{!loading && targets.length === 0 && (
					<li className="px-4 py-3 text-sm font-medium text-white/60">
						Noch keine Veröffentlichung erfasst.
					</li>
				)}
				{targets.map((target) => {
					const overdue = target.daysUntil !== null && target.daysUntil < 0;
					return (
						<li
							key={target.slug}
							className="px-4 py-3 border-b-2 border-white/10 last:border-b-0 grid gap-x-4 gap-y-0.5 sm:grid-cols-[1fr_auto]"
						>
							<p className="font-black uppercase text-sm">{target.name}</p>
							<p className="text-xs font-medium text-white/60 sm:text-right">
								zuletzt {longDate(target.lastRelease)}, {target.typicalHour} Uhr
							</p>
							<p className="sm:col-span-2 text-sm font-bold">
								{target.prediction ? (
									<>
										Nächste voraussichtlich{" "}
										<span
											className={cn(
												"text-nb-black px-1",
												overdue ? "bg-nb-coral" : "bg-nb-mint",
											)}
										>
											{longDate(target.prediction.date)}
										</span>{" "}
										<span className="font-medium text-white/60">
											· {CONFIDENCE_LABEL[target.prediction.confidence]}
										</span>
									</>
								) : (
									<span className="font-medium text-white/60">
										Noch zu wenig Daten für eine Prognose.
									</span>
								)}
							</p>
						</li>
					);
				})}
			</ul>

			<div className="flex items-center justify-between gap-3 px-4 py-3 border-t-2 border-white/15 text-xs font-bold">
				<span className="text-white/60">
					{totalReleases > 0
						? `${totalReleases} Veröffentlichungen erfasst`
						: "Prognosen entstehen aus echten Veröffentlichungen."}
				</span>
				<Link
					to="/history"
					className="inline-flex items-center gap-1 uppercase text-nb-yellow underline decoration-2 underline-offset-4 hover:bg-nb-yellow hover:text-nb-black px-1 transition-colors"
				>
					Zur Historie
					<ArrowRight className="w-3.5 h-3.5" />
				</Link>
			</div>
		</div>
	);
}
