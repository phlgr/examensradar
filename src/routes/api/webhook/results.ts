import { createFileRoute } from "@tanstack/react-router";
import {
	countSubscriptionsByJpa,
	getJpaBySlug,
	getNotifiableSubscriptionsByJpa,
	logNotification,
} from "@/db";
import { type NtfyNotification, sendBatchNotifications } from "@/lib/ntfy";

interface WebhookPayload {
	jpa_slug: string;
}

/**
 * Freed from changebot's 30s timeout, the background fan-out can afford to sit
 * out a rate limit properly: ntfy.sh replenishes roughly one token per 5s, so
 * clearing a large overshoot is a minutes-long job, not a seconds-long one.
 */
const DISPATCH_BUDGET_MS = 5 * 60_000;
const DISPATCH_MAX_ATTEMPTS = 6;

async function dispatch(
	jpa: { id: string; slug: string },
	notifications: NtfyNotification[],
	publishedAt: Date,
): Promise<void> {
	try {
		const { sent, failed } = await sendBatchNotifications(notifications, {
			baseUrl: process.env.NTFY_BASE_URL || "https://ntfy.sh",
			budgetMs: DISPATCH_BUDGET_MS,
			maxAttempts: DISPATCH_MAX_ATTEMPTS,
		});

		await logNotification(jpa.id, sent, publishedAt);

		if (failed > 0) {
			console.error(
				`[webhook] ${jpa.slug}: ${failed} of ${notifications.length} notifications FAILED after retries (sent ${sent})`,
			);
		} else {
			console.log(
				`[webhook] ${jpa.slug}: sent ${sent}/${notifications.length} notifications`,
			);
		}
	} catch (error) {
		// Nothing upstream is listening any more — the webhook already returned.
		console.error(`[webhook] ${jpa.slug}: dispatch crashed`, error);
	}
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

				const total = await countSubscriptionsByJpa(jpa.id);

				// Acknowledge before delivering. Waiting out ntfy.sh's per-IP burst
				// limit can take minutes, and changebot gives up after 30s — a timeout
				// there would look like a failed notification and could be retried,
				// re-pushing to everyone who already succeeded.
				void dispatch(jpa, notifications, new Date());

				return Response.json(
					{
						message: "Notifications queued",
						jpa: jpa.slug,
						notifiable: notifications.length,
						total,
					},
					{ status: 202 },
				);
			},
		},
	},
});
