import type { Mail } from "./mail";

/** A rendered mail, less the recipient. */
export type MailContent = Omit<Mail, "to">;

/**
 * Palette mirrors src/styles.css. Deliberately no hard shadow: box-shadow is
 * unreliable across mail clients and faking --nb-shadow with an offset parent
 * cell renders badly in Gmail, so the 4px black borders carry the look alone.
 */
const BLACK = "#000000";
const CREAM = "#fffef0";
const WHITE = "#ffffff";
const YELLOW = "#ffd93d";
const MUTED = "#444444";
const BORDER = "4px";
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

const appUrl = () => process.env.APP_URL || "https://examensradar.de";

/**
 * The two credentials a subscriber mail can carry. They are separate because
 * the unsubscribe URL is handed to Gmail via List-Unsubscribe and therefore
 * published, while the manage token must not be.
 */
export interface MailTokens {
	manage: string;
	unsubscribe: string;
}

// Route paths stay English like the rest of the app; only the copy is German.
/**
 * The manage entry point. The page exchanges the query param for an httpOnly
 * cookie and scrubs it from the URL, mirroring the ntfy `?restore=` pattern.
 */
const manageUrl = (token: string) =>
	`${appUrl()}/subscriptions?manage=${token}`;
const confirmUrl = (token: string) => `${appUrl()}/confirm/${token}`;
/** The page a human lands on from the footer link. */
const unsubscribeUrl = (token: string) => `${appUrl()}/unsubscribe/${token}`;
/**
 * POST-only, machine-facing. This is what Gmail one-clicks, so it renders
 * nothing and can do nothing but unsubscribe.
 */
const unsubscribePostUrl = (token: string) =>
	`${appUrl()}/api/email/unsubscribe/${token}`;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function button(url: string, label: string): string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:${YELLOW};border:${BORDER} solid ${BLACK}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:800;line-height:1;color:${BLACK};text-decoration:none;text-transform:uppercase;letter-spacing:.02em">${escapeHtml(label)}</a>
</td></tr></table>`;
}

interface LayoutOptions {
	heading: string;
	/** Already-escaped HTML for the body paragraphs. */
	body: string;
	cta?: { url: string; label: string };
	/** Already-escaped HTML for the small print under the card. */
	footer: string;
}

function layout({ heading, body, cta, footer }: LayoutOptions): string {
	return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:28px 16px;background:${CREAM}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px">
<tr><td>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WHITE};border:${BORDER} solid ${BLACK}"><tr>
<td style="padding:32px 28px;font-family:${FONT};font-size:16px;line-height:1.5;color:${BLACK}">
<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">Examensradar</p>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.1;font-weight:900;text-transform:uppercase">${escapeHtml(heading)}</h1>
${body}
${cta ? button(cta.url, cta.label) : ""}
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED}">
${footer}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const paragraph = (html: string) => `<p style="margin:0 0 26px">${html}</p>`;

const footerLink = (url: string, label: string) =>
	`<a href="${escapeHtml(url)}" style="color:${MUTED}">${escapeHtml(label)}</a>`;

/** Small print carried by every mail sent to a confirmed subscriber. */
function subscriberFooter(tokens: MailTokens): string {
	return `Du erhältst diese E-Mail, weil du dich auf examensradar.de für Benachrichtigungen dieses Prüfungsamts angemeldet hast.<br>
${footerLink(unsubscribeUrl(tokens.unsubscribe), "Abmelden")} &middot; ${footerLink(manageUrl(tokens.manage), "Abo verwalten")}`;
}

/**
 * Double opt-in. Nothing is sent to an address until this link is clicked.
 * The "eine Stunde" urgency copy must match CONFIRM_TTL_MS in src/db/index.ts.
 */
export function renderConfirmMail(jpaName: string, token: string): MailContent {
	const url = confirmUrl(token);

	return {
		subject: "Bitte bestätige deine E-Mail-Adresse",
		text: `Nur noch ein Klick

Bestätige deine E-Mail-Adresse, damit wir dich benachrichtigen können, sobald das ${jpaName} neue Examensergebnisse veröffentlicht.

E-Mail bestätigen: ${url}

Der Link ist aus Sicherheitsgründen nur eine Stunde gültig — bestätige am
besten gleich jetzt.

--
Link abgelaufen? Melde dich einfach neu an, dann bekommst du sofort einen
frischen. Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach —
ohne Bestätigung senden wir dir nichts.
`,
		html: layout({
			heading: "Nur noch ein Klick",
			body:
				paragraph(
					`Bestätige deine E-Mail-Adresse, damit wir dich benachrichtigen können, sobald das <strong>${escapeHtml(jpaName)}</strong> neue Examensergebnisse veröffentlicht.`,
				) +
				paragraph(
					"Der Link ist aus Sicherheitsgründen nur <strong>eine Stunde</strong> gültig — bestätige am besten gleich jetzt.",
				),
			cta: { url, label: "E-Mail bestätigen" },
			footer:
				"Link abgelaufen? Melde dich einfach neu an, dann bekommst du sofort einen frischen. Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach — ohne Bestätigung senden wir dir nichts.",
		}),
	};
}

/** Sent once double opt-in completes. Its real job is delivering the manage link. */
export function renderWelcomeMail(
	jpaName: string,
	tokens: MailTokens,
): MailContent {
	return {
		subject: "Alles bereit — wir halten dich auf dem Laufenden",
		text: `Alles bereit

Wir benachrichtigen dich, sobald das ${jpaName} neue Examensergebnisse veröffentlicht.

Abo verwalten: ${manageUrl(tokens.manage)}

--
Bewahre diese E-Mail auf: über den Link oben kannst du dein Abo jederzeit
verwalten oder beenden.

Abmelden: ${unsubscribeUrl(tokens.unsubscribe)}
`,
		html: layout({
			heading: "Alles bereit",
			body: paragraph(
				`Wir benachrichtigen dich, sobald das <strong>${escapeHtml(jpaName)}</strong> neue Examensergebnisse veröffentlicht.`,
			),
			cta: { url: manageUrl(tokens.manage), label: "Abo verwalten" },
			footer: `Bewahre diese E-Mail auf — über den Link kannst du dein Abo jederzeit verwalten oder beenden.<br>
${footerLink(unsubscribeUrl(tokens.unsubscribe), "Abmelden")}`,
		}),
		unsubscribeUrl: unsubscribePostUrl(tokens.unsubscribe),
	};
}

/** The one that matters: a JPA just published. */
export function renderResultsMail(
	jpaName: string,
	jpaWebsiteUrl: string | null,
	tokens: MailTokens,
): MailContent {
	const body = `Das ${jpaName} hat neue Examensergebnisse veröffentlicht.`;

	return {
		subject: `Neue Ergebnisse: ${jpaName}`,
		text: `Neue Ergebnisse verfügbar

${body}
${jpaWebsiteUrl ? `\nErgebnisse ansehen: ${jpaWebsiteUrl}\n` : ""}
--
Du erhältst diese E-Mail, weil du dich auf examensradar.de für
Benachrichtigungen dieses Prüfungsamts angemeldet hast.

Abmelden: ${unsubscribeUrl(tokens.unsubscribe)}
Abo verwalten: ${manageUrl(tokens.manage)}
`,
		html: layout({
			heading: "Neue Ergebnisse verfügbar",
			body: paragraph(
				`Das <strong>${escapeHtml(jpaName)}</strong> hat neue Examensergebnisse veröffentlicht.`,
			),
			cta: jpaWebsiteUrl
				? { url: jpaWebsiteUrl, label: "Ergebnisse ansehen" }
				: undefined,
			footer: subscriberFooter(tokens),
		}),
		unsubscribeUrl: unsubscribePostUrl(tokens.unsubscribe),
	};
}

/** Re-sends the manage link to an address that already confirmed. */
export function renderManageLinkMail(tokens: MailTokens): MailContent {
	return {
		subject: "Dein Link zur Abo-Verwaltung",
		text: `Dein Abo verwalten

Über diesen Link kannst du deine Benachrichtigungen ändern oder beenden.

Abo verwalten: ${manageUrl(tokens.manage)}

--
Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach.

Abmelden: ${unsubscribeUrl(tokens.unsubscribe)}
`,
		html: layout({
			heading: "Dein Abo verwalten",
			body: paragraph(
				"Über diesen Link kannst du deine Benachrichtigungen ändern oder beenden.",
			),
			cta: { url: manageUrl(tokens.manage), label: "Abo verwalten" },
			footer: `Du hast das nicht angefordert? Dann ignoriere diese E-Mail einfach.<br>
${footerLink(unsubscribeUrl(tokens.unsubscribe), "Abmelden")}`,
		}),
		unsubscribeUrl: unsubscribePostUrl(tokens.unsubscribe),
	};
}
