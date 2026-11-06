import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarPlus, ChevronDown, ExternalLink } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { SectionIntro } from "@/components/ui/heading";
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
import { jpaFaqs, officePageMeta } from "@/lib/faq";
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

function JpaPage() {
	const loaded = Route.useLoaderData();
	const { jpas, jpa, summary, timeline } = loaded;
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

					<section className="mt-10 mb-14 max-w-2xl">
						<p className="text-lg sm:text-xl text-ink/70 leading-relaxed mb-5">
							<strong className="font-semibold text-ink">
								Schluss mit Nachschauen.
							</strong>{" "}
							Wir schicken dir eine E-Mail, sobald das {jpa.name}{" "}
							{status.kind === "released" ? "die nächsten" : "neue"} Ergebnisse
							veröffentlicht.
						</p>
						<SignupForm
							jpas={jpas}
							loading={false}
							error={false}
							jpaId={jpa.id}
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
