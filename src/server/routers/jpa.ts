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
	resetScrapeState,
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
			if (jpa.scrapeUrl && jpa.scrapeSelector) {
				// Store the baseline right away — with no stored hash this can only
				// record, never notify.
				await checkJpa(jpa);
			}
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

			// A changed scrape config makes the stored baseline meaningless: it
			// hashes what the OLD URL/selector saw, so the next check would read as
			// a guaranteed "change" and mass-notify. Reset instead, and store the
			// new config's baseline immediately so monitoring resumes without a
			// notification and without waiting for the next tick.
			const scrapeConfigChanged =
				(data.scrapeUrl !== undefined &&
					data.scrapeUrl !== existing.scrapeUrl) ||
				(data.scrapeSelector !== undefined &&
					data.scrapeSelector !== existing.scrapeSelector);

			if (updated && scrapeConfigChanged) {
				await resetScrapeState(id);
				if (updated.scrapeUrl && updated.scrapeSelector) {
					await checkJpa(updated);
				}
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
