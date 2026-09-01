import {
	countEmailSubscriptionsByJpa,
	countSubscriptionsByJpa,
	getMailableSubscribersByJpa,
	getNotifiableSubscriptionsByJpa,
	logNotification,
} from "@/db";
import { type Mail, sendBatchMails } from "@/lib/mail";
import { renderResultsMail } from "@/lib/mail-templates";
import { type NtfyNotification, sendBatchNotifications } from "@/lib/ntfy";

export interface ResultsJpa {
	id: string;
	slug: string;
	name: string;
	websiteUrl: string | null;
	notificationsDisabled: boolean;
}

export type NotifyOutcome =
	| { status: "disabled" }
	| { status: "queued"; push: number; mail: number; total: number };

/**
 * Freed from any caller's timeout, the background fan-out can afford to sit
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
			`[notify] ${jpa.slug}: ntfy ${push.sent}/${notifications.length}, mail ${mail.sent}/${mails.length}`,
		);

		if (push.failed > 0 || mail.failed > 0) {
			console.error(
				`[notify] ${jpa.slug}: ${push.failed} push and ${mail.failed} mail notifications FAILED after retries`,
			);
		}
	} catch (error) {
		// Nothing upstream is listening any more — the caller already moved on.
		console.error(`[notify] ${jpa.slug}: dispatch crashed`, error);
	}
}

/**
 * Fans a "new results" publication out to every subscriber of the JPA, on both
 * channels. Only ever reached through checkJpa's compare-and-swap (scheduler
 * tick or the admin's "Jetzt prüfen"), which is what guarantees a publication
 * is delivered at most once.
 *
 * Returns as soon as the fan-out is queued. Waiting out ntfy.sh's per-IP burst
 * limit can take minutes, and no caller benefits from blocking on it.
 */
export async function queueResultsNotifications(
	jpa: ResultsJpa,
	publishedAt: Date = new Date(),
): Promise<NotifyOutcome> {
	if (jpa.notificationsDisabled) {
		return { status: "disabled" };
	}

	// Only devices that have proven they can receive pushes
	const subscriptions = await getNotifiableSubscriptionsByJpa(jpa.id);
	// Confirmed, still subscribed, not suppressed
	const subscribers = await getMailableSubscribersByJpa(jpa.id);

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
		...renderResultsMail(jpa.name, jpa.websiteUrl, {
			manage: subscriber.manageToken,
			unsubscribe: subscriber.unsubscribeToken,
		}),
		to: subscriber.email,
	}));

	const total =
		(await countSubscriptionsByJpa(jpa.id)) +
		(await countEmailSubscriptionsByJpa(jpa.id));

	if (notifications.length > 0 || mails.length > 0) {
		void dispatch(jpa, notifications, mails, publishedAt);
	}

	return {
		status: "queued",
		push: notifications.length,
		mail: mails.length,
		total,
	};
}
