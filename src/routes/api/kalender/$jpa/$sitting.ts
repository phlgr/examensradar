import { createFileRoute } from "@tanstack/react-router";
import { getJpas, getNotificationHistory } from "@/db";
import { examCalendarFor, MONTHS } from "@/lib/exam-calendar";
import { sittingCalendar } from "@/lib/ics";
import { expectedReleaseDate, medianReleaseOffset } from "@/lib/prediction";
import { jpaParam, jpaPath } from "@/lib/seo";

const appUrl = () => process.env.APP_URL || "https://examensradar.de";

const asciiFileName = (month: string, year: string) =>
	`klausuren-${month.toLowerCase().replace("ä", "ae")}-${year}.ics`;

/** Calendar download linked from the welcome mail only, not from the public site. */
export const Route = createFileRoute("/api/kalender/$jpa/$sitting")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const [jpas, history] = await Promise.all([
					getJpas(),
					getNotificationHistory(),
				]);
				const jpa = jpas.find((j) => jpaParam(j.slug) === params.jpa);
				const sitting = jpa
					? examCalendarFor(jpa.slug)?.sittings.find(
							(s) => s.days[0].date === params.sitting,
						)
					: undefined;

				if (!jpa || !sitting) {
					return new Response(null, { status: 404 });
				}

				const releaseDates = history
					.filter((h) => h.jpaSlug === jpa.slug)
					.map((h) => h.sentAt);
				const [year, month] = params.sitting.split("-");
				const body = sittingCalendar({
					jpaName: jpa.name,
					jpaUrl: `${appUrl()}${jpaPath(jpa.slug)}`,
					sitting,
					expectedResults: expectedReleaseDate(
						sitting,
						medianReleaseOffset(releaseDates),
					),
					now: new Date(),
				});

				return new Response(body, {
					headers: {
						"Content-Type": "text/calendar; charset=utf-8",
						"Content-Disposition": `attachment; filename="${asciiFileName(MONTHS[Number(month) - 1], year)}"`,
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
