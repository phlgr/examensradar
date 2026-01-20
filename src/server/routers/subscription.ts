import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createSubscription,
	deleteSubscription,
	getUserSubscriptions,
} from "@/db";
import { protectedProcedure, router } from "../trpc";

export const subscriptionRouter = router({
	getAll: protectedProcedure.query(async ({ ctx }) => {
		return getUserSubscriptions(ctx.user.id);
	}),

	create: protectedProcedure
		.input(z.object({ jpaId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check if already subscribed
			const existing = await getUserSubscriptions(ctx.user.id);
			if (existing.some((s) => s.jpaId === input.jpaId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Already subscribed",
				});
			}

			// Check if this is the first subscription without completed setup
			const isFirstSubscription =
				existing.length === 0 ||
				existing.every((s) => s.setupCompletedAt !== null);
			const subscription = await createSubscription(ctx.user.id, input.jpaId);

			return {
				...subscription,
				isFirstSubscription,
			};
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await deleteSubscription(input.id, ctx.user.id);
			return { success: true };
		}),
});
