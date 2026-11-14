import { check, open, waitForMail } from "../pw.ts";

const v = await open("exam-calendar");
const { page } = v;
const email = `verify+cal-${v.runId}@example.test`;
const HAMM = "OLG Hamm";

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
		window.rybbit = {
			event: (event, properties) => {
				events.push({ event, properties });
			},
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
			JSON.stringify([{ event: "calendar_download", properties: { jpa: HAMM, sitting, month: sitting.slice(0, 7) } }]),
		`rybbit got calendar_download for ${sitting}`,
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
	check(
		llms.includes("## Klausurtermine") && llms.includes("### Nordrhein-Westfalen") && llms.includes("### Bayern"),
		"llms.txt lists the exam dates per Land",
	);
	check(!robots.includes("Disallow: /subscriptions"), "robots.txt lets crawlers see /subscriptions' noindex");

	const others: Record<string, unknown> = {};
	const openPod = async (slug: string, name: string) => {
		await v.visit(`${v.base}/ergebnisse/${slug}`);
		const office = page.locator("section", {
			has: page.getByRole("heading", { name: `Klausurtermine beim ${name}` }),
		});
		const pod = office.locator(":scope > ol > li", { hasText: /nächster Durchgang|läuft gerade/ });
		await pod.scrollIntoViewIfNeeded();
		await v.proof(`calendar-${slug}`);
		return { office, pod };
	};
	const downloadIcs = async (pod: typeof section, slug: string) => {
		const [file] = await Promise.all([
			page.waitForEvent("download"),
			pod.getByRole("link", { name: "In den Kalender" }).click(),
		]);
		const saved = `${v.out}/${slug}-${file.suggestedFilename()}`;
		await file.saveAs(saved);
		return (await Bun.file(saved).text()).replace(/\r\n /g, "");
	};

	{
		const { pod } = await openPod("bremen", "JPA Bremen");
		const days = (await pod.locator("ul > li").allInnerTexts()).map((d) => d.replace(/\s+/g, " "));
		check(days.length === 6 && days.every((d) => /(ZR|ÖR|SR)$/.test(d)), `Bremen pod lists ${days.join(", ")}`);
		check(
			(await pod.innerText()).includes("Fächer laut Terminplan Nordrhein-Westfalen, verbindlich ist deine Ladung."),
			"Bremen pod names where its subjects come from",
		);
		const ics = await downloadIcs(pod, "bremen");
		check((ics.match(/BEGIN:VEVENT/g) ?? []).length === 7, "Bremen ics holds 6 exam days and the results event");
		check(ics.includes("gemeinsamen Terminplan (Nordrhein-Westfalen)"), "Bremen ics marks the subject as not confirmed");
		others.bremen = days;
	}
	{
		const { office, pod } = await openPod("bayern", "LJPA Bayern");
		check(
			(await pod.innerText()).includes("Einzelne Klausurtage nennt das Prüfungsamt nicht."),
			"Bayern pod says the office names no single days",
		);
		check((await pod.locator("ul").count()) === 0, "Bayern pod has no day list");
		check(!(await office.innerText()).includes("ZR Zivilrecht"), "Bayern section has no subject legend");
		const ics = await downloadIcs(pod, "bayern");
		const [start, end] = [/DTSTART;VALUE=DATE:(\d{8})/, /DTEND;VALUE=DATE:(\d{8})/].map((re) => ics.match(re)?.[1] ?? "");
		const span = (Date.parse(end.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")) - Date.parse(start.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))) / 86_400_000;
		check((ics.match(/BEGIN:VEVENT/g) ?? []).length === 2, "Bayern ics holds one range event and the results event");
		check(ics.includes("SUMMARY:Examensklausuren\r\n") && span >= 5 && span <= 17, `Bayern range event runs ${start} to ${end}`);
		others.bayern = { start, end };
	}
	{
		const { pod } = await openPod("berlin-brandenburg", "GJPA Berlin-Brandenburg");
		const days = (await pod.locator("ul > li").allInnerTexts()).map((d) => d.replace(/\s+/g, " "));
		check(days.length === 7 && days.filter((d) => d.endsWith("SR")).length === 2, `Berlin pod lists ${days.join(", ")}`);
		others.berlin = days;
	}
	{
		await v.visit(`${v.base}/ergebnisse/hamm`);
		check(
			(await section.innerText()).includes("ZR Zivilrecht · ÖR Öffentliches Recht · SR Strafrecht"),
			"Hamm keeps the subject legend",
		);
	}

	await v.note("result", { email, href, sitting, offers, events, others });
	console.log("PASS exam-calendar");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL exam-calendar:", error);
	process.exitCode = 1;
} finally {
	await v.close();
}
