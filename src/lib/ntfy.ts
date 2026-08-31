interface NtfyAction {
	action: "view";
	label: string;
	url: string;
}

export interface NtfyNotification {
	topic: string;
	title: string;
	message: string;
	click?: string;
	priority?: "min" | "low" | "default" | "high" | "max";
	actions?: NtfyAction[];
}

export interface BatchOptions {
	baseUrl?: string;
	/** Wall-clock ceiling for the whole batch, including backoff waits. */
	budgetMs?: number;
	maxAttempts?: number;
}

interface PublishResult {
	ok: boolean;
	status: number;
	retryAfterMs: number | null;
}

/** Statuses worth another attempt — ntfy.sh returns 429 when the per-IP burst is spent. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
/** Parallel publishes in flight. Keeps a large fan-out from arriving as one spike. */
const CONCURRENCY = 8;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BUDGET_MS = 20_000;
/**
 * ntfy.sh replenishes its per-IP burst at roughly one token per 5s, so a large
 * overshoot needs to be waited out rather than hammered. Cap any single wait so
 * one hostile Retry-After can't consume the whole budget.
 */
const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function publish(
	notification: NtfyNotification,
	baseUrl: string,
): Promise<PublishResult> {
	const headers: Record<string, string> = {
		Title: notification.title,
		Priority: notification.priority || "high",
	};

	if (notification.click) {
		headers.Click = notification.click;
	}

	if (notification.actions?.length) {
		headers.Actions = notification.actions
			.map((a) => `${a.action}, ${a.label}, ${a.url}`)
			.join("; ");
	}

	const response = await fetch(`${baseUrl}/${notification.topic}`, {
		method: "POST",
		headers,
		body: notification.message,
	});

	const retryAfter = Number(response.headers.get("Retry-After"));

	return {
		ok: response.ok,
		status: response.status,
		retryAfterMs:
			Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
	};
}

export async function sendNtfyNotification(
	notification: NtfyNotification,
	baseUrl = "https://ntfy.sh",
): Promise<boolean> {
	try {
		const { ok, status } = await publish(notification, baseUrl);

		if (!ok) {
			console.error(
				`ntfy publish to ${notification.topic} failed with HTTP ${status}`,
			);
		}

		return ok;
	} catch (error) {
		console.error("Failed to send ntfy notification:", error);
		return false;
	}
}

async function sendWithRetry(
	notification: NtfyNotification,
	baseUrl: string,
	deadline: number,
	maxAttempts: number,
): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const { ok, status, retryAfterMs } = await publish(notification, baseUrl);

			if (ok) return true;

			if (!RETRYABLE.has(status) || attempt === maxAttempts) {
				console.error(
					`ntfy publish to ${notification.topic} failed with HTTP ${status} after ${attempt} attempt(s)`,
				);
				return false;
			}

			const backoff = Math.min(
				retryAfterMs ?? 1000 * 2 ** (attempt - 1),
				MAX_BACKOFF_MS,
			);

			if (Date.now() + backoff > deadline) {
				console.error(
					`ntfy publish to ${notification.topic} gave up: HTTP ${status}, no time left in batch budget`,
				);
				return false;
			}

			await sleep(backoff);
		} catch (error) {
			console.error("Failed to send ntfy notification:", error);
			return false;
		}
	}

	return false;
}

export async function sendBatchNotifications(
	notifications: NtfyNotification[],
	options: BatchOptions = {},
): Promise<{ sent: number; failed: number }> {
	const {
		baseUrl = "https://ntfy.sh",
		budgetMs = DEFAULT_BUDGET_MS,
		maxAttempts = DEFAULT_MAX_ATTEMPTS,
	} = options;

	const deadline = Date.now() + budgetMs;
	const queue = [...notifications];
	let sent = 0;

	const workers = Array.from(
		{ length: Math.min(CONCURRENCY, queue.length) },
		async () => {
			for (let next = queue.pop(); next; next = queue.pop()) {
				if (await sendWithRetry(next, baseUrl, deadline, maxAttempts)) sent++;
			}
		},
	);

	await Promise.all(workers);

	return { sent, failed: notifications.length - sent };
}
