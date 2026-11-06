import { createServerFn } from "@tanstack/react-start";
import { getJpas, getNotificationHistory } from "@/db";
import { getOralExamSchedule } from "@/server/oral-exams";

/** Loader-fetched so it is in the SSR HTML: crawlers mostly don't run JavaScript. */
export const getPublicData = createServerFn({ method: "GET" }).handler(
	async () => {
		const [jpas, history] = await Promise.all([
			getJpas(),
			getNotificationHistory(),
		]);
		return {
			jpas: jpas.map(({ id, slug, name, websiteUrl }) => ({
				id,
				slug,
				name,
				websiteUrl,
			})),
			history,
		};
	},
);

export const getOralExams = createServerFn({ method: "GET" })
	.validator((slug: string) => slug)
	.handler(async ({ data: slug }) => (await getOralExamSchedule(slug)) ?? null);
