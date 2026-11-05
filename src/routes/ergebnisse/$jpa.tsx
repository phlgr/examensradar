import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Fragment, useState } from "react";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionIntro } from "@/components/ui/heading";
import {
	calendarDate,
	type ExamSubject,
	formatExamDay,
	formatSittingMonth,
	formatSittingRange,
	formatStand,
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
	type SittingPhase,
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

const SUBJECT_TINT: Record<ExamSubject, string> = {
	ZR: "bg-blue-100 text-blue-900",
	ÖR: "bg-ok-soft text-ok",
	SR: "bg-seal-soft text-seal-deep",
};

const chipClass = (subject: ExamSubject) =>
	cn(
		"inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none",
		SUBJECT_TINT[subject],
	);

const DOT: Record<SittingPhase, string> = {
	veröffentlicht: "bg-ink/40",
	ausstehend: "bg-ink",
	läuft: "bg-seal",
	anstehend: "bg-paper border-2 border-ink",
};

function ResultsLine({ sitting, results }: TimelineEntry) {
	if (results.kind === "released") {
		return <>✓ Ergebnisse am {formatLongDate(results.date)} veröffentlicht</>;
	}
	return (
		<>
			Ergebnisse voraussichtlich{" "}
			{results.exact ? (
				<>
					am <b className="text-ink">{formatLongDate(results.date)}</b>
				</>
			) : (
				<>
					Ende <b className="text-ink">{resultMonthName(sitting)}</b>
				</>
			)}
		</>
	);
}

function ExamTimelineList({
	entries,
	now,
}: {
	entries: TimelineEntry[];
	now: Date;
}) {
	const today = calendarDate(now);
	const firstUpcoming = entries.findIndex((e) => e.phase === "anstehend");
	const todayMarkerAt = entries.some((e) => e.phase === "läuft")
		? -1
		: firstUpcoming === -1
			? entries.length
			: firstUpcoming;
	const marker = (
		<li className="-ml-3 flex items-center gap-3 pb-7 last:pb-0">
			<span className="rounded-full bg-seal px-2.5 py-1 text-xs font-semibold text-white">
				Heute
			</span>
			<span className="text-[13px] text-ink/55">{formatLongDate(now)}</span>
		</li>
	);

	return (
		<ol className="ml-1.5 border-l-2 border-ink/10">
			{entries.map((entry, index) => (
				<Fragment key={entry.sitting.days[0].date}>
					{index === todayMarkerAt && marker}
					<li className="relative pb-7 pl-6 last:pb-0">
						<span
							aria-hidden="true"
							className={cn(
								"absolute top-1.5 -left-[7px] size-3 rounded-full",
								DOT[entry.phase],
							)}
						/>
						<div
							className={cn(entry.phase === "veröffentlicht" && "opacity-60")}
						>
							<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
								<p>
									<span className="font-semibold">
										{formatSittingMonth(entry.sitting)}
									</span>
									<span className="text-[13px] text-ink/55">
										{" · "}
										{formatSittingRange(entry.sitting, { year: false })}
									</span>
									{entry.phase === "läuft" && (
										<span className="ml-2 rounded-full bg-seal px-2 py-0.5 text-[11px] font-semibold text-white">
											läuft gerade
										</span>
									)}
								</p>
								<p className="text-[13px] text-ink/55">
									<ResultsLine {...entry} />
								</p>
							</div>
							<ul className="mt-2 flex flex-wrap gap-1.5">
								{entry.sitting.days.map((day) => (
									<li
										key={day.date}
										className={cn(
											"flex items-center gap-1.5 rounded-lg bg-sheet px-2 py-1 text-[13px] ring-1 ring-ink/10",
											entry.phase === "läuft" &&
												day.date < today &&
												"opacity-50",
										)}
									>
										<span>{formatExamDay(day.date)}</span>
										<span title={SUBJECT_NAME[day.subject]}>
											<span
												aria-hidden="true"
												className={chipClass(day.subject)}
											>
												{day.subject}
											</span>
											<span className="sr-only">
												{SUBJECT_NAME[day.subject]}
											</span>
										</span>
									</li>
								))}
							</ul>
						</div>
					</li>
				</Fragment>
			))}
			{todayMarkerAt === entries.length && marker}
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
								now={new Date(now)}
							/>
							<p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink/55 mt-5">
								{Object.entries(SUBJECT_NAME).map(([subject, name]) => (
									<span key={subject}>
										<span
											aria-hidden="true"
											className={chipClass(subject as ExamSubject)}
										>
											{subject}
										</span>{" "}
										{name}
									</span>
								))}
							</p>
							<p className="text-[13px] text-ink/55 mt-2">
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
