// Journey: welcome-mail manage link → add/remove an office → sign out → resend.
// See features/manage-subscriptions.md. Needs subscribe-confirm first.
// Usage: bun manage-subscriptions.ts <run-id>
import { Database } from "bun:sqlite";
import { check, mails, open, waitForMail } from "../pw.ts";

const v = await open("manage-subscriptions");
const { page } = v;
const email = `verify+${v.runId}@example.test`;
const db = new Database(v.env.DB, { readonly: true });
const jpaIds = () =>
	(
		db
			.query(
				`select es.jpa_id from email_subscription es join subscriber s on s.id = es.subscriber_id
				 where s.email = ? order by es.jpa_id`,
			)
			.all(email) as { jpa_id: string }[]
	).map((row) => row.jpa_id);
const koeln = () => v.card("JPA bei dem OLG Köln");

try {
	const welcome = await waitForMail(v.runId, email, /Alles bereit/, 1_000);
	const manageLink = welcome.links.find((link) => link.includes("manage="));
	check(manageLink?.startsWith(v.base), "welcome mail carries a local manage link");

	await v.visit(manageLink as string);
	await page.getByText("Angemeldet als").waitFor();
	await v.proof("signed-in");
	check(!page.url().includes("manage="), "manage token left the URL");
	const cookie = await v.cookie("examensradar_manage");
	check(
		cookie?.httpOnly && cookie.sameSite === "Lax" && cookie.path === "/",
		"manage cookie is HttpOnly, SameSite=Lax, Path=/",
	);

	const before = jpaIds();
	await koeln().getByRole("button", { name: "Abonnieren" }).click();
	await koeln().getByText("Aktiv").waitFor();
	await v.proof("added");
	const added = jpaIds();
	check(added.includes("jpa-olg-koeln"), "add wrote an email_subscription row for Köln");

	await koeln().getByRole("button", { name: "Abbestellen" }).click();
	await koeln().getByRole("button", { name: "Abonnieren" }).waitFor();
	await v.proof("removed");
	const removed = jpaIds();
	check(
		JSON.stringify(removed) === JSON.stringify(before),
		"remove restored the subscriptions from before the add",
	);

	await page.getByRole("button", { name: "Ausloggen" }).click();
	await page.getByRole("button", { name: "Link zuschicken" }).waitFor();
	await v.proof("signed-out");
	check(!(await v.cookie("examensradar_manage"))?.value, "sign out cleared the manage cookie");

	const mailCount = mails(v.runId).length;
	await page.getByLabel("E-Mail-Adresse").last().fill(email);
	await page.getByRole("button", { name: "Link zuschicken" }).click();
	const resent = await waitForMail(v.runId, email, /Abo-Verwaltung/);
	await v.proof("resent");
	check(mails(v.runId).length === mailCount + 1, "resend mailed exactly one manage link");

	await v.note("result", { email, cookie, before, added, removed, resent });
	console.log("PASS manage-subscriptions");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL manage-subscriptions:", error);
	process.exitCode = 1;
} finally {
	db.close();
	await v.close();
}
