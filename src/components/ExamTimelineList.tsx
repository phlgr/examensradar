import { CalendarPlus } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import {
	type ExamSitting,
	formatExamDay,
	formatSittingMonth,
	localIsoDate,
	monthsBetween,
	resultMonthIndex,
	resultMonthName,
	SUBJECT_NAME,
} from "@/lib/exam-calendar";
import { formatDayMonth, type TimelineEntry } from "@/lib/release-summary";
import { jpaParam } from "@/lib/seo";
import { cn } from "@/lib/utils";

const dayMonthYear = (date: Date, currentYear: number) =>
	date.getFullYear() === currentYear
		? formatDayMonth(date)
		: `${formatDayMonth(date)} ${date.getFullYear()}`;

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em]";

function ResultsLine({
	sitting,
	results,
	currentYear,
	highlight,
}: TimelineEntry & { currentYear: number; highlight: boolean }) {
	const released = results.kind === "released";
	const value = released
		? `${dayMonthYear(results.date, currentYear)} ✓`
		: results.exact
			? dayMonthYear(results.date, currentYear)
			: `Ende ${resultMonthLabel(sitting, currentYear)}`;
	return (
		<span className={cn("block", released && "text-ink/55")}>
			<span className="block text-[11px] text-ink/55">
				{released
					? "Ergebnisse veröffentlicht am"
					: "Ergebnisse voraussichtlich"}
			</span>
			<span
				className={cn(
					"font-serif text-[15px] whitespace-nowrap",
					highlight && "marker",
				)}
			>
				{value}
			</span>
		</span>
	);
}

function resultMonthLabel(sitting: ExamSitting, currentYear: number) {
	const year = Math.floor(resultMonthIndex(sitting) / 12);
	return year === currentYear
		? resultMonthName(sitting)
		: `${resultMonthName(sitting)} ${year}`;
}

function ExamDays({ entry, today }: { entry: TimelineEntry; today: string }) {
	return (
		<ul className="mt-3 space-y-0.5 text-[14px]">
			{entry.sitting.days.map((day) => (
				<li
					key={day.date}
					className={cn(
						"flex gap-2",
						entry.phase === "läuft" && day.date < today && "text-ink/45",
					)}
				>
					<span className="figures text-ink/55">{formatExamDay(day.date)}</span>
					<abbr title={SUBJECT_NAME[day.subject]} className="no-underline">
						{day.subject}
					</abbr>
				</li>
			))}
		</ul>
	);
}

function CalendarLink({
	jpaSlug,
	sitting,
}: {
	jpaSlug: string;
	sitting: ExamSitting;
}) {
	const start = sitting.days[0].date;
	return (
		<a
			href={`/api/kalender/${jpaParam(jpaSlug)}/${start}`}
			download
			onClick={() =>
				trackEvent("calendar_download", { jpa: jpaSlug, sitting: start })
			}
			className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-ink/55 hover:text-ink"
		>
			<CalendarPlus className="size-3.5" aria-hidden="true" />
			In den Kalender
		</a>
	);
}

type Pod =
	| { kind: "gap"; month: string }
	| { kind: "sitting"; entry: TimelineEntry; index: number };

export function ExamTimelineList({
	entries,
	jpaSlug,
	now,
}: {
	entries: TimelineEntry[];
	jpaSlug?: string;
	now: Date;
}) {
	const today = localIsoDate(now);
	const currentYear = now.getFullYear();
	const firstOpen = entries.findIndex(
		(e) => e.phase === "läuft" || e.phase === "anstehend",
	);
	const firstExpected = entries.findIndex((e) => e.results.kind === "expected");
	const running = entries.some((e) => e.phase === "läuft");

	const pods: Pod[] = entries.flatMap((entry, index) => {
		const previous = entries[index - 1];
		const gap = previous ? monthsBetween(previous.sitting, entry.sitting) : [];
		return [
			...gap.map((month): Pod => ({ kind: "gap", month })),
			{ kind: "sitting", entry, index },
		];
	});

	return (
		<ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{pods.map((pod) => {
				if (pod.kind === "gap") {
					return (
						<li
							key={pod.month}
							className="hidden rounded-xl border border-dashed border-ink/15 p-3.5 sm:block"
						>
							<p className="font-serif text-[18px] text-ink/50">{pod.month}</p>
							<p className="mt-2 text-[13px] text-ink/45">Keine Klausuren</p>
						</li>
					);
				}
				const { entry, index } = pod;
				const open = entry.phase === "läuft" || entry.phase === "anstehend";
				const current = index === firstOpen;
				const status =
					entry.phase === "veröffentlicht" || entry.phase === "ausstehend"
						? { text: "geschrieben", seal: false }
						: entry.phase === "läuft"
							? { text: "läuft gerade", seal: true }
							: current && !running
								? { text: "nächster Durchgang", seal: true }
								: null;
				return (
					<li
						key={entry.sitting.days[0].date}
						className={cn(
							"flex flex-col rounded-xl bg-sheet p-3.5 ring-1 ring-ink/10",
							entry.phase === "veröffentlicht" && "opacity-50",
							current && "ring-2 ring-seal",
						)}
					>
						<p className="font-serif text-[18px] leading-tight">
							{formatSittingMonth(entry.sitting, currentYear)}
						</p>
						{status && (
							<p
								className={cn(
									LABEL,
									"mt-1",
									status.seal ? "text-seal" : "text-ink/50",
								)}
							>
								{status.text}
							</p>
						)}
						<ExamDays entry={entry} today={today} />
						<div className="mt-auto flex flex-col items-start pt-3 text-[12px]">
							<div className="w-full border-t border-ink/10 pt-2.5">
								<ResultsLine
									{...entry}
									currentYear={currentYear}
									highlight={index === firstExpected}
								/>
							</div>
							{open && jpaSlug && (
								<CalendarLink jpaSlug={jpaSlug} sitting={entry.sitting} />
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}
