import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
	ArrowDown,
	BellRing,
	CalendarPlus,
	ChevronDown,
	ExternalLink,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { trackEvent } from "@/lib/analytics";
import {
	type ExamSitting,
	formatExamDay,
	formatSittingMonth,
	formatSittingRange,
	formatStand,
	localIsoDate,
	monthsBetween,
	resultMonthIndex,
	resultMonthName,
	SUBJECT_NAME,
	sittingEnd,
} from "@/lib/exam-calendar";
import { jpaFaqs, OFFICE_SUBTITLE, officePageMeta } from "@/lib/faq";
import {
	CONFIDENCE_LABEL,
	examTimeline,
	formatDayMonth,
	formatDayMonthShort,
	type JpaReleaseSummary,
	monthPositionLabel,
	type OfficeStatus,
	officeStatus,
	olderReleases,
	type ReleaseCard,
	relativeLabel,
	summarizeReleases,
	type TimelineEntry,
} from "@/lib/release-summary";
import { faqJsonLd, jpaParam, jpaPath, jsonLd, SITE_URL, seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getPublicData } from "@/server/public-data";

export const Route = createFileRoute("/ergebnisse/$jpa")({
	loader: async ({ params }) => {
		const { jpas, history } = await getPublicData();
		const jpa = jpas.find((j) => jpaParam(j.slug) === params.jpa);
		if (!jpa) throw notFound();
		const now = new Date();
		const summary = summarizeReleases(history, now).find(
			(s) => s.slug === jpa.slug,
		);
		const timeline = examTimeline(jpa.slug, summary?.dates ?? [], now);
		return { jpas, jpa, summary, timeline, now: now.toISOString() };
	},
	head: ({ loaderData }) => {
		if (!loaderData) return {};
		const { jpa, summary, timeline } = loaderData;
		const path = jpaPath(jpa.slug);
		const meta = officePageMeta(jpa.name, summary, timeline?.entries);
		const page = seo({
			title: meta.title,
			description: meta.description,
			path,
		});
		return {
			...page,
			scripts: [
				faqJsonLd(jpaFaqs(jpa.name, summary, timeline?.entries)),
				jsonLd({
					"@type": "BreadcrumbList",
					itemListElement: [
						{
							"@type": "ListItem",
							position: 1,
							name: "Examensradar",
							item: SITE_URL,
						},
						{
							"@type": "ListItem",
							position: 2,
							name: "Ergebnisse",
							item: `${SITE_URL}/ergebnisse`,
						},
						{
							"@type": "ListItem",
							position: 3,
							name: jpa.name,
							item: `${SITE_URL}${path}`,
						},
					],
				}),
			],
		};
	},
	component: JpaPage,
});

const dayMonthYear = (date: Date, currentYear: number) =>
	date.getFullYear() === currentYear
		? formatDayMonth(date)
		: `${formatDayMonth(date)} ${date.getFullYear()}`;

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em]";

const sittingRange = (sitting: ExamSitting, currentYear: number) =>
	formatSittingRange(sitting, {
		year: sittingEnd(sitting).getFullYear() !== currentYear,
	});

function resultsDate({ sitting, results }: TimelineEntry, currentYear: number) {
	return results.kind === "expected" && !results.exact
		? `Ende ${resultMonthLabel(sitting, currentYear)}`
		: dayMonthYear(results.date, currentYear);
}

const MS_PER_DAY = 86_400_000;

const daysFrom = (now: Date, date: Date) =>
	Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);

type NextResults =
	| { kind: "expected"; date: Date; exact: boolean; sitting?: ExamSitting }
	| { kind: "overdue"; daysUntil: number }
	| { kind: "none"; lastRelease: Date | null };

function nextResults(
	status: OfficeStatus,
	entries: TimelineEntry[],
	summary: JpaReleaseSummary | undefined,
): NextResults {
	if (status.kind === "overdue") return status;
	const entry = entries.find((e) => e.results.kind === "expected");
	if (entry?.results.kind === "expected") {
		const { date, exact } = entry.results;
		return { kind: "expected", date, exact, sitting: entry.sitting };
	}
	if (summary?.prediction) {
		return { kind: "expected", date: summary.prediction.date, exact: true };
	}
	return { kind: "none", lastRelease: summary?.lastRelease ?? null };
}

function ResultsCell({
	next,
	status,
	summary,
	websiteUrl,
	now,
}: {
	next: NextResults;
	status: OfficeStatus;
	summary: JpaReleaseSummary | undefined;
	websiteUrl: string | null;
	now: Date;
}) {
	const year = now.getFullYear();
	const prediction = next.kind === "expected" ? summary?.prediction : null;
	let big: ReactNode;
	let sub: ReactNode = null;
	switch (next.kind) {
		case "expected": {
			const days = daysFrom(now, next.date);
			const relative = next.exact
				? relativeLabel(days)
				: relativeLabel(days).replace(/^in /, "in ca. ");
			big = (
				<span className="marker">
					{next.exact
						? dayMonthYear(next.date, year)
						: `Ende ${monthYear(next.date, year)}`}
				</span>
			);
			sub = next.sitting
				? `${relative} · für die Klausuren vom ${sittingRange(next.sitting, year)}`
				: relative;
			break;
		}
		case "overdue":
			big = <span className="text-seal">Jeden Tag möglich</span>;
			sub = `Die Ergebnisse sind ${relativeLabel(next.daysUntil)}.`;
			break;
		case "none":
			big = <span className="text-ink/45">Noch offen</span>;
			sub = next.lastRelease
				? `Zuletzt veröffentlicht am ${dayMonthYear(next.lastRelease, year)}. Für eine Prognose fehlen noch Daten.`
				: "Für dieses Prüfungsamt haben wir noch keine Veröffentlichung erfasst.";
	}
	return (
		<div className="p-5 sm:p-6">
			<p className={cn(LABEL, "text-ink/55")}>Nächste Ergebnisse</p>
			<p className="headline mt-2 mb-1.5 text-[2.5rem] sm:text-5xl leading-[1.05]">
				{big}
			</p>
			<p className="text-[14px] text-ink/60">{sub}</p>
			{prediction && summary && (
				<p className="mt-0.5 text-[14px] text-ink/60">
					Meist {monthPositionLabel(prediction.medianOffsetDays)} gegen{" "}
					{summary.typicalHour} Uhr · {CONFIDENCE_LABEL[prediction.confidence]}{" "}
					zwischen {formatDayMonthShort(prediction.windowStart)} und{" "}
					{formatDayMonthShort(prediction.windowEnd)}
				</p>
			)}
			{status.kind === "released" && (
				<p className="mt-3 inline-block rounded-2xl bg-ok-soft px-2.5 py-1 text-[13px] font-semibold text-ok">
					Ergebnisse vom {dayMonthYear(status.date, year)} sind online
					{websiteUrl && (
						<>
							{" · "}
							<a
								href={websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 underline decoration-1 underline-offset-2 hover:decoration-2"
							>
								zum Prüfungsamt
								<ExternalLink className="size-3.5 shrink-0" aria-hidden />
							</a>
						</>
					)}
				</p>
			)}
		</div>
	);
}

function monthYear(date: Date, currentYear: number) {
	const month = date.toLocaleDateString("de-DE", { month: "long" });
	return date.getFullYear() === currentYear
		? month
		: `${month} ${date.getFullYear()}`;
}

function ExamsCell({ entry, now }: { entry: TimelineEntry; now: Date }) {
	const running = entry.phase === "läuft";
	const today = localIsoDate(now);
	const { days } = entry.sitting;
	const written = days.filter((d) => d.date < today).length;
	const sub = running
		? `Tag ${Math.min(written + 1, days.length)} von ${days.length}`
		: `${relativeLabel(daysFrom(now, new Date(`${days[0].date}T00:00`)))} · ${days.length} Klausuren`;
	return (
		<div className="border-t border-ink/10 p-5 sm:border-t-0 sm:border-l sm:p-6">
			<p className={cn(LABEL, running ? "text-seal" : "text-ink/55")}>
				{running ? "Klausuren laufen" : "Nächste Klausuren"}
			</p>
			<p className="headline mt-2 mb-1.5 text-[1.7rem] leading-[1.1]">
				{sittingRange(entry.sitting, now.getFullYear())}
			</p>
			<p className="text-[14px] text-ink/60">{sub}</p>
			<a
				href="#klausurtermine"
				className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sheet px-4 py-2.5 text-[15px] font-semibold ring-1 ring-ink/15 hover:ring-ink/30"
			>
				Zu den Klausurtagen
				<ArrowDown className="size-4" aria-hidden />
			</a>
		</div>
	);
}

function StatusBoard({
	status,
	entries,
	summary,
	websiteUrl,
	now,
}: {
	status: OfficeStatus;
	entries: TimelineEntry[];
	summary: JpaReleaseSummary | undefined;
	websiteUrl: string | null;
	now: Date;
}) {
	const exams = entries.find(
		(e) => e.phase === "läuft" || e.phase === "anstehend",
	);
	return (
		<div
			className={cn(
				"mt-6 grid overflow-hidden rounded-2xl bg-sheet shadow-paper ring-1 ring-ink/10",
				exams && "sm:grid-cols-[1.35fr_1fr]",
			)}
		>
			<ResultsCell
				next={nextResults(status, entries, summary)}
				status={status}
				summary={summary}
				websiteUrl={websiteUrl}
				now={now}
			/>
			{exams && <ExamsCell entry={exams} now={now} />}
		</div>
	);
}

function ResultsLine({
	currentYear,
	highlight,
	...entry
}: TimelineEntry & { currentYear: number; highlight: boolean }) {
	const released = entry.results.kind === "released";
	const value = released
		? `${resultsDate(entry, currentYear)} ✓`
		: resultsDate(entry, currentYear);
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

interface Slot {
	card: ReleaseCard;
	hidden: boolean;
}

type Pod =
	| { kind: "gap"; key: string; month: string; hidden: boolean }
	| ({ kind: "card" } & Slot);

const cardKey = (card: ReleaseCard) =>
	card.kind === "sitting"
		? card.entry.sitting.days[0].date
		: `release-${card.date.getTime()}`;

function ExamTimelineList({
	entries,
	older,
	jpaSlug,
	now,
}: {
	entries: TimelineEntry[];
	older: ReleaseCard[];
	jpaSlug: string;
	now: Date;
}) {
	const [showOlder, setShowOlder] = useState(false);
	const today = localIsoDate(now);
	const currentYear = now.getFullYear();
	const firstOpen = entries.find(
		(e) => e.phase === "läuft" || e.phase === "anstehend",
	);
	const firstExpected = entries.find((e) => e.results.kind === "expected");
	const running = entries.some((e) => e.phase === "läuft");
	const collapsible = older.length > 0 && entries.length > 0;

	const slots: Slot[] = [
		...older.map((card) => ({ card, hidden: collapsible && !showOlder })),
		...entries.map((entry) => ({
			card: { kind: "sitting", entry } as const,
			hidden: false,
		})),
	];
	const pods: Pod[] = slots.flatMap((slot, index) => {
		const previous = slots[index - 1];
		const gap =
			previous?.card.kind === "sitting" && slot.card.kind === "sitting"
				? monthsBetween(previous.card.entry.sitting, slot.card.entry.sitting)
				: [];
		return [
			...gap.map(
				(month): Pod => ({
					kind: "gap",
					key: `${cardKey(slot.card)}-${month}`,
					month,
					hidden: previous.hidden,
				}),
			),
			{ kind: "card", ...slot },
		];
	});

	return (
		<>
			{collapsible && (
				<button
					type="button"
					aria-expanded={showOlder}
					aria-controls="pruefungstermine"
					onClick={() => setShowOlder((shown) => !shown)}
					className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/60 hover:text-ink cursor-pointer"
				>
					<ChevronDown
						className={cn(
							"size-4 transition-transform",
							showOlder && "rotate-180",
						)}
						aria-hidden
					/>
					{showOlder
						? "Ältere Veröffentlichungen ausblenden"
						: "Ältere Veröffentlichungen anzeigen"}
				</button>
			)}
			<ol
				id="pruefungstermine"
				className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
			>
				{pods.map((pod) => {
					if (pod.kind === "gap") {
						return (
							<li
								key={pod.key}
								hidden={pod.hidden}
								className="hidden rounded-xl border border-dashed border-ink/15 p-3.5 sm:block"
							>
								<p className="font-serif text-[18px] text-ink/50">
									{pod.month}
								</p>
								<p className="mt-2 text-[13px] text-ink/45">Keine Klausuren</p>
							</li>
						);
					}
					if (pod.card.kind === "release") {
						return (
							<li
								key={cardKey(pod.card)}
								hidden={pod.hidden}
								className="flex flex-col self-start rounded-xl bg-sheet p-3.5 ring-1 ring-ink/10 opacity-50"
							>
								<span className="block text-[11px] text-ink/55">
									Ergebnisse veröffentlicht am
								</span>
								<span className="font-serif text-[15px] text-ink/55">
									{dayMonthYear(pod.card.date, currentYear)} ✓
								</span>
							</li>
						);
					}
					const { entry } = pod.card;
					const open = entry.phase === "läuft" || entry.phase === "anstehend";
					const current = entry === firstOpen;
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
							key={cardKey(pod.card)}
							hidden={pod.hidden}
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
										highlight={entry === firstExpected}
									/>
								</div>
								{open && (
									<CalendarLink jpaSlug={jpaSlug} sitting={entry.sitting} />
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</>
	);
}

function JpaPage() {
	const loaded = Route.useLoaderData();
	const { jpas, jpa, summary, timeline } = loaded;
	const now = new Date(loaded.now);
	const entries = timeline?.entries ?? [];
	const status = officeStatus(summary, entries, now);
	const older = olderReleases(jpa.slug, summary?.dates ?? [], entries);

	return (
		<>
			<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
				<div className="max-w-4xl mx-auto">
					<nav aria-label="Brotkrumen" className="text-sm text-ink/50 mb-6">
						<Link to="/" className="hover:text-ink">
							Examensradar
						</Link>
						{" / "}
						<Link to="/ergebnisse" className="hover:text-ink">
							Ergebnisse
						</Link>
						{" / "}
						<span className="text-ink/70">{jpa.name}</span>
					</nav>

					<h1 lang="de">
						<span className="headline block text-[2.6rem] sm:text-6xl leading-[1.02] break-words [hyphens:auto] sm:[hyphens:manual]">
							{jpa.name}
							<span className="opacity-0 select-none">:</span>
						</span>{" "}
						<span className="mt-2 block text-[15px] font-medium text-ink/60">
							{OFFICE_SUBTITLE}
						</span>
					</h1>
					<StatusBoard
						status={status}
						entries={entries}
						summary={summary}
						websiteUrl={jpa.websiteUrl}
						now={now}
					/>

					<section className="mt-10 mb-14 max-w-2xl rounded-xl bg-seal-soft p-5 sm:p-7 ring-1 ring-seal/20">
						<h2 className="flex items-center gap-2.5 text-xl sm:text-2xl font-semibold leading-tight">
							<BellRing className="size-5 sm:size-6 shrink-0 text-seal" />
							Per E-Mail Bescheid bekommen
						</h2>
						<p className="mt-2 mb-5 text-[15px] text-ink/70 leading-relaxed">
							Wir schicken dir eine E-Mail, sobald das {jpa.name}{" "}
							{status.kind === "released" ? "die nächsten" : "neue"} Ergebnisse
							veröffentlicht.
						</p>
						<SignupForm
							jpas={jpas}
							loading={false}
							error={false}
							jpa={{ kind: "fixed", jpaId: jpa.id }}
							source="jpa"
						/>
					</section>

					{(entries.length > 0 || older.length > 0) && (
						<section id="klausurtermine" className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								{timeline ? "Klausurtermine" : "Ergebnisse"} beim {jpa.name}
							</h2>
							<p className="text-[15px] text-ink/55 mb-6">
								{timeline
									? "Wann geschrieben wird und wann die Ergebnisse voraussichtlich kommen. Die Termine gelten für alle Justizprüfungsämter in NRW."
									: `Wann das Justizprüfungsamt beim ${jpa.name} neue Ergebnisse online gestellt hat.`}
							</p>
							<ExamTimelineList
								entries={entries}
								older={older}
								jpaSlug={jpa.slug}
								now={now}
							/>
							{timeline && (
								<>
									<p className="mt-4 text-[13px] text-ink/55">
										ZR Zivilrecht · ÖR Öffentliches Recht · SR Strafrecht
									</p>
									<p className="mt-1 text-[13px] text-ink/55">
										Ohne Gewähr. Quelle:{" "}
										<a
											href={timeline.calendar.pageUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="underline decoration-1 underline-offset-4 hover:decoration-2"
										>
											Klausurtermine des Justizprüfungsamts beim {jpa.name}
										</a>
										{timeline.calendar.stand &&
											`, Stand ${formatStand(timeline.calendar.stand)}`}
										.
									</p>
								</>
							)}
						</section>
					)}

					<section className="mb-14">
						<h2 className="text-2xl font-semibold leading-tight mb-5">
							Häufige Fragen
						</h2>
						<FaqList faqs={jpaFaqs(jpa.name, summary, entries)} />
					</section>

					{jpa.websiteUrl && (
						<p className="text-[15px] text-ink/60">
							Verbindlich sind nur die Angaben des Prüfungsamts:{" "}
							<a
								href={jpa.websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="font-medium text-seal inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2"
							>
								Website des Justizprüfungsamts beim {jpa.name}
								<ExternalLink className="w-3.5 h-3.5 shrink-0" />
							</a>
						</p>
					)}
				</div>
			</div>
			<Footer jpas={jpas} />
		</>
	);
}
