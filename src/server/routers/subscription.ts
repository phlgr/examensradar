import { z } from "zod";
import { deleteSubscription, getDeviceSubscriptions } from "@/db";
import { deviceProcedure, router } from "../trpc";

/**
 * Read-and-delete only: ntfy is sunsetting, so devices can see and end their
 * existing push subscriptions but no new ones can be created. Signup is email
 * (see email.ts); this router is deleted with the channel.
 */
export const subscriptionRouter = router({
	getAll: deviceProcedure.query(async ({ ctx }) => {
		return getDeviceSubscriptions(ctx.deviceId);
	}),

	delete: deviceProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await deleteSubscription(input.id, ctx.deviceId);
			return { success: true };
		}),
});
