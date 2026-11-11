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

export const MAIL_CONCURRENCY = 5;

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
		maxConnections: MAIL_CONCURRENCY,
	});

	return cached;
}

function sender(): { name: string; address: string } {
	return {
		name: process.env.MAIL_FROM_NAME ?? "Examensradar",
		address: process.env.MAIL_FROM ?? "noreply@examensradar.de",
	};
}

function isRetryable(error: unknown): boolean {
	const code = (error as { responseCode?: number }).responseCode;
	if (typeof code === "number") return code >= 400 && code < 500;

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

export type SendResult =
	| { ok: true }
	| { ok: false; retryable: boolean; error: string };

export async function trySend(mail: Mail): Promise<SendResult> {
	try {
		await deliver(mail);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			retryable: isRetryable(error),
			error: describe(error),
		};
	}
}

export async function sendMail(mail: Mail): Promise<boolean> {
	const result = await trySend(mail);
	if (!result.ok) console.error(`mail to ${mail.to} failed: ${result.error}`);
	return result.ok;
}
