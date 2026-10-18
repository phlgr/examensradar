import type { Mail } from "./mail";

export type MailContent = Omit<Mail, "to">;

/**
 * Palette mirrors src/styles.css ("Schönfelder & Textmarker"). Mail clients
 * are a lowest common denominator: no web fonts (Gmail drops them), so the
 * headline serif falls back to Georgia; no rgba or box-shadow, so borders are
 * solid tints of the paper; border-radius degrades to square in Outlook.
 */
const INK = "#17171a";
const PAPER = "#f4efe4";
const SHEET = "#fffdf8";
const SEAL = "#b3261e";
const MARK = "#ffe25a";
const LINE = "#e3ddd0";
const MUTED = "#6b6862";
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

const appUrl = () => process.env.APP_URL || "https://examensradar.de";

export interface MailTokens {
	manage: string;
	unsubscribe: string;
}

const manageUrl = (token: string) =>
	`${appUrl()}/subscriptions?manage=${token}`;
const confirmUrl = (token: string) => `${appUrl()}/confirm/${token}`;
const unsubscribeUrl = (token: string) => `${appUrl()}/unsubscribe/${token}`;
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
<td style="background:${INK};border-radius:6px">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${SHEET};text-decoration:none;border-radius:6px">${escapeHtml(label)}&nbsp;&rarr;</a>
</td></tr></table>`;
}

interface LayoutOptions {
	heading: string;
	body: string;
	cta?: { url: string; label: string };
	footer: string;
}

function layout({ heading, body, cta, footer }: LayoutOptions): string {
	return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:28px 16px;background:${PAPER}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER}"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-family:${SERIF};font-size:20px;line-height:1;color:${INK}">
<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${SEAL};margin-right:8px;vertical-align:1px"></span>Examensradar
</td></tr>
<tr><td>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SHEET};border:1px solid ${LINE};border-radius:8px"><tr>
<td style="padding:32px 28px;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK}">
<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:30px;line-height:1.15;font-weight:normal;letter-spacing:-.01em;color:${INK}">${escapeHtml(heading)}</h1>
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

const paragraph = (html: string) =>
	`<p style="margin:0 0 24px;color:#45433f">${html}</p>`;

const footerLink = (url: string, label: string) =>
	`<a href="${escapeHtml(url)}" style="color:${MUTED}">${escapeHtml(label)}</a>`;

function subscriberFooter(tokens: MailTokens): string {
	return `Du erhältst diese E-Mail, weil du dich auf examensradar.de für Benachrichtigungen dieses Prüfungsamts angemeldet hast.<br>
${footerLink(unsubscribeUrl(tokens.unsubscribe), "Abmelden")} &middot; ${footerLink(manageUrl(tokens.manage), "Abo verwalten")}`;
}

export function renderConfirmMail(token: string): MailContent {
	const url = confirmUrl(token);

	return {
		subject: "Bitte bestätige deine E-Mail-Adresse",
		text: `Nur noch ein Klick

Bestätige, dass wir dir E-Mails senden dürfen, sobald eines deiner gewählten
Prüfungsämter neue Examensergebnisse veröffentlicht. Welche Prüfungsämter du
beobachtest, siehst du nach der Bestätigung und kannst es jederzeit anpassen.

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
					"Bestätige, dass wir dir E-Mails senden dürfen, sobald eines deiner gewählten Prüfungsämter neue Examensergebnisse veröffentlicht. Welche Prüfungsämter du beobachtest, siehst du nach der Bestätigung und kannst es jederzeit anpassen.",
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

export function renderWelcomeMail(tokens: MailTokens): MailContent {
	return {
		subject: "Alles bereit — wir halten dich auf dem Laufenden",
		text: `Alles bereit

Wir benachrichtigen dich, sobald eines deiner Prüfungsämter neue
Examensergebnisse veröffentlicht. Welche das sind, siehst und änderst du
über den Link unten.

Abo verwalten: ${manageUrl(tokens.manage)}

--
Bewahre diese E-Mail auf: über den Link oben kannst du dein Abo jederzeit
verwalten oder beenden.

Abmelden: ${unsubscribeUrl(tokens.unsubscribe)}
`,
		html: layout({
			heading: "Alles bereit",
			body: paragraph(
				"Wir benachrichtigen dich, sobald eines deiner Prüfungsämter neue Examensergebnisse veröffentlicht. Welche das sind, siehst und änderst du über den Link unten.",
			),
			cta: { url: manageUrl(tokens.manage), label: "Abo verwalten" },
			footer: `Bewahre diese E-Mail auf — über den Link kannst du dein Abo jederzeit verwalten oder beenden.<br>
${footerLink(unsubscribeUrl(tokens.unsubscribe), "Abmelden")}`,
		}),
		unsubscribeUrl: unsubscribePostUrl(tokens.unsubscribe),
	};
}

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
				// The highlighter from the site, as a flat background: gradients
				// don't survive most mail clients.
				`Das <strong style="background:${MARK};color:${INK};padding:0 3px">${escapeHtml(jpaName)}</strong> hat neue Examensergebnisse veröffentlicht.`,
			),
			cta: jpaWebsiteUrl
				? { url: jpaWebsiteUrl, label: "Ergebnisse ansehen" }
				: undefined,
			footer: subscriberFooter(tokens),
		}),
		unsubscribeUrl: unsubscribePostUrl(tokens.unsubscribe),
	};
}

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
