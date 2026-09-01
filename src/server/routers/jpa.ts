import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createJpa,
	deleteJpa,
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
			return createJpa(input);
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
			await updateJpa(id, data);
			return getJpaById(id);
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

	/**
	 * Runs the exact check the scheduler runs, immediately. Safe next to a
	 * concurrently ticking loop — the compare-and-swap in checkJpa means a real
	 * change still notifies at most once, whoever sees it first.
	 */
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
