import { z } from "zod";
import { db } from "@/db";
import { publicProcedure, router } from "../trpc";

export const jpaRouter = router({
	getAll: publicProcedure.query(async ({ ctx }) => {
		if (!ctx.d1) {
			throw new Error("Database not configured");
		}
		return db.getJpas(ctx.d1);
	}),

	getBySlug: publicProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ ctx, input }) => {
			if (!ctx.d1) {
				throw new Error("Database not configured");
			}
			return db.getJpaBySlug(ctx.d1, input.slug);
		}),
});
