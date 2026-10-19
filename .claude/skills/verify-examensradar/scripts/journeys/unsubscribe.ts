import { Database } from "bun:sqlite";
import { dirname } from "node:path";
import { check, confirmedSubscriber, open } from "../pw.ts";

const v = await open("unsubscribe");
const { page } = v;
const { email, welcome } = confirmedSubscriber(v.runId);
const db = new Database(v.env.DB, { readonly: true });
const unsubscribedAt = () =>
	(db.query("select unsubscribed_at from subscriber where email = ?").get(email) as {
		unsubscribed_at: number | null;
	}).unsubscribed_at;

try {
	const unsubLink = welcome.links.find((link) => link.includes("/unsubscribe/"));
	check(unsubLink?.startsWith(v.base), "welcome mail carries a local unsubscribe link");

	const eml = await Bun.file(`${dirname(v.env.DB)}/mail/${welcome.n}.eml`).text();
	const oneClick = eml.replace(/\r?\n[ \t]+/g, " ").match(/^List-Unsubscribe: <([^>]+)>/m)?.[1];
	check(oneClick?.startsWith(`${v.base}/api/email/unsubscribe/`), "welcome mail has a one-click List-Unsubscribe header");
	const get = await fetch(oneClick as string);
	check(get.status === 405 && unsubscribedAt() === null, "GET on the one-click URL is 405 and unsubscribes nobody");

	await v.visit(unsubLink as string);
	await page.getByRole("heading", { name: "Abmelden" }).waitFor();
	await v.proof("page");
	await page.getByRole("button", { name: "Jetzt abmelden" }).click();
	await page.getByRole("heading", { name: "Abgemeldet." }).waitFor();
	await v.proof("done");
	check(unsubscribedAt(), "unsubscribe set unsubscribed_at");

	await v.note("result", { email, oneClick, getStatus: get.status, unsubscribedAt: unsubscribedAt() });
	console.log("PASS unsubscribe");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL unsubscribe:", error);
	process.exitCode = 1;
} finally {
	db.close();
	await v.close();
}
