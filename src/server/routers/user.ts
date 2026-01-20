import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	completeSubscriptionSetup,
	deleteUser,
	getUserById,
	updateUserOnboardingStatus,
} from "@/db";
import { sendNtfyNotification } from "@/lib/ntfy";
import { createVerificationCode, verifyCode } from "@/lib/verification-codes";
import { protectedProcedure, router } from "../trpc";

export const userRouter = router({
	getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
		const user = await getUserById(ctx.user.id);
		return {
			hasCompletedOnboarding: !!user?.ntfyOnboardingCompletedAt,
			completedAt: user?.ntfyOnboardingCompletedAt,
		};
	}),

	completeOnboarding: protectedProcedure
		.input(z.object({ subscriptionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Complete setup for the specific subscription
			await completeSubscriptionSetup(input.subscriptionId, ctx.user.id);
			// Also mark global onboarding as complete for backwards compatibility
			await updateUserOnboardingStatus(ctx.user.id, new Date());
			return { success: true };
		}),

	sendTestNotification: protectedProcedure
		.input(z.object({ ntfyTopic: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Get or create verification code (reuses existing code if still valid)
			const code = createVerificationCode(ctx.user.id, input.ntfyTopic);

			const sent = await sendNtfyNotification({
				topic: input.ntfyTopic,
				title: "Willkommen bei Examensradar!",
				message: `Super, die Benachrichtigungen funktionieren! Dein Code zur Bestätigung: ${code}`,
				priority: "high",
			});

			if (!sent) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Benachrichtigung konnte nicht gesendet werden.",
				});
			}

			return { success: true };
		}),

	verifyTestCode: protectedProcedure
		.input(z.object({ code: z.string().length(6) }))
		.mutation(async ({ ctx, input }) => {
			const result = verifyCode(ctx.user.id, input.code);

			if (!result.valid) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Ungültiger oder abgelaufener Code.",
				});
			}

			return { success: true };
		}),

	deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
		await deleteUser(ctx.user.id);
		return { success: true };
	}),
});
