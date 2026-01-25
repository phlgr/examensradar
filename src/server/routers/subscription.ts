import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createSubscription,
	deleteSubscription,
	getDeviceSubscriptions,
} from "@/db";
import { deviceProcedure, router } from "../trpc";

export const subscriptionRouter = router({
	getAll: deviceProcedure.query(async ({ ctx }) => {
		return getDeviceSubscriptions(ctx.deviceId);
	}),

	create: deviceProcedure
		.input(z.object({ jpaId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check if already subscribed
			const existing = await getDeviceSubscriptions(ctx.deviceId);
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
			const subscription = await createSubscription(ctx.deviceId, input.jpaId);

			return {
				...subscription,
				isFirstSubscription,
			};
		}),

	delete: deviceProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await deleteSubscription(input.id, ctx.deviceId);
			return { success: true };
		}),
});
