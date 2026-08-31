import { createFileRoute } from "@tanstack/react-router";
import {
	countEmailSubscriptionsByJpa,
	countSubscriptionsByJpa,
	getJpaBySlug,
	getMailableSubscribersByJpa,
	getNotifiableSubscriptionsByJpa,
	logNotification,
} from "@/db";
import { type Mail, sendBatchMails } from "@/lib/mail";
import { renderResultsMail } from "@/lib/mail-templates";
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

/**
 * Both channels run during the ntfy sunset overlap. They are independent: a
 * rate-limited ntfy fan-out must not hold up mail, and neither failure should
 * cost the other its delivery, so they run concurrently and their results are
 * summed only for the log.
 */
async function dispatch(
	jpa: { id: string; slug: string },
	notifications: NtfyNotification[],
	mails: Mail[],
	publishedAt: Date,
): Promise<void> {
	try {
		const [push, mail] = await Promise.all([
			notifications.length
				? sendBatchNotifications(notifications, {
						baseUrl: process.env.NTFY_BASE_URL || "https://ntfy.sh",
						budgetMs: DISPATCH_BUDGET_MS,
						maxAttempts: DISPATCH_MAX_ATTEMPTS,
					})
				: Promise.resolve({ sent: 0, failed: 0 }),
			mails.length
				? sendBatchMails(mails, { budgetMs: DISPATCH_BUDGET_MS })
				: Promise.resolve({ sent: 0, failed: 0 }),
		]);

		// /history reads this as "how many people were told", so it has to count
		// both channels.
		await logNotification(jpa.id, push.sent + mail.sent, publishedAt);

		console.log(
			`[webhook] ${jpa.slug}: ntfy ${push.sent}/${notifications.length}, mail ${mail.sent}/${mails.length}`,
		);

		if (push.failed > 0 || mail.failed > 0) {
			console.error(
				`[webhook] ${jpa.slug}: ${push.failed} push and ${mail.failed} mail notifications FAILED after retries`,
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
				// Confirmed, still subscribed, not suppressed
				const subscribers = await getMailableSubscribersByJpa(jpa.id);

				if (subscriptions.length === 0 && subscribers.length === 0) {
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

				const mails = subscribers.map((subscriber) => ({
					...renderResultsMail(
						jpa.name,
						jpa.websiteUrl,
						subscriber.manageToken,
					),
					to: subscriber.email,
				}));

				const total =
					(await countSubscriptionsByJpa(jpa.id)) +
					(await countEmailSubscriptionsByJpa(jpa.id));

				// Acknowledge before delivering. Waiting out ntfy.sh's per-IP burst
				// limit can take minutes, and changebot gives up after 30s — a timeout
				// there would look like a failed notification and could be retried,
				// re-pushing to everyone who already succeeded.
				void dispatch(jpa, notifications, mails, new Date());

				return Response.json(
					{
						message: "Notifications queued",
						jpa: jpa.slug,
						notifiable: notifications.length + mails.length,
						push: notifications.length,
						mail: mails.length,
						total,
					},
					{ status: 202 },
				);
			},
		},
	},
});
