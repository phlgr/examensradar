/**
 * Renders every mail template to dist/mail-preview/ so copy and layout can be
 * reviewed without sending anything, and optionally sends one for real.
 *
 *   bun run mail:preview
 *   bun run mail:preview -- --send=you@example.com
 *   bun run mail:preview -- --template=confirm --send=a@gmx.de,b@web.de
 *
 * Sending needs SMTP_HOST / SMTP_USER / SMTP_PASS in the environment. Use it to
 * check the German providers before trusting a real results drop — t-online.de
 * in particular refuses mail from sender IPs it does not recognise.
 */
import { sendBatchMails, sendMail } from "@/lib/mail";
import {
	type MailContent,
	renderConfirmMail,
	renderManageLinkMail,
	renderResultsMail,
	renderWelcomeMail,
} from "@/lib/mail-templates";

const JPA_NAME = "Justizprüfungsamt Hamm";
const JPA_URL = "https://www.olg-hamm.nrw.de/";
const CONFIRM_TOKEN = "VORSCHAU-CONFIRM-TOKEN-123";
// Distinct on purpose, so a preview shows that the published unsubscribe link
// never carries the manage credential.
const TOKENS = {
	manage: "VORSCHAU-MANAGE-TOKEN-123",
	unsubscribe: "VORSCHAU-UNSUBSCRIBE-TOKEN-123",
};

const templates: Record<string, () => MailContent> = {
	confirm: () => renderConfirmMail(CONFIRM_TOKEN),
	welcome: () => renderWelcomeMail(TOKENS),
	results: () => renderResultsMail(JPA_NAME, JPA_URL, TOKENS),
	manage: () => renderManageLinkMail(TOKENS),
};

function arg(name: string): string | undefined {
	const match = process.argv.find((value) => value.startsWith(`--${name}=`));
	return match?.slice(name.length + 3);
}

const outDir = "dist/mail-preview";

for (const [name, render] of Object.entries(templates)) {
	const mail = render();
	await Bun.write(`${outDir}/${name}.html`, mail.html);
	await Bun.write(`${outDir}/${name}.txt`, `${mail.subject}\n\n${mail.text}`);
	console.log(`${outDir}/${name}.html  —  ${mail.subject}`);
}

const send = arg("send");
if (!send) {
	console.log("\nNothing sent. Pass --send=address[,address] to send one.");
	process.exit(0);
}

const name = arg("template") ?? "results";
const render = templates[name];

if (!render) {
	console.error(
		`unknown template "${name}" — pick one of: ${Object.keys(templates).join(", ")}`,
	);
	process.exit(1);
}

const recipients = send
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);
const content = render();

console.log(`\nSending "${name}" to ${recipients.join(", ")} ...`);

if (recipients.length === 1) {
	const ok = await sendMail({ ...content, to: recipients[0] as string });
	console.log(ok ? "sent" : "FAILED — see the error above");
	process.exit(ok ? 0 : 1);
}

const { sent, failed } = await sendBatchMails(
	recipients.map((to) => ({ ...content, to })),
);

console.log(`sent ${sent}, failed ${failed}`);
process.exit(failed > 0 ? 1 : 0);
