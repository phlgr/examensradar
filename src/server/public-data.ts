import { createServerFn } from "@tanstack/react-start";
import { getJpas, getNotificationHistory } from "@/db";

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
