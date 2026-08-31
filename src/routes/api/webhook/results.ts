import { createFileRoute } from "@tanstack/react-router";
import {
	countSubscriptionsByJpa,
	getJpaBySlug,
	getNotifiableSubscriptionsByJpa,
	logNotification,
} from "@/db";
import { sendBatchNotifications } from "@/lib/ntfy";

interface WebhookPayload {
	jpa_slug: string;
}

export const Route = createFileRoute("/api/webhook/results")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// Verify webhook secret
				const authHeader = request.headers.get("Authorization");
				const expectedSecret = process.env.WEBHOOK_SECRET;

				if (!expectedSecret) {
					console.error("WEBHOOK_SECRET not configured");
					return Response.json(
						{ error: "Server misconfigured" },
						{ status: 500 },
					);
				}

				if (authHeader !== `Bearer ${expectedSecret}`) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				let body: WebhookPayload;
				try {
					body = (await request.json()) as WebhookPayload;
				} catch {
					return Response.json({ error: "Invalid JSON" }, { status: 400 });
				}

				const { jpa_slug } = body;
				if (!jpa_slug) {
					return Response.json({ error: "Missing jpa_slug" }, { status: 400 });
				}

				// Find the JPA
				const jpa = await getJpaBySlug(jpa_slug);
				if (!jpa) {
					return Response.json({ error: "JPA not found" }, { status: 404 });
				}

				if (jpa.notificationsDisabled) {
					return Response.json({
						message: "Notifications disabled for this JPA",
						sent: 0,
					});
				}

				// Only devices that have proven they can receive pushes
				const subscriptions = await getNotifiableSubscriptionsByJpa(jpa.id);

				if (subscriptions.length === 0) {
					return Response.json({ message: "No subscribers", sent: 0 });
				}

				// Send notifications
				const appUrl = process.env.APP_URL || "https://examensradar.de";
				const notifications = subscriptions.map((sub) => {
					const actions = [];

					if (jpa.websiteUrl) {
						actions.push({
							action: "view" as const,
							label: "Ergebnisse ansehen",
							url: jpa.websiteUrl,
						});
					}

					actions.push({
						action: "view" as const,
						label: "Abonnements verwalten",
						url: `${appUrl}/subscriptions?restore=${sub.deviceId}`,
					});

					return {
						topic: sub.ntfyTopic,
						title: "Neue Ergebnisse verfügbar",
						message: `Das ${jpa.name} hat neue Examensergebnisse veröffentlicht.`,
						click: jpa.websiteUrl || undefined,
						priority: "max" as const,
						actions,
					};
				});

				const ntfyBaseUrl = process.env.NTFY_BASE_URL || "https://ntfy.sh";
				const { sent, failed } = await sendBatchNotifications(
					notifications,
					ntfyBaseUrl,
				);

				// Log the notification
				await logNotification(jpa.id, sent);

				const total = await countSubscriptionsByJpa(jpa.id);

				if (failed > 0) {
					console.error(
						`[webhook] ${jpa.slug}: ${failed} of ${subscriptions.length} notifications FAILED (sent ${sent})`,
					);
				} else {
					console.log(
						`[webhook] ${jpa.slug}: sent ${sent}/${subscriptions.length} notifications (${total} subscriptions total)`,
					);
				}

				return Response.json({
					message: "Notifications sent",
					sent,
					failed,
					notifiable: subscriptions.length,
					total,
				});
			},
		},
	},
});
