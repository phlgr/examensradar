import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ExamTimelineList } from "@/components/ExamTimelineList";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { SectionIntro } from "@/components/ui/heading";
import {
	examCalendarFor,
	formatSittingRange,
	formatStand,
} from "@/lib/exam-calendar";
import { nrwUpcomingTimeline } from "@/lib/release-summary";
import { jpaParam, jsonLd, SITE_URL, seo } from "@/lib/seo";
import { getPublicData } from "@/server/public-data";

const PATH = "/klausurtermine";

export const Route = createFileRoute("/klausurtermine")({
	loader: async () => {
		const { jpas } = await getPublicData();
		const now = new Date();
		return {
			jpas,
			entries: nrwUpcomingTimeline(now),
			now: now.toISOString(),
		};
	},
	head: ({ loaderData }) => {
		const entries = loaderData?.entries ?? [];
		const years = [
			...new Set(entries.map((e) => e.sitting.days[0].date.slice(0, 4))),
		];
		const base = `Klausurtermine 1. Staatsexamen NRW${years.length > 0 ? ` ${years.join("/")}` : ""}`;
		const title = `${base} | Examensradar`;
		const next = entries[0];
		const description = `Alle Klausurtermine im 1. Staatsexamen in NRW für Hamm, Köln und Düsseldorf${next ? `, ${next.phase === "läuft" ? "aktueller" : "nächster"} Durchgang ${formatSittingRange(next.sitting)}` : ""}, mit voraussichtlichem Ergebnismonat. Kostenlose E-Mail, sobald die Ergebnisse online sind.`;
		return {
			...seo({
				title: title.length > 60 ? base : title,
				description,
				path: PATH,
			}),
			scripts: [
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
							name: "Klausurtermine",
							item: `${SITE_URL}${PATH}`,
						},
					],
				}),
			],
		};
	},
	component: KlausurterminePage,
});

function KlausurterminePage() {
	const { jpas, entries, now } = Route.useLoaderData();
	const nrwOffices = jpas.flatMap((jpa) => {
		const calendar = examCalendarFor(jpa.slug);
		return calendar ? [{ jpa, calendar }] : [];
	});
	const [jpaId, setJpaId] = useState(
		nrwOffices[0]?.jpa.id ?? jpas[0]?.id ?? "",
	);

	return (
		<>
			<div className="flex-1 py-12 sm:py-20 px-4 sm:px-6">
				<div className="max-w-4xl mx-auto">
					<nav aria-label="Brotkrumen" className="text-sm text-ink/50 mb-6">
						<Link to="/" className="hover:text-ink">
							Examensradar
						</Link>
						{" / "}
						<span className="text-ink/70">Klausurtermine</span>
					</nav>

					<SectionIntro
						as="h1"
						title="Klausurtermine im 1. Staatsexamen in NRW"
						className="mb-10 sm:mb-14"
					>
						Diese Termine gelten für alle drei Justizprüfungsämter in NRW. Jeder
						Durchgang hat sechs Klausuren: drei im Zivilrecht, zwei im
						Öffentlichen Recht und eine im Strafrecht. Die Ergebnisse kommen
						etwa drei Monate nach dem Start. Alle Angaben ohne Gewähr.
					</SectionIntro>

					{entries.length > 0 && (
						<section className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								Die nächsten Durchgänge
							</h2>
							<p className="text-[15px] text-ink/55 mb-6">
								Wann geschrieben wird und wann die Ergebnisse voraussichtlich
								kommen.
							</p>
							<ExamTimelineList entries={entries} now={new Date(now)} />
							<p className="mt-4 text-[13px] text-ink/55">
								ZR Zivilrecht · ÖR Öffentliches Recht · SR Strafrecht
							</p>
							<p className="mt-1 text-[13px] text-ink/55">
								Ohne Gewähr. Quellen:{" "}
								{nrwOffices.map(({ jpa, calendar }, index) => (
									<span key={jpa.slug}>
										{index > 0 && ", "}
										<a
											href={calendar.pageUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="underline decoration-1 underline-offset-4 hover:decoration-2"
										>
											Klausurtermine {jpa.name}
										</a>
										{calendar.stand &&
											` (Stand ${formatStand(calendar.stand)})`}
									</span>
								))}
								.
							</p>
						</section>
					)}

					{nrwOffices.length > 0 && (
						<section className="mb-14">
							<h2 className="text-2xl font-semibold leading-tight mb-2">
								Termine und Ergebnisse je Prüfungsamt
							</h2>
							<p className="text-[15px] text-ink/55 mb-5">
								Auf den Seiten der Prüfungsämter findest du den
								Kalender-Download (.ics) für einzelne Durchgänge und die
								bisherigen Veröffentlichungen der Ergebnisse.
							</p>
							<ul className="divide-y divide-ink/10 border-y border-ink/10">
								{nrwOffices.map(({ jpa }) => (
									<li key={jpa.slug}>
										<Link
											to="/ergebnisse/$jpa"
											params={{ jpa: jpaParam(jpa.slug) }}
											className="block py-3 font-medium hover:text-seal"
										>
											{jpa.name}
										</Link>
									</li>
								))}
							</ul>
						</section>
					)}

					<section className="mb-14">
						<h2 className="text-2xl font-semibold leading-tight mb-2">
							Klausuren geschrieben? Wir sagen dir Bescheid.
						</h2>
						<p className="text-[15px] text-ink/55 mb-5">
							Trag dich ein, und wir schicken dir eine E-Mail, sobald dein
							Prüfungsamt die Ergebnisse veröffentlicht. Viel Erfolg!
						</p>
						<SignupForm
							jpas={jpas}
							loading={false}
							error={false}
							jpaId={jpaId}
							onJpaChange={setJpaId}
							source="klausurtermine"
						/>
					</section>
				</div>
			</div>
			<Footer jpas={jpas} />
		</>
	);
}
