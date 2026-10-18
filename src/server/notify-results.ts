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

const DISPATCH_BUDGET_MS = 5 * 60_000;

async function dispatch(
	jpa: { id: string; slug: string },
	mails: Mail[],
	publishedAt: Date,
): Promise<void> {
	try {
		const mail = await sendBatchMails(mails, { budgetMs: DISPATCH_BUDGET_MS });

		await logNotification(jpa.id, mail.sent, publishedAt);

		console.log(`[notify] ${jpa.slug}: mail ${mail.sent}/${mails.length}`);

		if (mail.failed > 0) {
			console.error(
				`[notify] ${jpa.slug}: ${mail.failed} mail notifications FAILED after retries`,
			);
		}
	} catch (error) {
		console.error(`[notify] ${jpa.slug}: dispatch crashed`, error);
	}
}

export async function queueResultsNotifications(
	jpa: ResultsJpa,
	publishedAt: Date = new Date(),
): Promise<NotifyOutcome> {
	if (jpa.notificationsDisabled) {
		return { status: "disabled" };
	}

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
