import { z } from "zod";
import {
	createJpa,
	deleteJpa,
	getJpaById,
	getJpaBySlug,
	getJpas,
	updateJpa,
} from "@/db";
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
});
