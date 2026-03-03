import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/history/")({
	component: HistoryPage,
});

type JpaGroup = {
	jpaName: string;
	jpaSlug: string;
	jpaWebsiteUrl: string | null;
	entries: Array<{ sentAt: Date }>;
	lastRelease: Date;
	dayOfMonthCounts: Map<number, number>;
	typicalDay: number | null;
	typicalHour: number | null;
};

function computeMedian(days: number[]): number {
	const sorted = [...days].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
	}
	return sorted[mid];
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

		let group = map.get(entry.jpaSlug);
		if (!group) {
			group = {
				jpaName: entry.jpaName,
				jpaSlug: entry.jpaSlug,
				jpaWebsiteUrl: entry.jpaWebsiteUrl,
				entries: [],
				lastRelease: sentAt,
				dayOfMonthCounts: new Map(),
				typicalDay: null,
				typicalHour: null,
			};
			map.set(entry.jpaSlug, group);
		}
		group.entries.push({ sentAt });

		if (sentAt > group.lastRelease) {
			group.lastRelease = sentAt;
		}

		group.dayOfMonthCounts.set(day, (group.dayOfMonthCounts.get(day) ?? 0) + 1);
	}

	for (const group of map.values()) {
		const allDays = group.entries.map((e) => e.sentAt.getDate());
		const allHours = group.entries.map((e) => e.sentAt.getHours());
		group.typicalDay = allDays.length >= 2 ? computeMedian(allDays) : null;
		group.typicalHour = allHours.length >= 2 ? computeMedian(allHours) : null;
	}

	return [...map.values()].sort(
		(a, b) => b.lastRelease.getTime() - a.lastRelease.getTime(),
	);
}

function DayTimeline({
	dayOfMonthCounts,
	typicalDay,
}: {
	dayOfMonthCounts: Map<number, number>;
	typicalDay: number | null;
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
					{group.lastRelease.toLocaleDateString("de-DE", { dateStyle: "long" })}
				</p>

				{group.typicalDay !== null ? (
					<p className="text-sm font-bold mt-0.5">
						Meist um den{" "}
						<span className="bg-nb-yellow px-1">{group.typicalDay}.</span> des
						Monats
						{group.typicalHour !== null && (
							<>
								{", gegen "}
								<span className="bg-nb-yellow px-1">
									{group.typicalHour} Uhr
								</span>
							</>
						)}
					</p>
				) : (
					<p className="text-sm font-medium mt-0.5 text-nb-black/60">
						Erste Veröffentlichung am{" "}
						{group.entries[0].sentAt.toLocaleString("de-DE", {
							dateStyle: "long",
							timeStyle: "short",
						})}
					</p>
				)}
			</div>

			<div className="mb-3 overflow-x-auto">
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

				<div className="space-y-4">
					{groups.length === 0 ? (
						<Card className="p-8 text-center">
							<div className="w-16 h-16 bg-nb-yellow border-4 border-nb-black flex items-center justify-center mx-auto mb-4">
								<History className="w-8 h-8" />
							</div>
							<p className="font-bold">Noch keine Ergebnisse veröffentlicht.</p>
						</Card>
					) : (
						groups.map((group) => <JpaCard key={group.jpaSlug} group={group} />)
					)}
				</div>
			</div>
		</div>
	);
}
