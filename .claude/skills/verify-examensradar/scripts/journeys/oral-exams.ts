import { check, open } from "../pw.ts";

const OFFICES = [
	{ param: "hamm", slug: "hamm", lookup: false },
	{ param: "koeln", slug: "köln", lookup: true },
	{ param: "duesseldorf", slug: "düsseldorf", lookup: true },
];
const HEADING = "Mündliche Prüfungen beim ";
const PLACEHOLDER = 'placeholder="z. B. 1234/26"';
const KENNZIFFER = /(?<![\d/])\d{1,4}\/\d{2}(?!\d)/g;
const ASSIGNMENTS_FN = "getOralExamAssignments";

const berlinToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

interface Assignment {
	date: string;
	place: string;
	start?: string;
}

/** Decodes the server fn id in /_serverFn/<base64url> to its exported name. */
function serverFnName(url: string): string {
	const id = new URL(url).pathname.split("/_serverFn/")[1];
	if (!id) return "";
	try {
		return String(JSON.parse(Buffer.from(id, "base64url").toString()).export ?? "").replace(/_createServerFn_handler$/, "");
	} catch {
		return "";
	}
}

/** Reads a seroval JSON payload of strings and plain objects. */
function decode(node: { t: number; s?: string; p?: { k: string[]; v: unknown[] } }): unknown {
	if (node.t === 10 && node.p)
		return Object.fromEntries(node.p.k.map((key, i) => [key, decode(node.p?.v[i] as typeof node)]));
	return node.s;
}

const v = await open("oral-exams");
const { page } = v;

try {
	const robots = await (await fetch(`${v.base}/robots.txt`)).text();
	check(/^Disallow: \/_serverFn\/$/m.test(robots), "robots.txt keeps crawlers away from the server fn path");

	const deadline = Date.now() + 90_000;
	for (const { param, slug, lookup } of OFFICES) {
		let ssr = "";
		while (Date.now() < deadline) {
			ssr = (await (await fetch(`${v.base}/ergebnisse/${param}`)).text()).replaceAll("<!-- -->", "");
			if (ssr.includes(HEADING)) break;
			await Bun.sleep(3000);
		}
		check(ssr.includes(HEADING), `${param}: oral exam section is in the SSR HTML`);
		check(
			ssr.includes("Deine Kennziffer") === lookup,
			`${param}: Kennziffer field ${lookup ? "is" : "is not"} in the SSR HTML`,
		);
		const leaked = ssr.replace(PLACEHOLDER, "").match(KENNZIFFER);
		check(!leaked, `${param}: no Kennziffer pattern in the SSR HTML (loader data included)`);

		const requests: string[] = [];
		page.on("request", (request: { url(): string }) => requests.push(request.url()));
		await v.visit(`${v.base}/ergebnisse/${param}`);
		const section = page.locator("section", {
			has: page.getByRole("heading", { name: new RegExp(`^${HEADING}`) }),
		});
		const range = await section.getByText(/^Die nächsten mündlichen Prüfungen finden /).innerText();
		check(
			/(vom \d{1,2}\. \S+( \d{4})? bis zum|am) \d{1,2}\. \S+ \d{4} statt\.$/.test(range),
			`${param}: the date range is stated (${range})`,
		);
		check(
			(await section.locator("ol").count()) === 0,
			`${param}: no per-day list without a Kennziffer`,
		);
		check(
			(await section.getByText("im fünften Monat nach den Klausuren").count()) === 1,
			`${param}: five-month disclaimer shown`,
		);
		await section.scrollIntoViewIfNeeded();
		await v.proof(`oral-${param}`);
		v.note(`oral-${param}`, { range });

		const field = section.locator("#kennziffer");
		if (!lookup) {
			check((await field.count()) === 0, `${param}: no Kennziffer field`);
			check(
				!requests.some((url) => serverFnName(url) === ASSIGNMENTS_FN),
				`${param}: no assignments requested`,
			);
			continue;
		}

		check(
			(await section.getByText("Deine Kennziffer bleibt in deinem Browser. Wir speichern und senden sie nicht.").count()) === 1,
			`${param}: privacy line under the field`,
		);
		check(
			!requests.some((url) => serverFnName(url) === ASSIGNMENTS_FN),
			`${param}: Kennziffern are not requested before the field is used`,
		);

		const loaded = page.waitForResponse((r: { url(): string }) => serverFnName(r.url()) === ASSIGNMENTS_FN);
		await field.focus();
		const response = await loaded;
		check(
			new URL(response.url()).pathname.startsWith("/_serverFn/") && response.request().method() === "GET",
			`${param}: focusing the field loads the Kennziffern with a GET to /_serverFn/`,
		);
		const body = JSON.parse(await response.text());
		const index = decode(body.p.v[0]) as Record<string, Assignment>;
		const entries = Object.entries(index);
		check(entries.length > 0, `${param}: ${entries.length} upcoming assignments loaded`);
		check(
			entries.every(([key, a]) => /^\d{1,4}\/\d{2}$/.test(key) && a.date >= berlinToday),
			`${param}: only upcoming assignments are shipped`,
		);
		check(
			entries.every(([, a]) => Object.keys(a).every((k) => ["date", "place", "start"].includes(k))),
			`${param}: an assignment carries only date, place and start`,
		);
		const [kennziffer, expected] = entries[0];
		v.note(`oral-${param}-sample`, { count: entries.length, sample: { kennziffer: "XXXX/26", ...expected } });

		await page.evaluate(() => {
			const events: unknown[] = [];
			Object.assign(window, {
				__events: events,
				plausible: (event: string, options: unknown) => events.push({ event, options }),
			});
		});
		const before = requests.length;
		const typed = kennziffer.replace("/", " / ");
		await field.pressSequentially(` ${typed} `, { delay: 20 });

		const status = section.getByRole("status");
		const [, month, day] = expected.date.split("-").map(Number);
		const when = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.`;
		const wanted = `${when} · ${expected.place}${expected.start ? ` · ab ca. ${expected.start} Uhr` : ""}`;
		check(
			(await status.innerText()).replace(/^[A-Z][a-z] /, "") === wanted,
			`${param}: typing a Kennziffer shows its day, place${expected.start ? " and start" : " (no start published)"}`,
		);
		await section.scrollIntoViewIfNeeded();
		await v.proof(`oral-${param}-found`);

		await field.fill("9999/99");
		check(
			(await status.innerText()).startsWith("Für diese Kennziffer ist noch kein Termin veröffentlicht.") &&
				(await status.innerText()).includes("etwa drei Wochen"),
			`${param}: an unknown Kennziffer shows the not-published message`,
		);
		await v.proof(`oral-${param}-missing`);

		await field.fill(kennziffer);
		await field.press("Enter");
		const url = page.url();
		check(
			new URL(url).pathname === `/ergebnisse/${param}` && new URL(url).search === "" && new URL(url).hash === "",
			`${param}: Enter leaves the URL alone`,
		);

		const traffic = requests.slice(before);
		const secrets = [kennziffer, encodeURIComponent(kennziffer), typed, encodeURIComponent(typed), "9999/99", "9999%2F99"];
		check(traffic.length === 0, `${param}: typing and Enter caused ${traffic.length} requests`);
		check(
			!secrets.some((secret) => requests.some((u) => u.includes(secret))),
			`${param}: no request URL contains a typed Kennziffer`,
		);
		const browserState = JSON.stringify(
			await page.evaluate(() => [history.state, { ...localStorage }, { ...sessionStorage }, document.cookie]),
		);
		const cookies = JSON.stringify(await v.context.cookies());
		check(
			!secrets.some((s) => browserState.includes(s) || cookies.includes(s) || url.includes(s)),
			`${param}: no Kennziffer in URL, history state, storage or cookies`,
		);

		const events = (await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events)) as unknown[];
		check(
			JSON.stringify(events) === JSON.stringify([{ event: "kennziffer_lookup", options: { props: { jpa: slug, found: true } } }]),
			`${param}: Plausible got one kennziffer_lookup with only jpa and found`,
		);
	}
	console.log("PASS oral-exams");
} finally {
	await v.close();
}
