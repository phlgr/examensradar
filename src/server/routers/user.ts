import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { completeSubscriptionSetup } from "@/db";
import { sendNtfyNotification } from "@/lib/ntfy";
import { createVerificationCode, verifyCode } from "@/lib/verification-codes";
import { deviceProcedure, router } from "../trpc";

export const userRouter = router({
	completeOnboarding: deviceProcedure
		.input(z.object({ subscriptionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const subscription = await completeSubscriptionSetup(
				input.subscriptionId,
				ctx.deviceId,
			);

			// Send welcome notification with restore link
			const appUrl = process.env.APP_URL || "https://examensradar.de";
			await sendNtfyNotification({
				topic: subscription.ntfyTopic,
				title: "Willkommen bei Examensradar!",
				message:
					"Dein Abonnement ist eingerichtet. Du wirst benachrichtigt, sobald neue Ergebnisse veröffentlicht werden.",
				actions: [
					{
						action: "view",
						label: "Abonnements verwalten",
						url: `${appUrl}/subscriptions?restore=${ctx.deviceId}`,
					},
				],
			});

			return { success: true };
		}),

	sendTestNotification: deviceProcedure
		.input(z.object({ ntfyTopic: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Get or create verification code (reuses existing code if still valid)
			const code = createVerificationCode(ctx.deviceId, input.ntfyTopic);

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

	pingNotification: deviceProcedure
		.input(z.object({ ntfyTopic: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const appUrl = process.env.APP_URL || "https://examensradar.de";
			const sent = await sendNtfyNotification({
				topic: input.ntfyTopic,
				title: "Examensradar",
				message:
					"Super, die Benachrichtigungen funktionieren noch einwandfrei!",
				actions: [
					{
						action: "view",
						label: "Abonnements verwalten",
						url: `${appUrl}/subscriptions?restore=${ctx.deviceId}`,
					},
				],
			});

			if (!sent) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Benachrichtigung konnte nicht gesendet werden.",
				});
			}

			return { success: true };
		}),

	verifyTestCode: deviceProcedure
		.input(z.object({ code: z.string().length(6) }))
		.mutation(async ({ ctx, input }) => {
			const result = verifyCode(ctx.deviceId, input.code);

			if (!result.valid) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Ungültiger oder abgelaufener Code.",
				});
			}

			return { success: true };
		}),
});
