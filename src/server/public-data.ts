import { createServerFn } from "@tanstack/react-start";
import { getJpas, getNotificationHistory } from "@/db";

/**
 * Everything the public pages show, fetched in the route loader so it is in
 * the server-rendered HTML. Crawlers and AI assistants mostly don't run
 * JavaScript; with a client-side query they saw "Wird geladen …" instead of
 * the offices and dates people search for.
 */
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
