import { createServerFn } from "@tanstack/react-start";
import { getJpas, getNotificationHistory } from "@/db";
import {
	examTimeline,
	officeStatus,
	olderReleases,
	publicSummary,
	summarizeReleases,
} from "@/lib/release-summary";
import { jpaParam } from "@/lib/seo";

async function loadPublic() {
	const [jpas, history] = await Promise.all([
		getJpas(),
		getNotificationHistory(),
	]);
	const now = new Date();
	return {
		jpas: jpas.map(({ id, slug, name, websiteUrl }) => ({
			id,
			slug,
			name,
			websiteUrl,
		})),
		summaries: summarizeReleases(history, now),
		now,
	};
}

export const getPublicData = createServerFn({ method: "GET" }).handler(
	async () => {
		const { jpas, summaries } = await loadPublic();
		return { jpas, summaries: summaries.map(publicSummary) };
	},
);

export const getOfficeData = createServerFn({ method: "GET" })
	.validator((param: string) => param)
	.handler(async ({ data: param }) => {
		const { jpas, summaries, now } = await loadPublic();
		const jpa = jpas.find((j) => jpaParam(j.slug) === param);
		if (!jpa) return null;
		const summary = summaries.find((s) => s.slug === jpa.slug);
		const dates = summary?.dates ?? [];
		const timeline = examTimeline(jpa.slug, dates, now);
		const entries = timeline?.entries ?? [];
		return {
			jpas,
			jpa,
			summary: summary && publicSummary(summary),
			timeline,
			older: olderReleases(jpa.slug, dates, entries),
			status: officeStatus(summary, entries, now),
			now: now.toISOString(),
		};
	});
