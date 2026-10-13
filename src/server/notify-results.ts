import {
	countEmailSubscriptionsByJpa,
	getMailableSubscribersByJpa,
	logNotification,
} from "@/db";
import { type Mail, sendBatchMails } from "@/lib/mail";
import { renderResultsMail } from "@/lib/mail-templates";

export interface ResultsJpa {
	id: string;
	slug: string;
	name: string;
	websiteUrl: string | null;
	notificationsDisabled: boolean;
}

export type NotifyOutcome =
	| { status: "disabled" }
	| { status: "queued"; mail: number; total: number };

/**
 * Freed from any caller's timeout, the background fan-out can afford to sit
 * out SMTP throttling properly instead of dropping mail.
 */
const DISPATCH_BUDGET_MS = 5 * 60_000;

async function dispatch(
	jpa: { id: string; slug: string },
	mails: Mail[],
	publishedAt: Date,
): Promise<void> {
	try {
		const mail = await sendBatchMails(mails, { budgetMs: DISPATCH_BUDGET_MS });

		// /history reads this as "how many people were told".
		await logNotification(jpa.id, mail.sent, publishedAt);

		console.log(`[notify] ${jpa.slug}: mail ${mail.sent}/${mails.length}`);

		if (mail.failed > 0) {
			console.error(
				`[notify] ${jpa.slug}: ${mail.failed} mail notifications FAILED after retries`,
			);
		}
	} catch (error) {
		// Nothing upstream is listening any more — the caller already moved on.
		console.error(`[notify] ${jpa.slug}: dispatch crashed`, error);
	}
}

/**
 * Fans a "new results" publication out to every mail subscriber of the JPA.
 * Only ever reached through checkJpa's compare-and-swap (scheduler tick or the
 * admin's "Jetzt prüfen"), which is what guarantees a publication is delivered
 * at most once. ntfy push is sunset; legacy subscriptions are no longer served.
 *
 * Returns as soon as the fan-out is queued — no caller benefits from blocking
 * on delivery.
 */
export async function queueResultsNotifications(
	jpa: ResultsJpa,
	publishedAt: Date = new Date(),
): Promise<NotifyOutcome> {
	if (jpa.notificationsDisabled) {
		return { status: "disabled" };
	}

	// Confirmed, still subscribed, not suppressed
	const subscribers = await getMailableSubscribersByJpa(jpa.id);

	const mails = subscribers.map((subscriber) => ({
		...renderResultsMail(jpa.name, jpa.websiteUrl, {
			manage: subscriber.manageToken,
			unsubscribe: subscriber.unsubscribeToken,
		}),
		to: subscriber.email,
	}));

	const total = await countEmailSubscriptionsByJpa(jpa.id);

	if (mails.length > 0) {
		void dispatch(jpa, mails, publishedAt);
	}

	return { status: "queued", mail: mails.length, total };
}
