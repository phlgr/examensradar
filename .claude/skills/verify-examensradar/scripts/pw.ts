// Shared Playwright harness for journeys. Playwright lives in a scratch
// toolchain (verify.sh setup), not in the app's package.json.
//
//   const v = await open("subscribe-confirm");   // reads run-id from argv[2]
//   await v.visit(v.base);          // goto + wait for hydration
//   await v.proof("landing");   // NN-landing.png + NN-landing.aria.yml
//   await v.close();
import { mkdirSync, readFileSync } from "node:fs";

const TOOLS = `${process.env.HOME}/.cache/examensradar-verify/tools`;
const ROOT = process.env.EXAMENSRADAR_VERIFY_ROOT ?? "/tmp/examensradar-verify";

export function runEnv(runId: string): Record<string, string> {
	const text = readFileSync(`${ROOT}/${runId}/state/env`, "utf8");
	return Object.fromEntries(
		text
			.split("\n")
			.filter((line) => line.includes("="))
			.map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
	);
}

/** Captured mail for this run, oldest first. */
export function mails(runId: string): Array<{ n: string; to: string[]; subject: string; links: string[] }> {
	try {
		return readFileSync(`${ROOT}/${runId}/state/mail/index.jsonl`, "utf8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));
	} catch {
		return [];
	}
}

export function check(ok: unknown, msg: string): void {
	if (!ok) throw new Error(msg);
	console.log(`ok   ${msg}`);
}

export function confirmedSubscriber(runId: string) {
	const email = `verify+${runId}@example.test`;
	const welcome = mails(runId).find((m) => m.to.includes(email) && /Alles bereit/.test(m.subject));
	if (!welcome) throw new Error(`no welcome mail to ${email}: run subscribe-confirm first`);
	return { email, welcome };
}

/** Polls the sink until a mail to `to` whose subject matches arrives. */
export async function waitForMail(runId: string, to: string, subject: RegExp, timeoutMs = 15_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const hit = mails(runId).find((m) => m.to.includes(to) && subject.test(m.subject));
		if (hit) return hit;
		await Bun.sleep(250);
	}
	throw new Error(`no mail to ${to} matching ${subject} within ${timeoutMs}ms`);
}

export async function open(journey: string) {
	const runId = process.argv[2];
	if (!runId) throw new Error(`usage: bun ${journey}.ts <run-id>`);
	const env = runEnv(runId);
	const out = `${env.EVIDENCE_DIR}/${journey}`;
	mkdirSync(out, { recursive: true });

	const { chromium } = await import(`${TOOLS}/node_modules/playwright/index.mjs`);
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 1280, height: 1600 }, locale: "de-DE" });
	const page = await context.newPage();
	let step = 0;

	return {
		runId,
		env,
		base: env.BASE_URL,
		out,
		page,
		context,
		/**
		 * goto + wait for React hydration. SSR renders the forms before React
		 * owns them; input typed before hydration is wiped and the submit button
		 * stays disabled.
		 */
		async visit(url: string) {
			await page.goto(url);
			await page.waitForFunction(() =>
				[...document.querySelectorAll("button, input, select, a")].some((el) =>
					Object.keys(el).some((key) => key.startsWith("__reactProps")),
				),
			);
		},
		/** Screenshot + ARIA snapshot of the current page, numbered in order. */
		async proof(label: string) {
			const name = `${String(++step).padStart(2, "0")}-${label}`;
			await page.screenshot({ path: `${out}/${name}.png` });
			await Bun.write(`${out}/${name}.aria.yml`, await page.locator("body").ariaSnapshot());
			console.log(`proof ${out}/${name}.png`);
		},
		card: (heading: string) =>
			page
				.getByRole("heading", { name: heading })
				.locator("xpath=ancestor::div[count(.//h1|.//h2|.//h3|.//h4|.//h5|.//h6)=1][last()]"),
		cookie: async (name: string) =>
			(await context.cookies()).find((c: { name: string }) => c.name === name),
		async note(name: string, data: unknown) {
			await Bun.write(`${out}/${name}.json`, JSON.stringify(data, null, 2));
		},
		close: () => browser.close(),
	};
}
