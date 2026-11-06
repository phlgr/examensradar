import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarPlus, ExternalLink } from "lucide-react";
import { useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
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
} from "@/lib/exam-calendar";
import { jpaFaqs, officePageMeta } from "@/lib/faq";
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

function ExamTimelineList({
	entries,
	jpaSlug,
	now,
}: {
	entries: TimelineEntry[];
	jpaSlug: string;
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
							{open && (
								<CalendarLink jpaSlug={jpaSlug} sitting={entry.sitting} />
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

function JpaPage() {
	const { jpas, jpa, summary, timeline, now } = Route.useLoaderData();
	const [jpaId, setJpaId] = useState(jpa.id);
	const prediction = summary?.prediction ?? null;
	const daysUntil = summary?.daysUntil ?? null;
	const overdue = daysUntil !== null && daysUntil < 0;
	const meta = officePageMeta(jpa.name, summary, timeline?.entries);
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
						<Link to="/ergebnisse" className="hover:text-ink">
							Ergebnisse
						</Link>
						{" / "}
						<span className="text-ink/70">{jpa.name}</span>
					</nav>

					<SectionIntro as="h1" title={meta.h1} className="mb-10 sm:mb-14">
						{meta.intro}
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
								Klausurtermine beim {jpa.name}
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
