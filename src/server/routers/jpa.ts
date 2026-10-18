import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createJpa,
	deleteJpa,
	dropScrapeBaseline,
	getJpaById,
	getJpaBySlug,
	getJpas,
	getNotificationHistory,
	getScrapeStates,
	getSubscriptionCountsByJpa,
	updateJpa,
} from "@/db";
import { checkJpa } from "../scraper";
import { adminProcedure, publicProcedure, router } from "../trpc";

export const jpaRouter = router({
	getAll: publicProcedure.query(async () => {
		return getJpas();
	}),

	getBySlug: publicProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ input }) => {
			return getJpaBySlug(input.slug);
		}),

	getById: adminProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			return getJpaById(input.id);
		}),

	create: adminProcedure
		.input(
			z.object({
				name: z.string().min(1),
				slug: z.string().min(1),
				websiteUrl: z.string().url().nullable().optional(),
				scrapeUrl: z.string().url().nullable().optional(),
				scrapeSelector: z.string().min(1).nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const jpa = await createJpa(input);
			await checkJpa(jpa);
			return jpa;
		}),

	update: adminProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				slug: z.string().min(1).optional(),
				websiteUrl: z.string().url().nullable().optional(),
				scrapeUrl: z.string().url().nullable().optional(),
				scrapeSelector: z.string().min(1).nullable().optional(),
				notificationsDisabled: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const { id, ...data } = input;
			const existing = await getJpaById(id);
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND", message: "JPA not found" });
			}

			await updateJpa(id, data);
			const updated = await getJpaById(id);

			const scrapeConfigChanged =
				(data.scrapeUrl !== undefined &&
					data.scrapeUrl !== existing.scrapeUrl) ||
				(data.scrapeSelector !== undefined &&
					data.scrapeSelector !== existing.scrapeSelector);

			if (updated && scrapeConfigChanged) {
				await dropScrapeBaseline(id);
				await checkJpa(updated);
			}

			return updated;
		}),

	delete: adminProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			await deleteJpa(input.id);
			return { success: true };
		}),

	getSubscriptionCounts: adminProcedure.query(async () => {
		const counts = await getSubscriptionCountsByJpa();
		return Object.fromEntries(counts);
	}),

	getScrapeStates: adminProcedure.query(async () => {
		const states = await getScrapeStates();
		return Object.fromEntries(states.map((state) => [state.jpaId, state]));
	}),

	scrapeNow: adminProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			const jpa = await getJpaById(input.id);
			if (!jpa) {
				throw new TRPCError({ code: "NOT_FOUND", message: "JPA not found" });
			}
			return checkJpa(jpa);
		}),

	getHistory: publicProcedure.query(async () => {
		return getNotificationHistory();
	}),
});
