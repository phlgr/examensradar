// Journey: landing-page signup → confirm mail → /confirm → welcome mail.
// See features/subscribe-confirm.md. Usage: bun subscribe-confirm.ts <run-id>
import { Database } from "bun:sqlite";
import { open, waitForMail } from "../pw.ts";

const v = await open("subscribe-confirm");
const { page } = v;
const email = `verify+${v.runId}@example.test`;
const db = new Database(v.env.DB, { readonly: true });
const subscriberRow = () =>
	db
		.query(
			`select s.email, s.confirmed_at, group_concat(es.jpa_id) jpas from subscriber s
			 left join email_subscription es on es.subscriber_id = s.id where s.email = ? group by s.id`,
		)
		.get(email) as { email: string; confirmed_at: number | null; jpas: string } | null;

try {
	await v.visit(v.base);
	const select = page.getByLabel("Dein Justizprüfungsamt");
	await select.selectOption({ label: "JPA Verifikation (Test)" });
	await page.getByLabel("E-Mail-Adresse").fill(email);
	await v.proof("form-filled");

	await page.getByRole("button", { name: "Benachrichtigen lassen" }).click();
	await page.getByRole("status").getByText("Fast geschafft.").waitFor();
	await v.proof("signup-sent");

	const pending = subscriberRow();
	if (!pending || pending.confirmed_at !== null || pending.jpas !== "jpa-verify-test")
		throw new Error(`expected pending subscriber on test JPA, got ${JSON.stringify(pending)}`);

	const confirmMail = await waitForMail(v.runId, email, /bestätige deine E-Mail/);
	const confirmLink = confirmMail.links.find((link) => link.includes("/confirm/"));
	if (!confirmLink?.startsWith(v.base)) throw new Error(`confirm link not local: ${confirmLink}`);

	await v.visit(confirmLink);
	await page.getByRole("heading", { name: "Anmeldung bestätigen" }).waitFor();
	await v.proof("confirm-page");
	await page.getByRole("button", { name: "Jetzt bestätigen" }).click();
	await page.getByRole("heading", { name: "E-Mail bestätigt." }).waitFor();
	await v.proof("confirmed");

	const confirmed = subscriberRow();
	if (!confirmed?.confirmed_at) throw new Error("subscriber not confirmed in DB");
	const welcome = await waitForMail(v.runId, email, /Alles bereit/);

	await v.note("result", { email, pending, confirmed, confirmMail, welcome });
	console.log("PASS subscribe-confirm");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL subscribe-confirm:", error);
	process.exitCode = 1;
} finally {
	db.close();
	await v.close();
}
