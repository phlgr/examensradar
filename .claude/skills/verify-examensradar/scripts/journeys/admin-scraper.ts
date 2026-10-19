// Journey: admin login → "Jetzt prüfen" unchanged → fixture change → notify
// once → logout. See features/admin-scraper.md. Needs subscribe-confirm first,
// so exactly one confirmed subscriber sits on the test JPA.
// Usage: bun admin-scraper.ts <run-id>
import { Database } from "bun:sqlite";
import { check, mails, open, waitForMail } from "../pw.ts";

const v = await open("admin-scraper");
const { page } = v;
const email = `verify+${v.runId}@example.test`;
const db = new Database(v.env.DB, { readonly: true });
const notificationLog = () =>
	db
		.query("select subscriber_count from notification_log where jpa_id = 'jpa-verify-test'")
		.all() as { subscriber_count: number }[];
const testJpa = () => v.card("JPA Verifikation (Test)");
const checkNow = () => testJpa().getByRole("button", { name: "Jetzt prüfen" }).click();

try {
	await v.visit(`${v.base}/admin/login`);
	await page.getByLabel("Passwort").fill("wrong-password");
	await page.getByRole("button", { name: "Anmelden" }).click();
	await page.getByText("Falsches Passwort").waitFor();
	await v.proof("wrong-password");
	check(!(await v.cookie("admin_session")), "wrong password sets no session cookie");

	await page.getByLabel("Passwort").fill(v.env.ADMIN_PASSWORD);
	await page.getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/admin$/);
	await page.getByRole("heading", { name: "JPA Verifikation (Test)" }).waitFor();
	await v.proof("dashboard");
	const cookie = await v.cookie("admin_session");
	check(
		cookie?.httpOnly && cookie.sameSite === "Lax" && cookie.expires > Date.now() / 1000 + 6 * 86_400,
		"admin cookie is HttpOnly, SameSite=Lax, ~7 day expiry",
	);

	await checkNow();
	await testJpa().getByText("Keine Änderung.").waitFor();
	await v.proof("unchanged");

	const mailCount = mails(v.runId).length;
	const logBefore = notificationLog().length;
	await Bun.$`${import.meta.dir}/../verify.sh fixture ${v.runId} ${"<p>Ergebnisse Termin 2026/II online</p>"}`.quiet();
	await checkNow();
	await testJpa().getByText("Änderung erkannt — 1 Mails in Zustellung.").waitFor();
	await v.proof("changed");
	const resultsMail = await waitForMail(v.runId, email, /Neue Ergebnisse: JPA Verifikation/);
	await Bun.sleep(1_000);
	const log = notificationLog();
	check(
		log.length === logBefore + 1 && log.at(-1)?.subscriber_count === 1,
		"change logged once in notification_log with subscriber_count 1",
	);
	check(mails(v.runId).length === mailCount + 1, "exactly one results mail went out");

	await checkNow();
	await testJpa().getByText("Keine Änderung.").waitFor();
	await v.proof("checked-again");
	await Bun.sleep(1_000);
	check(mails(v.runId).length === mailCount + 1, "second check on the same content sent no mail");

	await page.getByRole("button", { name: "Abmelden" }).click();
	await page.waitForURL(/\/admin\/login$/);
	await v.proof("logged-out");
	check(!(await v.cookie("admin_session"))?.value, "logout cleared the admin cookie");
	await v.visit(`${v.base}/admin`);
	await page.waitForURL(/\/admin\/login$/);
	check(true, "/admin redirects to login after logout");

	await v.note("result", { email, cookie, resultsMail, notificationLog: log });
	console.log("PASS admin-scraper");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL admin-scraper:", error);
	process.exitCode = 1;
} finally {
	db.close();
	await v.close();
}
