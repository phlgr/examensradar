import { z } from "zod";
import { getJpaBySlug, getJpas } from "@/db";
import { publicProcedure, router } from "../trpc";

export const jpaRouter = router({
	getAll: publicProcedure.query(async () => {
		return getJpas();
	}),

	getBySlug: publicProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ input }) => {
			return getJpaBySlug(input.slug);
		}),
});
