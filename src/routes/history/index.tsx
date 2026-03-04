import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/history/")({
	component: HistoryPage,
});

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAYS_FULL = [
	"Sonntag",
	"Montag",
	"Dienstag",
	"Mittwoch",
	"Donnerstag",
	"Freitag",
	"Samstag",
] as const;

type JpaGroup = {
	jpaName: string;
	jpaSlug: string;
	jpaWebsiteUrl: string | null;
	entries: Array<{ sentAt: Date }>;
	lastRelease: Date;
	dayOfMonthCounts: Map<number, number>;
	weekdayCounts: Map<number, number>;
	typicalDay: number;
	typicalWeekday: number;
	typicalHour: number;
};

function computeMedian(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
	}
	return sorted[mid];
}

function computeMode(values: number[]): number {
	const counts = new Map<number, number>();
	for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
	let best = values[0];
	let bestCount = 0;
	for (const [v, c] of counts) {
		if (c > bestCount) {
			best = v;
			bestCount = c;
		}
	}
	return best;
}

function groupByJpa(
	entries: Array<{
		sentAt: Date | null;
		jpaName: string | null;
		jpaSlug: string | null;
		jpaWebsiteUrl: string | null;
	}>,
): JpaGroup[] {
	const map = new Map<string, JpaGroup>();

	for (const entry of entries) {
		if (!entry.jpaSlug || !entry.jpaName || !entry.sentAt) continue;

		const sentAt = new Date(entry.sentAt);
		const day = sentAt.getDate();
		const weekday = sentAt.getDay();

		let group = map.get(entry.jpaSlug);
		if (!group) {
			group = {
				jpaName: entry.jpaName,
				jpaSlug: entry.jpaSlug,
				jpaWebsiteUrl: entry.jpaWebsiteUrl,
				entries: [],
				lastRelease: sentAt,
				dayOfMonthCounts: new Map(),
				weekdayCounts: new Map(),
				typicalDay: 0,
				typicalWeekday: 0,
				typicalHour: 0,
			};
			map.set(entry.jpaSlug, group);
		}
		group.entries.push({ sentAt });

		if (sentAt > group.lastRelease) {
			group.lastRelease = sentAt;
		}

		group.dayOfMonthCounts.set(day, (group.dayOfMonthCounts.get(day) ?? 0) + 1);
		group.weekdayCounts.set(
			weekday,
			(group.weekdayCounts.get(weekday) ?? 0) + 1,
		);
	}

	for (const group of map.values()) {
		const allDays = group.entries.map((e) => e.sentAt.getDate());
		const allWeekdays = group.entries.map((e) => e.sentAt.getDay());
		const allHours = group.entries.map((e) => e.sentAt.getHours());
		group.typicalDay = computeMedian(allDays);
		group.typicalWeekday = computeMode(allWeekdays);
		group.typicalHour = computeMedian(allHours);
	}

	return [...map.values()].sort(
		(a, b) => b.lastRelease.getTime() - a.lastRelease.getTime(),
	);
}

function WeekdayBar({ weekdayCounts }: { weekdayCounts: Map<number, number> }) {
	const max = Math.max(...weekdayCounts.values(), 1);
	// Mon–Sun order (1–6, 0)
	const order = [1, 2, 3, 4, 5, 6, 0];
	return (
		<div className="flex gap-1 items-end">
			{order.map((wd) => {
				const count = weekdayCounts.get(wd) ?? 0;
				const height = Math.round((count / max) * 24) + 8;
				return (
					<div key={wd} className="flex flex-col items-center gap-0.5">
						<div
							className={`w-6 ${count > 0 ? "bg-nb-yellow border-2 border-nb-black" : "bg-nb-cream border border-nb-black/20"}`}
							style={{ height }}
							title={`${WEEKDAYS_FULL[wd]}: ${count}×`}
						/>
						<span className="text-[9px] font-bold text-nb-black/50">
							{WEEKDAYS[wd]}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function OverviewCard({ groups }: { groups: JpaGroup[] }) {
	const totalReleases = groups.reduce((s, g) => s + g.entries.length, 0);
	const allWeekdayCounts = new Map<number, number>();
	for (const group of groups) {
		for (const [wd, count] of group.weekdayCounts) {
			allWeekdayCounts.set(wd, (allWeekdayCounts.get(wd) ?? 0) + count);
		}
	}
	const mostCommonWeekday = computeMode([
		...groups.flatMap((g) => g.entries.map((e) => e.sentAt.getDay())),
	]);

	return (
		<Card variant="primary" className="p-4 sm:p-6 mb-6 sm:mb-8">
			<div className="flex flex-col sm:flex-row gap-4 sm:gap-8 sm:items-end">
				<div className="flex-1">
					<p className="text-xs font-black uppercase text-nb-black/50 mb-1">
						Gesamt
					</p>
					<p className="text-3xl sm:text-4xl font-black">
						{totalReleases}{" "}
						<span className="text-base font-bold">Veröffentlichungen</span>
					</p>
					<p className="text-sm font-medium mt-1">
						von {groups.length}{" "}
						{groups.length === 1 ? "Justizprüfungsamt" : "Justizprüfungsämtern"}
					</p>
					{totalReleases > 0 && (
						<p className="text-sm font-bold mt-1">
							Häufigster Wochentag:{" "}
							<span className="bg-nb-black text-nb-yellow px-1">
								{WEEKDAYS_FULL[mostCommonWeekday]}
							</span>
						</p>
					)}
				</div>
				{totalReleases > 0 && (
					<div>
						<p className="text-xs font-black uppercase text-nb-black/50 mb-2">
							Wochentage
						</p>
						<WeekdayBar weekdayCounts={allWeekdayCounts} />
					</div>
				)}
			</div>
		</Card>
	);
}

function DayTimeline({
	dayOfMonthCounts,
	typicalDay,
}: {
	dayOfMonthCounts: Map<number, number>;
	typicalDay: number;
}) {
	const maxDay = Math.max(31, ...dayOfMonthCounts.keys());
	const days = Array.from({ length: maxDay }, (_, i) => i + 1);

	return (
		<div className="flex flex-wrap gap-1">
			{days.map((day) => {
				const count = dayOfMonthCounts.get(day) ?? 0;
				const isTypical = day === typicalDay;
				const hasRelease = count > 0;

				let boxClass =
					"w-5 h-5 flex items-center justify-center text-[9px] font-bold relative";

				if (hasRelease) {
					boxClass += isTypical
						? " bg-nb-yellow border-[3px] border-nb-black"
						: " bg-nb-yellow border-2 border-nb-black";
				} else {
					boxClass += " bg-nb-cream border border-nb-black/20";
				}

				return (
					<div key={day} className="flex flex-col items-center gap-0.5">
						<div
							className={boxClass}
							title={count > 0 ? `${count}× am ${day}.` : ""}
						>
							{count > 1 && (
								<span className="absolute -top-1.5 -right-1.5 bg-nb-black text-nb-yellow text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center">
									{count}
								</span>
							)}
						</div>
						<span className="text-[8px] font-medium text-nb-black/40 leading-none">
							{day}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function predictNextRelease(group: JpaGroup): Date | null {
	if (group.entries.length < 1) return null;

	const MS_PER_DAY = 1000 * 60 * 60 * 24;
	const now = new Date();
	const alreadyReleasedThisMonth =
		group.lastRelease.getMonth() === now.getMonth() &&
		group.lastRelease.getFullYear() === now.getFullYear();
	const month = now.getMonth() + (alreadyReleasedThisMonth ? 1 : 0);
	const candidate = new Date(now.getFullYear(), month, group.typicalDay);

	// Shift weekend to Friday / Monday
	const day = candidate.getDay();
	if (day === 6) candidate.setTime(candidate.getTime() - MS_PER_DAY);
	if (day === 0) candidate.setTime(candidate.getTime() + MS_PER_DAY);

	return candidate;
}

function JpaCard({ group }: { group: JpaGroup }) {
	const sortedEntries = [...group.entries].sort(
		(a, b) => b.sentAt.getTime() - a.sentAt.getTime(),
	);

	const compactDates = sortedEntries
		.map((e) =>
			e.sentAt.toLocaleString("de-DE", {
				day: "numeric",
				month: "short",
				year: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			}),
		)
		.join(", ");

	const prediction = predictNextRelease(group);
	const daysUntil = prediction
		? Math.ceil((prediction.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
		: null;
	const isOverdue = daysUntil !== null && daysUntil < 0;
	const relativeLabel =
		daysUntil !== null
			? isOverdue
				? `seit ${Math.abs(Math.round(daysUntil / 7))} Wochen überfällig`
				: daysUntil <= 14
					? `in ${daysUntil} Tagen`
					: `in ${Math.round(daysUntil / 7)} Wochen`
			: null;

	return (
		<Card className="p-4 sm:p-6">
			<div className="mb-3">
				{group.jpaWebsiteUrl ? (
					<a
						href={group.jpaWebsiteUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-base sm:text-lg font-black uppercase inline-flex items-center gap-1 underline decoration-2 hover:bg-nb-yellow transition-colors"
					>
						{group.jpaName}
						<ExternalLink className="w-4 h-4 shrink-0" />
					</a>
				) : (
					<span className="text-base sm:text-lg font-black uppercase">
						{group.jpaName}
					</span>
				)}

				<p className="text-sm font-medium mt-1">
					Letzte Veröffentlichung:{" "}
					{group.lastRelease.toLocaleString("de-DE", {
						dateStyle: "long",
						timeStyle: "short",
					})}
				</p>

				<p className="text-sm font-bold mt-0.5">
					Meist{" "}
					<span className="bg-nb-yellow px-1">
						{WEEKDAYS_FULL[group.typicalWeekday]}
					</span>
					{", um den "}
					<span className="bg-nb-yellow px-1">{group.typicalDay}.</span>
					{" des Monats, gegen "}
					<span className="bg-nb-yellow px-1">{group.typicalHour} Uhr</span>
				</p>

				{prediction && (
					<p className="text-sm font-bold mt-1">
						Nächste Veröffentlichung voraussichtlich{" "}
						<span
							className={`border border-nb-black px-1 ${isOverdue ? "bg-nb-coral" : "bg-nb-teal"}`}
						>
							{prediction.toLocaleDateString("de-DE", {
								day: "numeric",
								month: "long",
							})}
						</span>{" "}
						<span className="font-medium text-nb-black/50">
							({relativeLabel})
						</span>
					</p>
				)}
			</div>

			<div className="mb-3">
				<DayTimeline
					dayOfMonthCounts={group.dayOfMonthCounts}
					typicalDay={group.typicalDay}
				/>
			</div>

			<p className="text-xs font-medium text-nb-black/50">{compactDates}</p>
		</Card>
	);
}

function HistoryPage() {
	const historyQuery = trpc.jpa.getHistory.useQuery();

	if (historyQuery.isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-nb-cream">
				<div className="w-12 h-12 border-4 border-nb-black border-t-nb-yellow animate-spin" />
			</div>
		);
	}

	const entries = historyQuery.data ?? [];
	const groups = groupByJpa(entries);

	return (
		<div className="min-h-screen py-4 sm:py-8 px-4 bg-nb-cream">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6 sm:mb-8">
					<h1 className="text-3xl sm:text-4xl font-black uppercase mb-2">
						Ergebnis-Historie
					</h1>
					<p className="font-medium text-sm sm:text-base">
						Hier siehst du, wann die Justizprüfungsämter zuletzt Ergebnisse
						veröffentlicht haben.
					</p>
				</div>

				{groups.length === 0 ? (
					<Card className="p-8 text-center">
						<div className="w-16 h-16 bg-nb-yellow border-4 border-nb-black flex items-center justify-center mx-auto mb-4">
							<History className="w-8 h-8" />
						</div>
						<p className="font-bold">Noch keine Ergebnisse veröffentlicht.</p>
					</Card>
				) : (
					<>
						<OverviewCard groups={groups} />
						<div className="space-y-4">
							{groups.map((group) => (
								<JpaCard key={group.jpaSlug} group={group} />
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
