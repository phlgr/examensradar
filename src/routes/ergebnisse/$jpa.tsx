import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarPlus, ChevronDown, ExternalLink } from "lucide-react";
import { Fragment, useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import { trackEvent } from "@/lib/analytics";
import {
	calendarDate,
	type ExamSitting,
	formatExamDay,
	formatSittingMonth,
	formatSittingRange,
	formatSittingRangeShort,
	formatStand,
	monthsBetween,
	resultMonthIndex,
	resultMonthName,
	SUBJECT_NAME,
} from "@/lib/exam-calendar";
import { jpaFaqs, nextReleaseSentence } from "@/lib/faq";
import { clusterReleases } from "@/lib/prediction";
import {
	CONFIDENCE_LABEL,
	examTimeline,
	formatDayMonth,
	formatDayMonthShort,
	relativeLabel,
	summarizeReleases,
	type TimelineEntry,
} from "@/lib/release-summary";
import {
	faqJsonLd,
	formatLongDate,
	jpaParam,
	jpaPath,
	jsonLd,
	SITE_URL,
	seo,
} from "@/lib/seo";
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
		const next = summary?.prediction
			? `Nächster Termin voraussichtlich am ${formatLongDate(summary.prediction.date)}. `
			: "";
		const page = seo({
			title: `Examensergebnisse ${jpa.name}: Wann kommen sie? | Examensradar`,
			description: `${next}Alle bisherigen Veröffentlichungen des Justizprüfungsamts beim ${jpa.name} im ersten Staatsexamen – und eine kostenlose E-Mail, sobald neue Ergebnisse online sind.`,
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
							name: "Termine",
							item: `${SITE_URL}/history`,
						},
						{
							"@type": "ListItem",
							position: 3,
							name: `Examensergebnisse ${jpa.name}`,
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

const joinMonths = (months: string[]) =>
	months.length > 1
		? `${months.slice(0, -1).join(", ")} und ${months[months.length - 1]}`
		: months[0];

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em]";

function ResultsLine({
	sitting,
	results,
	currentYear,
	highlight,
}: TimelineEntry & { currentYear: number; highlight: boolean }) {
	if (results.kind === "released") {
		return (
			<span className="text-ink/55">
				Ergebnisse am {dayMonthYear(results.date, currentYear)} ✓
			</span>
		);
	}
	const value = results.exact
		? dayMonthYear(results.date, currentYear)
		: resultMonthLabel(sitting, currentYear);
	return (
		<span>
			Ergebnisse {!results.exact && "Ende "}
			<span className={cn("font-serif text-[17px]", highlight && "marker")}>
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
		<ul className="mt-3 grid gap-x-6 gap-y-0.5 sm:grid-cols-3">
			{entry.sitting.days.map((day) => (
				<li
					key={day.date}
					className={cn(
						"flex gap-3 py-0.5",
						entry.phase === "läuft" && day.date < today && "text-ink/45",
					)}
				>
					<span className="figures w-[74px] shrink-0 text-[13px] text-ink/55">
						{formatExamDay(day.date)}
					</span>
					<span>{SUBJECT_NAME[day.subject]}</span>
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
			className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink/55 hover:text-ink"
		>
			<CalendarPlus className="size-3.5" aria-hidden="true" />
			In den Kalender
		</a>
	);
}

function ExamTimelineList({
	entries,
	jpaSlug,
	now,
}: {
	entries: TimelineEntry[];
	jpaSlug: string;
	now: Date;
}) {
	const today = calendarDate(now);
	const currentYear = now.getFullYear();
	const firstOpen = entries.findIndex(
		(e) => e.phase === "läuft" || e.phase === "anstehend",
	);
	const todayAt = firstOpen === -1 ? entries.length : firstOpen;
	const firstExpected = entries.findIndex((e) => e.results.kind === "expected");
	const running = entries.some((e) => e.phase === "läuft");

	const todayRule = (
		<li className={cn(LABEL, "border-t-[1.5px] border-seal py-2.5 text-seal")}>
			Heute · {formatDayMonth(now)}
		</li>
	);

	return (
		<ol>
			{entries.map((entry, index) => {
				const open = entry.phase === "läuft" || entry.phase === "anstehend";
				const expanded = index === firstOpen;
				const previous = entries[index - 1];
				const gap = previous
					? monthsBetween(previous.sitting, entry.sitting)
					: [];
				const head = (
					<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
						<span>
							<span className="font-serif text-[19px]">
								{formatSittingMonth(entry.sitting, currentYear)}
							</span>{" "}
							<span className="figures text-[13px] text-ink/55">
								{formatSittingRangeShort(entry.sitting)}
							</span>
							{entry.phase === "läuft" && (
								<span className={cn(LABEL, "ml-2 text-ink/50")}>
									läuft gerade
								</span>
							)}
							{expanded && entry.phase === "anstehend" && !running && (
								<span className={cn(LABEL, "ml-2 text-ink/50")}>
									nächster Durchgang
								</span>
							)}
						</span>
						<ResultsLine
							{...entry}
							currentYear={currentYear}
							highlight={index === firstExpected}
						/>
					</div>
				);
				const body = open && (
					<>
						<ExamDays entry={entry} today={today} />
						<CalendarLink jpaSlug={jpaSlug} sitting={entry.sitting} />
					</>
				);
				return (
					<Fragment key={entry.sitting.days[0].date}>
						{gap.length > 0 && (
							<li className="border-t border-ink/10 py-2.5 text-[13px] text-ink/50">
								Keine Klausuren im {joinMonths(gap)}
							</li>
						)}
						{index === todayAt && todayRule}
						<li
							className={cn(
								index !== todayAt && "border-t border-ink/10",
								entry.phase === "veröffentlicht" && "opacity-50",
							)}
						>
							{open && !expanded ? (
								<details className="group py-3.5">
									<summary className="-mx-3 cursor-pointer list-none rounded-lg px-3 py-1 transition-colors hover:bg-ink/[0.04] [&::-webkit-details-marker]:hidden">
										{head}
										<span className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-seal underline decoration-1 underline-offset-4 group-hover:decoration-2">
											<span className="group-open:hidden">
												Klausurtage anzeigen
											</span>
											<span className="hidden group-open:inline">
												Klausurtage ausblenden
											</span>
											<ChevronDown
												aria-hidden="true"
												className="size-3.5 transition-transform group-open:rotate-180"
											/>
										</span>
									</summary>
									{body}
								</details>
							) : (
								<div className={cn("py-3.5", index === todayAt && "pt-1")}>
									{head}
									{body}
								</div>
							)}
						</li>
					</Fragment>
				);
			})}
			{todayAt === entries.length && todayRule}
		</ol>
	);
}

function JpaPage() {
	const { jpas, jpa, summary, timeline, now } = Route.useLoaderData();
	const [jpaId, setJpaId] = useState(jpa.id);
	const prediction = summary?.prediction ?? null;
	const daysUntil = summary?.daysUntil ?? null;
	const overdue = daysUntil !== null && daysUntil < 0;
	const releases = summary ? clusterReleases(summary.dates).reverse() : [];

	return (
		<>
			<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
				<div className="max-w-4xl mx-auto">
					<nav aria-label="Brotkrumen" className="text-sm text-ink/50 mb-6">
						<Link to="/" className="hover:text-ink">
							Examensradar
						</Link>
						{" / "}
						<Link to="/history" className="hover:text-ink">
							Termine
						</Link>
						{" / "}
						<span className="text-ink/70">{jpa.name}</span>
					</nav>

					<SectionIntro
						as="h1"
						title={`Examensergebnisse ${jpa.name}: Wann kommen sie?`}
						className="mb-10 sm:mb-14"
					>
						{summary
							? nextReleaseSentence(summary)
							: `Für das ${jpa.name} haben wir noch keine Veröffentlichung erfasst.`}{" "}
						Mit Examensradar bekommst du eine E-Mail, sobald die Ergebnisse
						online sind.
					</SectionIntro>

					<div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] mb-14">
						<Card
							className={cn(
								"p-6 sm:p-7",
								overdue && "bg-seal-soft ring-seal/20",
							)}
						>
							<Eyebrow className="mb-2">Nächste Veröffentlichung</Eyebrow>
							{prediction && daysUntil !== null ? (
								<>
									<p className="headline text-5xl leading-none">
										<span className={overdue ? undefined : "marker"}>
											{formatDayMonth(prediction.date)}
										</span>
									</p>
									<p
										className={cn("font-semibold mt-3", overdue && "text-seal")}
									>
										{relativeLabel(daysUntil)}
									</p>
									{prediction.sitting && (
										<p className="text-[13px] mt-1 text-ink/55">
											für die Klausuren vom{" "}
											{formatSittingRange(prediction.sitting)}
										</p>
									)}
									<p className="text-[13px] mt-1 text-ink/55">
										Wahrscheinlich zwischen dem{" "}
										{formatDayMonthShort(prediction.windowStart)} und dem{" "}
										{formatDayMonthShort(prediction.windowEnd)} ·{" "}
										{CONFIDENCE_LABEL[prediction.confidence]}
									</p>
								</>
							) : (
								<p className="text-[15px] text-ink/70">
									Für eine Prognose brauchen wir mindestens zwei
									Veröffentlichungen.
								</p>
							)}
						</Card>

						<div>
							<SignupForm
								jpas={jpas}
								loading={false}
								error={false}
								jpaId={jpaId}
								onJpaChange={setJpaId}
								source="jpa"
							/>
						</div>
					</div>

					{timeline && timeline.entries.length > 0 && (
						<section className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								Klausurtermine
							</h2>
							<p className="text-[15px] text-ink/55 mb-6">
								Wann geschrieben wird und wann die Ergebnisse voraussichtlich
								kommen. Die Termine gelten für alle Justizprüfungsämter in NRW.
							</p>
							<ExamTimelineList
								entries={timeline.entries}
								jpaSlug={jpa.slug}
								now={new Date(now)}
							/>
							<p className="border-t border-ink/10 pt-3 text-[13px] text-ink/55">
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
						</section>
					)}

					{releases.length > 0 && (
						<section className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								Bisherige Veröffentlichungen
							</h2>
							<p className="text-[15px] text-ink/55 mb-5">
								Wann das Justizprüfungsamt beim {jpa.name} neue Ergebnisse
								online gestellt hat, neueste zuerst.
							</p>
							<ul className="divide-y divide-ink/10 border-y border-ink/10">
								{releases.map((date) => (
									<li
										key={date.getTime()}
										className="py-3 flex justify-between gap-4"
									>
										<span className="font-medium">
											{date.toLocaleDateString("de-DE", {
												weekday: "long",
												day: "numeric",
												month: "long",
												year: "numeric",
											})}
										</span>
										<span className="figures text-ink/55">
											{date.toLocaleTimeString("de-DE", {
												hour: "2-digit",
												minute: "2-digit",
											})}{" "}
											Uhr
										</span>
									</li>
								))}
							</ul>
						</section>
					)}

					<section className="mb-14">
						<h2 className="text-2xl font-semibold leading-tight mb-5">
							Häufige Fragen
						</h2>
						<FaqList faqs={jpaFaqs(jpa.name, summary, timeline?.entries)} />
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
