import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@/db";
import { protectedProcedure, router } from "../trpc";

export const subscriptionRouter = router({
	getAll: protectedProcedure.query(async ({ ctx }) => {
		return db.getUserSubscriptions(ctx.d1, ctx.user.id);
	}),

	create: protectedProcedure
		.input(z.object({ jpaId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check if already subscribed
			const existing = await db.getUserSubscriptions(ctx.d1, ctx.user.id);
			if (existing.some((s) => s.jpaId === input.jpaId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Already subscribed",
				});
			}

			return db.createSubscription(ctx.d1, ctx.user.id, input.jpaId);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await db.deleteSubscription(ctx.d1, input.id, ctx.user.id);
			return { success: true };
		}),
});
