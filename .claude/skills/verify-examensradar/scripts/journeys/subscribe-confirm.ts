// Journey: landing-page signup → confirm mail → /confirm → welcome mail.
// See features/subscribe-confirm.md. Usage: bun subscribe-confirm.ts <run-id>
import { Database } from "bun:sqlite";
import { check, open, waitForMail } from "../pw.ts";

const SHARE_URL = "https://examensradar.de/?utm_source=share&utm_medium=invite";

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

	await page.setViewportSize({ width: 390, height: 1000 });
	await page.getByText("Wartet deine Lerngruppe mit?").waitFor();
	await v.proof("invite-mobile");
	await page.evaluate(() => {
		const w = window as unknown as { __events: unknown[]; __shared: unknown[] };
		w.__events = [];
		w.__shared = [];
		window.plausible = (event, options) => {
			w.__events.push({ event, options });
		};
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: async (data: unknown) => {
				w.__shared.push(data);
			},
		});
	});
	await page.getByRole("button", { name: "Weiterschicken" }).click();
	const shared = await page.evaluate(() => (window as unknown as { __shared: Array<{ url: string; text: string }> }).__shared);
	check(shared.length === 1 && shared[0].url === SHARE_URL, `share sheet gets ${SHARE_URL}`);
	check(shared[0].text.includes("Examensradar"), "share sheet gets the invite text");

	const shareRejects = (name: string | null) =>
		page.evaluate((name) => {
			Object.defineProperty(navigator, "share", {
				configurable: true,
				value: name === null ? undefined : async () => Promise.reject(new DOMException("stub", name)),
			});
		}, name);
	await v.context.route("https://wa.me/**", (route) => route.fulfill({ body: "wa.me stub" }));
	const clickExpectingWhatsApp = async (label: string) => {
		const [popup] = await Promise.all([
			v.context.waitForEvent("page"),
			page.getByRole("button", { name: "Weiterschicken" }).click(),
		]);
		const text = new URL(popup.url()).searchParams.get("text") ?? "";
		check(popup.url().startsWith("https://wa.me/?text=") && text.endsWith(` ${SHARE_URL}`), label);
		await popup.close();
		return text;
	};

	await shareRejects("AbortError");
	let popups = 0;
	const countPopup = () => popups++;
	v.context.on("page", countPopup);
	await page.getByRole("button", { name: "Weiterschicken" }).click();
	await page.waitForTimeout(500);
	v.context.off("page", countPopup);
	check(popups === 0, "cancelling the share sheet opens nothing");

	await shareRejects("NotAllowedError");
	await clickExpectingWhatsApp("a failing share sheet falls back to WhatsApp");
	await shareRejects(null);
	const waText = await clickExpectingWhatsApp("without a share sheet Weiterschicken opens WhatsApp");

	await page.evaluate(() => {
		Object.defineProperty(navigator.clipboard, "writeText", {
			configurable: true,
			value: () => Promise.reject(new DOMException("stub", "NotAllowedError")),
		});
	});
	await page.getByRole("button", { name: "Link kopieren" }).click();
	await page.getByRole("button", { name: "Kopieren nicht möglich" }).waitFor();
	check(true, "a blocked clipboard shows Kopieren nicht möglich");
	await v.proof("invite-copy-failed");

	await page.evaluate(() => {
		delete (navigator.clipboard as unknown as { writeText?: unknown }).writeText;
	});
	await v.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: v.base });
	await page.getByRole("button", { name: "Kopieren nicht möglich" }).click();
	await page.getByRole("button", { name: "Link kopiert" }).waitFor();
	const clipboard = await page.evaluate(() => navigator.clipboard.readText());
	check(clipboard === SHARE_URL, "Link kopieren puts the invite URL on the clipboard");
	await v.proof("invite-copied");

	const shareEvents = await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events);
	check(
		JSON.stringify(shareEvents) ===
			JSON.stringify(
				["native", "whatsapp", "whatsapp", "copy"].map((method) => ({ event: "share", options: { props: { method } } })),
			),
		"plausible got share for native, both WhatsApp fallbacks and copy, nothing for the cancel",
	);

	await v.note("result", { email, pending, confirmed, confirmMail, welcome, shared, waText, shareEvents });
	console.log("PASS subscribe-confirm");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL subscribe-confirm:", error);
	process.exitCode = 1;
} finally {
	db.close();
	await v.close();
}
