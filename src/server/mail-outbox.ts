import {
	getNextMailAttemptAt,
	leaseDueMails,
	type MailOutcome,
	settleMail,
} from "@/db";
import { MAIL_CONCURRENCY, trySend } from "@/lib/mail";
import { renderResultsMail } from "@/lib/mail-templates";

const BATCH_SIZE = 50;
const LEASE_MS = 5 * 60_000;

/** Delay after the Nth failed attempt; once it runs out the mail is failed. */
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];

type DueMail = Awaited<ReturnType<typeof leaseDueMails>>[number];
type Clock = () => Date;

async function attempt(row: DueMail, now: Clock): Promise<MailOutcome> {
	if (!row.active || row.jpaName === null) return { kind: "skipped" };

	const result = await trySend({
		...renderResultsMail(row.jpaName, row.websiteUrl, {
			manage: row.manageToken,
			unsubscribe: row.unsubscribeToken,
		}),
		to: row.email,
	});
	if (result.ok) return { kind: "sent" };

	const delay = RETRY_DELAYS_MS[row.attempts];
	if (!result.retryable || delay === undefined) {
		console.error(`[outbox] mail to ${row.email} FAILED: ${result.error}`);
		return { kind: "failed", error: result.error };
	}
	return {
		kind: "retry",
		at: new Date(now().getTime() + delay),
		error: result.error,
	};
}

async function deliverAll(
	rows: DueMail[],
	now: Clock,
	tally: Record<MailOutcome["kind"], number>,
): Promise<void> {
	const queue = [...rows];
	const workers = Array.from(
		{ length: Math.min(MAIL_CONCURRENCY, queue.length) },
		async () => {
			for (let row = queue.shift(); row; row = queue.shift()) {
				const outcome = await attempt(row, now);
				await settleMail(row.id, outcome);
				tally[outcome.kind]++;
			}
		},
	);
	await Promise.all(workers);
}

let wakeTimer: ReturnType<typeof setTimeout> | undefined;

async function scheduleWake(now: Clock): Promise<void> {
	clearTimeout(wakeTimer);
	wakeTimer = undefined;

	const next = await getNextMailAttemptAt();
	if (!next) return;

	wakeTimer = setTimeout(
		kickMailOutbox,
		Math.max(0, next.getTime() - now().getTime()),
	);
	wakeTimer.unref?.();
}

async function drainOnce(now: Clock): Promise<void> {
	const tally = { sent: 0, skipped: 0, retry: 0, failed: 0 };

	for (
		let rows = await leaseDueMails(now(), BATCH_SIZE, LEASE_MS);
		rows.length > 0;
		rows = await leaseDueMails(now(), BATCH_SIZE, LEASE_MS)
	) {
		await deliverAll(rows, now, tally);
	}

	if (tally.sent + tally.skipped + tally.retry + tally.failed > 0) {
		console.log(
			`[outbox] sent ${tally.sent}, retrying ${tally.retry}, failed ${tally.failed}, skipped ${tally.skipped}`,
		);
	}
	await scheduleWake(now);
}

let running: Promise<void> | null = null;
let runAgain = false;

/**
 * Single-flight per process: a call during a drain only asks for one more
 * pass and shares the running promise, so rows queued mid-drain are not missed.
 */
export function drainMailOutbox(now: Clock = () => new Date()): Promise<void> {
	if (running) {
		runAgain = true;
		return running;
	}

	running = (async () => {
		try {
			do {
				runAgain = false;
				await drainOnce(now);
			} while (runAgain);
		} finally {
			running = null;
		}
	})();
	return running;
}

export function kickMailOutbox(): void {
	drainMailOutbox().catch((error) => {
		console.error("[outbox] drain crashed", error);
	});
}
