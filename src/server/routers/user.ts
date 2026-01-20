import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@/db";
import { sendNtfyNotification } from "@/lib/ntfy";
import {
	createVerificationCode,
	hasActiveCode,
	verifyCode,
} from "@/lib/verification-codes";
import { protectedProcedure, router } from "../trpc";

export const userRouter = router({
	getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
		const user = await db.getUserById(ctx.d1, ctx.user.id);
		return {
			hasCompletedOnboarding: !!user?.ntfyOnboardingCompletedAt,
			completedAt: user?.ntfyOnboardingCompletedAt,
		};
	}),

	completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
		await db.updateUserOnboardingStatus(ctx.d1, ctx.user.id, new Date());
		return { success: true };
	}),

	sendTestNotification: protectedProcedure
		.input(z.object({ ntfyTopic: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Rate limit: only allow one active code at a time
			if (hasActiveCode(ctx.user.id)) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message:
						"Ein Testcode wurde bereits gesendet. Bitte warte 5 Minuten.",
				});
			}

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
		await db.deleteUser(ctx.d1, ctx.user.id);
		return { success: true };
	}),
});
