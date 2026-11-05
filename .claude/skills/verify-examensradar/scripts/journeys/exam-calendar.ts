// Journey: office-page exam calendar → .ics download + Plausible event →
// Hamm signup whose welcome mail offers calendar links → crawler files.
// See features/exam-calendar.md. Usage: bun exam-calendar.ts <run-id>
import { check, open, waitForMail } from "../pw.ts";

const v = await open("exam-calendar");
const { page } = v;
const email = `verify+cal-${v.runId}@example.test`;
const HAMM = "JPA bei dem OLG Hamm";

try {
	await v.visit(`${v.base}/ergebnisse/hamm`);
	check(
		await page
			.getByRole("heading", { level: 1, name: `${HAMM}: Klausurtermine und Ergebnisse im 1. Examen` })
			.isVisible(),
		"office h1 names dates and results",
	);
	const section = page.locator("section", {
		has: page.getByRole("heading", { name: `Klausurtermine beim ${HAMM}` }),
	});
	check((await section.locator(":scope > ol > li").count()) > 0, "exam calendar pods render");
	await section.scrollIntoViewIfNeeded();
	await v.proof("calendar-pods");

	await page.evaluate(() => {
		const events: unknown[] = [];
		(window as unknown as { __events: unknown[] }).__events = events;
		window.plausible = (event, options) => {
			events.push({ event, options });
		};
	});
	const link = section.getByRole("link", { name: "In den Kalender" }).first();
	const href = (await link.getAttribute("href")) ?? "";
	const sitting = href.split("/").at(-1) ?? "";
	check(/^\/api\/kalender\/hamm\/\d{4}-\d{2}-\d{2}$/.test(href), `calendar link targets ${href}`);
	const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
	check(
		/^klausuren-[a-z]+-\d{4}\.ics$/.test(download.suggestedFilename()),
		`download is ${download.suggestedFilename()}`,
	);
	const ics = (await Bun.file(await download.path()).text()).replace(/\r\n /g, "");
	check((ics.match(/BEGIN:VEVENT/g) ?? []).length === 7, "ics holds 6 exam days and the results event");
	check(ics.includes("Viel Erfolg wünscht dir Examensradar!"), "exam entries wish luck");
	check(ics.includes(`Examensergebnisse voraussichtlich (${HAMM})`), "ics has the results event");
	const events = await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events);
	check(
		JSON.stringify(events) ===
			JSON.stringify([{ event: "calendar_download", options: { props: { jpa: "hamm", sitting } } }]),
		`plausible got calendar_download for ${sitting}`,
	);
	check((await fetch(`${v.base}/api/kalender/hamm/1999-01-01`)).status === 404, "unknown sitting is 404");

	await page.getByLabel("E-Mail-Adresse").first().fill(email);
	await page.getByRole("button", { name: "Benachrichtigen lassen" }).first().click();
	const confirmMail = await waitForMail(v.runId, email, /bestätige deine E-Mail/);
	const confirmLink = confirmMail.links.find((l) => l.includes("/confirm/"));
	if (!confirmLink?.startsWith(v.base)) throw new Error(`confirm link not local: ${confirmLink}`);
	await v.visit(confirmLink);
	await page.getByRole("button", { name: "Jetzt bestätigen" }).click();
	await page.getByRole("heading", { name: "E-Mail bestätigt." }).waitFor();
	const welcome = await waitForMail(v.runId, email, /Alles bereit/);
	const offers = welcome.links.filter((l) => l.includes("/api/kalender/"));
	check(
		offers.length >= 1 && offers.length <= 3 && offers.every((l) => /\/api\/kalender\/hamm\/\d{4}-\d{2}-\d{2}$/.test(l)),
		`welcome mail offers ${offers.length} Hamm calendar link(s)`,
	);
	const offered = await fetch(offers[0]);
	check(offered.headers.get("content-type")?.startsWith("text/calendar"), "welcome-mail link serves text/calendar");

	const sitemap = await (await fetch(`${v.base}/sitemap.xml`)).text();
	const llms = await (await fetch(`${v.base}/llms.txt`)).text();
	const robots = await (await fetch(`${v.base}/robots.txt`)).text();
	check(/ergebnisse\/hamm<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap), "sitemap gives Hamm a lastmod");
	check(llms.includes("## Klausurtermine (NRW)"), "llms.txt lists the exam dates");
	check(!robots.includes("Disallow: /subscriptions"), "robots.txt lets crawlers see /subscriptions' noindex");

	await v.note("result", { email, href, sitting, offers, events });
	console.log("PASS exam-calendar");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL exam-calendar:", error);
	process.exitCode = 1;
} finally {
	await v.close();
}
