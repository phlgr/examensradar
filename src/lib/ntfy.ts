interface NtfyAction {
	action: "view";
	label: string;
	url: string;
}

interface NtfyNotification {
	topic: string;
	title: string;
	message: string;
	click?: string;
	priority?: "min" | "low" | "default" | "high" | "max";
	actions?: NtfyAction[];
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
const MAX_ATTEMPTS = 3;
/** changebot's webhook timeout is 30s; stay well inside it so it never sees a timeout. */
const BATCH_BUDGET_MS = 20_000;
const MAX_BACKOFF_MS = 8_000;

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
): Promise<boolean> {
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const { ok, status, retryAfterMs } = await publish(notification, baseUrl);

			if (ok) return true;

			if (!RETRYABLE.has(status) || attempt === MAX_ATTEMPTS) {
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
	baseUrl = "https://ntfy.sh",
): Promise<{ sent: number; failed: number }> {
	const deadline = Date.now() + BATCH_BUDGET_MS;
	const queue = [...notifications];
	let sent = 0;

	const workers = Array.from(
		{ length: Math.min(CONCURRENCY, queue.length) },
		async () => {
			for (let next = queue.pop(); next; next = queue.pop()) {
				if (await sendWithRetry(next, baseUrl, deadline)) sent++;
			}
		},
	);

	await Promise.all(workers);

	return { sent, failed: notifications.length - sent };
}
