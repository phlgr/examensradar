import { createFileRoute } from "@tanstack/react-router";
import { getJpas, getNotificationHistory } from "@/db";
import { examCalendarFor } from "@/lib/exam-calendar";
import { summarizeReleases } from "@/lib/release-summary";
import { jpaPath, officeLastmod, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const [jpas, history] = await Promise.all([
					getJpas(),
					getNotificationHistory(),
				]);
				const summaries = summarizeReleases(history, new Date());
				const lastmodOf = (date: Date | undefined) =>
					date ? `<lastmod>${date.toISOString().slice(0, 10)}</lastmod>` : "";
				const latest = summaries
					.map((s) => s.lastRelease)
					.sort((a, b) => b.getTime() - a.getTime())[0];
				const nrwStand = jpas
					.flatMap((jpa) => {
						const stand = officeLastmod(
							undefined,
							examCalendarFor(jpa.slug)?.stand,
						);
						return stand ? [stand] : [];
					})
					.sort((a, b) => b.getTime() - a.getTime())[0];

				const urls = [
					{ path: "/", lastmod: lastmodOf(latest) },
					{ path: "/history", lastmod: lastmodOf(latest) },
					{
						path: "/klausurtermine",
						lastmod: lastmodOf(nrwStand),
					},
					...jpas.map((jpa) => ({
						path: jpaPath(jpa.slug),
						lastmod: lastmodOf(
							officeLastmod(
								summaries.find((s) => s.slug === jpa.slug)?.lastRelease,
								examCalendarFor(jpa.slug)?.stand,
							),
						),
					})),
				];

				const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${SITE_URL}${url.path}</loc>${url.lastmod}</url>`).join("\n")}
</urlset>
`;
				return new Response(body, {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
