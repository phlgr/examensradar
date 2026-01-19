import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { getD1 } from "@/lib/d1";
import { sendBatchNotifications } from "@/lib/ntfy";

interface WebhookPayload {
	jpa_slug: string;
}

export const Route = createFileRoute("/api/webhook/results")({
	server: {
		handlers: {
			POST: async ({ request, context }) => {
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

				const d1 = await getD1(context);
				if (!d1) {
					return Response.json(
						{ error: "Database not configured" },
						{ status: 500 },
					);
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
				const jpa = await db.getJpaBySlug(d1, jpa_slug);
				if (!jpa) {
					return Response.json({ error: "JPA not found" }, { status: 404 });
				}

				// Get all subscriptions for this JPA
				const subscriptions = await db.getSubscriptionsByJpa(d1, jpa.id);

				if (subscriptions.length === 0) {
					return Response.json({ message: "No subscribers", sent: 0 });
				}

				// Send notifications
				const notifications = subscriptions.map((sub) => ({
					topic: sub.ntfyTopic,
					title: "Neue Ergebnisse verfügbar",
					message: `Das ${jpa.name} hat neue Examensergebnisse veröffentlicht.`,
					click: jpa.websiteUrl || undefined,
					priority: "high" as const,
				}));

				const ntfyBaseUrl = process.env.NTFY_BASE_URL || "https://ntfy.sh";
				const { sent, failed } = await sendBatchNotifications(
					notifications,
					ntfyBaseUrl,
				);

				// Log the notification
				await db.logNotification(d1, jpa.id, sent);

				return Response.json({
					message: "Notifications sent",
					sent,
					failed,
					total: subscriptions.length,
				});
			},
		},
	},
});
