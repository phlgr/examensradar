import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
	BellRing,
	CalendarPlus,
	ChevronDown,
	ExternalLink,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { SectionIntro } from "@/components/ui/heading";
import { fieldClass, labelClass } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";
import {
	type ExamSitting,
	formatExamDay,
	formatSittingMonth,
	formatSittingRange,
	formatStand,
	localIsoDate,
	MONTHS,
	monthsBetween,
	resultMonthIndex,
	resultMonthName,
	SUBJECT_NAME,
	sittingEnd,
} from "@/lib/exam-calendar";
import { jpaFaqs, officePageMeta } from "@/lib/faq";
import { normalizeKennziffer, type OralExamAssignment } from "@/lib/kennziffer";
import type { OralExamDay, OralExamSchedule } from "@/lib/oral-exams";
import {
	CONFIDENCE_LABEL,
	examTimeline,
	formatDayMonth,
	formatDayMonthShort,
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
import {
	getOralExamAssignments,
	getOralExams,
	getPublicData,
} from "@/server/public-data";

export const Route = createFileRoute("/ergebnisse/$jpa")({
	loader: async ({ params }) => {
		const { jpas, history } = await getPublicData();
		const jpa = jpas.find((j) => jpaParam(j.slug) === params.jpa);
		if (!jpa) throw notFound();
		const oralExams = await getOralExams({ data: jpa.slug });
		const now = new Date();
		const summary = summarizeReleases(history, now).find(
			(s) => s.slug === jpa.slug,
		);
		const timeline = examTimeline(jpa.slug, summary?.dates ?? [], now);
		return {
			jpas,
			jpa,
			summary,
			timeline,
			oralExams,
			now: now.toISOString(),
		};
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

function Mark({ children }: { children: ReactNode }) {
	return <strong className="marker font-semibold">{children}</strong>;
}

function Expected({
	entry,
	currentYear,
}: {
	entry: TimelineEntry;
	currentYear: number;
}) {
	const approximate = entry.results.kind === "expected" && !entry.results.exact;
	return (
		<>
			voraussichtlich {approximate ? "" : "am "}
			<Mark>{resultsDate(entry, currentYear)}</Mark>
		</>
	);
}

function AnswerBlock({
	status,
	websiteUrl,
	currentYear,
}: {
	status: OfficeStatus;
	websiteUrl: string | null;
	currentYear: number;
}) {
	const { lead, detail } = answerLines(status, websiteUrl, currentYear);
	return (
		<>
			<span className="block text-ink">{lead}</span>
			{detail && <span className="block mt-1">{detail}</span>}
		</>
	);
}

function answerLines(
	status: OfficeStatus,
	websiteUrl: string | null,
	year: number,
): { lead: ReactNode; detail?: ReactNode } {
	switch (status.kind) {
		case "released":
			return {
				lead: (
					<>
						Die Ergebnisse vom <Mark>{dayMonthYear(status.date, year)}</Mark>{" "}
						sind online.
					</>
				),
				detail: websiteUrl && (
					<a
						href={websiteUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-seal inline-flex items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2"
					>
						Zur Website des Prüfungsamts
						<ExternalLink className="w-4 h-4 shrink-0" />
					</a>
				),
			};
		case "overdue":
			return {
				lead: (
					<span className="text-seal">
						Die Ergebnisse sind {relativeLabel(status.daysUntil)}.
					</span>
				),
				detail: "Sie können jeden Tag kommen.",
			};
		case "waiting":
			return {
				lead: (
					<>
						Ergebnisse für die Klausuren vom{" "}
						{sittingRange(status.entry.sitting, year)}{" "}
						<Expected entry={status.entry} currentYear={year} />.
					</>
				),
				detail:
					status.next &&
					(status.next.phase === "läuft"
						? `Gerade laufen die Klausuren vom ${sittingRange(status.next.sitting, year)}.`
						: `Nächste Klausuren: ${sittingRange(status.next.sitting, year)}.`),
			};
		case "running":
			return {
				lead: `Die Klausuren laufen noch bis ${dayMonthYear(sittingEnd(status.entry.sitting), year)}.`,
				detail: (
					<>
						Ergebnisse <Expected entry={status.entry} currentYear={year} />.
					</>
				),
			};
		case "upcoming":
			return {
				lead: `Nächste Klausuren ${sittingRange(status.entry.sitting, year)}.`,
				detail: (
					<>
						Ergebnisse dafür{" "}
						<Expected entry={status.entry} currentYear={year} />.
					</>
				),
			};
		case "noCalendar":
			return {
				lead: (
					<>
						Die nächsten Ergebnisse erwarten wir am{" "}
						<Mark>{dayMonthYear(status.prediction.date, year)}</Mark>.
					</>
				),
			};
		case "unknown":
			return status.lastRelease
				? {
						lead: `Zuletzt veröffentlicht am ${dayMonthYear(status.lastRelease, year)}.`,
						detail: "Für eine Prognose fehlen noch Daten.",
					}
				: {
						lead: "Für dieses Prüfungsamt haben wir noch keine Veröffentlichung erfasst.",
					};
	}
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

type LookupResult =
	| { kind: "idle" | "loading" | "error" | "missing" }
	| { kind: "found"; assignment: OralExamAssignment };

/**
 * The Kennziffern load only once the field is first used and the typed number is
 * matched right here: it is in no URL, request, storage or analytics event.
 */
function useKennzifferLookup(jpaSlug: string, available: boolean) {
	const [input, setInput] = useState("");
	const [requested, setRequested] = useState(false);
	const assignments = useQuery({
		queryKey: ["oral-exam-assignments", jpaSlug],
		queryFn: () => getOralExamAssignments({ data: jpaSlug }),
		enabled: available && requested,
		staleTime: Number.POSITIVE_INFINITY,
		retry: 1,
	});
	const key = normalizeKennziffer(input);
	const assignment = key ? assignments.data?.[key] : undefined;
	const result: LookupResult = !key
		? { kind: "idle" }
		: assignments.isError
			? { kind: "error" }
			: !assignments.data
				? { kind: "loading" }
				: assignment
					? { kind: "found", assignment }
					: { kind: "missing" };

	const tracked = useRef(false);
	const settled = result.kind === "found" || result.kind === "missing";
	useEffect(() => {
		if (!settled || tracked.current) return;
		tracked.current = true;
		trackEvent("kennziffer_lookup", { jpa: jpaSlug, found: !!assignment });
	}, [settled, assignment, jpaSlug]);

	return {
		input,
		result,
		change: (value: string) => {
			setInput(value);
			setRequested(true);
		},
		activate: () => setRequested(true),
	};
}

function KennzifferLookup({
	lookup,
}: {
	lookup: ReturnType<typeof useKennzifferLookup>;
}) {
	const { result } = lookup;
	return (
		<div className="mb-6 max-w-sm">
			<label htmlFor="kennziffer" className={labelClass}>
				Deine Kennziffer
			</label>
			<input
				id="kennziffer"
				type="text"
				autoComplete="off"
				autoCapitalize="off"
				spellCheck={false}
				placeholder="z. B. 1234/26"
				value={lookup.input}
				onFocus={lookup.activate}
				onChange={(event) => lookup.change(event.target.value)}
				className={fieldClass}
			/>
			<div role="status" className="mt-2 text-[15px] leading-snug">
				{result.kind === "loading" && (
					<p className="text-ink/55">Wird geladen …</p>
				)}
				{result.kind === "error" && (
					<p className="text-ink/70">
						Die Termine konnten gerade nicht geladen werden. Bitte versuch es
						später noch einmal.
					</p>
				)}
				{result.kind === "missing" && (
					<p className="text-ink/70">
						Für diese Kennziffer ist noch kein Termin veröffentlicht. Die Ladung
						kommt etwa drei Wochen vor der Prüfung.
					</p>
				)}
				{result.kind === "found" && (
					<p className="rounded-lg bg-seal-soft p-3.5 ring-1 ring-seal/20">
						<Mark>{formatExamDay(result.assignment.date)}</Mark>
						{" · "}
						{result.assignment.place}
						{result.assignment.start &&
							` · ab ca. ${result.assignment.start} Uhr`}
					</p>
				)}
			</div>
			<p className="mt-2 text-[13px] text-ink/55">
				Deine Kennziffer bleibt in deinem Browser. Wir speichern und senden sie
				nicht.
			</p>
		</div>
	);
}

function OralExamSection({
	schedule,
	jpaSlug,
	jpaName,
	now,
}: {
	schedule: OralExamSchedule;
	jpaSlug: string;
	jpaName: string;
	now: Date;
}) {
	const lookup = useKennzifferLookup(jpaSlug, schedule.lookup);
	const foundDate =
		lookup.result.kind === "found" ? lookup.result.assignment.date : undefined;
	const today = localIsoDate(now);
	const months = new Map<string, OralExamDay[]>();
	for (const day of schedule.days) {
		if (day.date < today) continue;
		const key = day.date.slice(0, 7);
		months.set(key, [...(months.get(key) ?? []), day]);
	}
	if (months.size === 0) return null;

	return (
		<section className="mb-14">
			<h2 className="text-2xl font-semibold leading-tight mb-2">
				Mündliche Prüfungen beim {jpaName}
			</h2>
			<p className="text-[15px] text-ink/55 mb-6">
				An welchen Tagen und wo mündlich geprüft wird. Die mündliche Prüfung
				findet in der Regel im fünften Monat nach den Klausuren statt, die
				persönliche Ladung kommt etwa drei Wochen vorher.
			</p>
			{schedule.lookup && <KennzifferLookup lookup={lookup} />}
			<ol className="grid gap-3 sm:grid-cols-2">
				{[...months].map(([key, days]) => (
					<li
						key={key}
						className="rounded-xl bg-sheet p-3.5 ring-1 ring-ink/10"
					>
						<p className="font-serif text-[18px] leading-tight">
							{MONTHS[Number(key.slice(5)) - 1]}
							{key.startsWith(`${now.getFullYear()}-`)
								? ""
								: ` ${key.slice(0, 4)}`}
						</p>
						<ul className="mt-3 space-y-0.5 text-[14px]">
							{days.map((day) => (
								<li key={day.date} className="flex gap-2">
									<span
										className={cn(
											"figures shrink-0 text-ink/55",
											day.date === foundDate && "marker text-ink",
										)}
									>
										{formatExamDay(day.date)}
									</span>
									<span>{day.places.join(", ")}</span>
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
			<p className="mt-4 text-[13px] text-ink/55">
				Ohne Gewähr. Quelle:{" "}
				<a
					href={schedule.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="underline decoration-1 underline-offset-4 hover:decoration-2"
				>
					Mündliche Prüfungstermine des Justizprüfungsamts beim {jpaName}
				</a>
				, abgerufen am {formatStand(localIsoDate(new Date(schedule.fetchedAt)))}
				.
			</p>
		</section>
	);
}

function JpaPage() {
	const loaded = Route.useLoaderData();
	const { jpas, jpa, summary, timeline, oralExams } = loaded;
	const now = new Date(loaded.now);
	const entries = timeline?.entries ?? [];
	const prediction = summary?.prediction ?? null;
	const meta = officePageMeta(jpa.name, summary, entries);
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

					<SectionIntro
						as="h1"
						title={meta.h1}
						textClassName="text-xl sm:text-2xl leading-snug"
					>
						<AnswerBlock
							status={status}
							websiteUrl={jpa.websiteUrl}
							currentYear={now.getFullYear()}
						/>
					</SectionIntro>
					{prediction && summary && (
						<p className="mt-3 max-w-2xl text-[13px] text-ink/55">
							Veröffentlicht meist{" "}
							{monthPositionLabel(prediction.medianOffsetDays)}, gegen{" "}
							{summary.typicalHour} Uhr. Nächster Termin wahrscheinlich zwischen
							dem {formatDayMonthShort(prediction.windowStart)} und dem{" "}
							{formatDayMonthShort(prediction.windowEnd)} ·{" "}
							{CONFIDENCE_LABEL[prediction.confidence]}
						</p>
					)}

					<section className="mt-8 mb-14 max-w-2xl rounded-xl bg-seal-soft p-5 sm:p-7 ring-1 ring-seal/20">
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
						<section className="mb-14">
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

					{oralExams && (
						<OralExamSection
							schedule={oralExams}
							jpaSlug={jpa.slug}
							jpaName={jpa.name}
							now={now}
						/>
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
