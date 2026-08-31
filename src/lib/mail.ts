import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
	to: string;
	subject: string;
	text: string;
	html: string;
	/**
	 * RFC 8058 one-click unsubscribe. Set on anything sent to a list; Gmail and
	 * GMX both weigh its presence, and it keeps people from reaching for the
	 * spam button when they want out.
	 */
	unsubscribeUrl?: string;
}

export interface BatchOptions {
	/** Wall-clock ceiling for the whole batch, including backoff waits. */
	budgetMs?: number;
	maxAttempts?: number;
}

/**
 * Parallel sends in flight. Scaleway TEM accepts a handful of concurrent SMTP
 * connections; nodemailer pools them, so this only bounds how many messages are
 * queued against the pool at once.
 */
const CONCURRENCY = 5;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BUDGET_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let cached: Transporter | null = null;

function transport(): Transporter {
	if (cached) return cached;

	const host = process.env.SMTP_HOST;
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!host || !user || !pass) {
		throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS must be configured");
	}

	const port = Number(process.env.SMTP_PORT ?? 465);

	cached = nodemailer.createTransport({
		host,
		port,
		// 465 and 2465 are implicit TLS; 587 and 2587 upgrade via STARTTLS.
		secure: port === 465 || port === 2465,
		auth: { user, pass },
		pool: true,
		maxConnections: CONCURRENCY,
	});

	return cached;
}

function sender(): { name: string; address: string } {
	return {
		name: process.env.MAIL_FROM_NAME ?? "Examensradar",
		address: process.env.MAIL_FROM ?? "noreply@examensradar.de",
	};
}

/**
 * A 4xx SMTP reply means "try later" — the message is still deliverable. A 5xx
 * is a permanent refusal, so retrying only burns reputation.
 */
function isRetryable(error: unknown): boolean {
	const code = (error as { responseCode?: number }).responseCode;
	if (typeof code === "number") return code >= 400 && code < 500;

	// Connection-level failures carry no SMTP code but are worth another go.
	const errno = (error as { code?: string }).code;
	return (
		errno === "ETIMEDOUT" || errno === "ECONNECTION" || errno === "ESOCKET"
	);
}

function describe(error: unknown): string {
	const { responseCode, response } = error as {
		responseCode?: number;
		response?: string;
	};

	if (response) return `${responseCode ?? "?"} ${response}`;

	return error instanceof Error ? error.message : String(error);
}

async function deliver(mail: Mail): Promise<void> {
	await transport().sendMail({
		from: sender(),
		to: mail.to,
		subject: mail.subject,
		text: mail.text,
		html: mail.html,
		headers: mail.unsubscribeUrl
			? {
					"List-Unsubscribe": `<${mail.unsubscribeUrl}>`,
					"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
				}
			: undefined,
	});
}

export async function sendMail(mail: Mail): Promise<boolean> {
	try {
		await deliver(mail);
		return true;
	} catch (error) {
		console.error(`mail to ${mail.to} failed: ${describe(error)}`);
		return false;
	}
}

async function sendWithRetry(
	mail: Mail,
	deadline: number,
	maxAttempts: number,
): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await deliver(mail);
			return true;
		} catch (error) {
			if (!isRetryable(error) || attempt === maxAttempts) {
				console.error(
					`mail to ${mail.to} failed after ${attempt} attempt(s): ${describe(error)}`,
				);
				return false;
			}

			const backoff = Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);

			if (Date.now() + backoff > deadline) {
				console.error(
					`mail to ${mail.to} gave up, no time left in batch budget: ${describe(error)}`,
				);
				return false;
			}

			await sleep(backoff);
		}
	}

	return false;
}

export async function sendBatchMails(
	mails: Mail[],
	options: BatchOptions = {},
): Promise<{ sent: number; failed: number }> {
	const { budgetMs = DEFAULT_BUDGET_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } =
		options;

	const deadline = Date.now() + budgetMs;
	const queue = [...mails];
	let sent = 0;

	const workers = Array.from(
		{ length: Math.min(CONCURRENCY, queue.length) },
		async () => {
			for (let next = queue.pop(); next; next = queue.pop()) {
				if (await sendWithRetry(next, deadline, maxAttempts)) sent++;
			}
		},
	);

	await Promise.all(workers);

	return { sent, failed: mails.length - sent };
}
