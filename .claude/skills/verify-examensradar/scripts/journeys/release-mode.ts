import { Database } from "bun:sqlite";
import { check, confirmedSubscriber, mails, open, waitForMail } from "../pw.ts";

const v = await open("release-mode");
const { page } = v;
const { email } = confirmedSubscriber(v.runId);
const db = new Database(v.env.DB, { readonly: true });
const scrapeState = () =>
	db
		.query("select content_hash, error_count, last_error from scrape_state where jpa_id = 'jpa-verify-test'")
		.get() as { content_hash: string | null; error_count: number; last_error: string | null };
const testJpa = () => v.card("JPA Verifikation (Test)");
const checkNow = () => testJpa().getByRole("button", { name: "Jetzt prüfen" }).click();
const setFixture = (html: string) =>
	Bun.$`${import.meta.dir}/../verify.sh fixture ${v.runId} ${html}`.quiet();
const RELEASE_SELECTOR = "article#results .ergebnis";

try {
	await setFixture("<p>Noch keine Ergebnisse</p>");
	await v.visit(`${v.base}/admin/login`);
	await page.getByLabel("Passwort").fill(v.env.ADMIN_PASSWORD);
	await page.getByRole("button", { name: "Anmelden" }).click();
	await page.waitForURL(/\/admin$/);

	await testJpa().getByRole("button", { name: "Bearbeiten" }).click();
	await page.getByLabel("CSS-Selektor (optional)").fill(RELEASE_SELECTOR);
	await page.getByLabel("Selektor erscheint nur bei neuen Ergebnissen").check();
	await v.proof("edit-form");
	await page.getByRole("button", { name: "Speichern" }).click();
	await testJpa().getByText("Selektor erscheint nur bei neuen Ergebnissen.").waitFor();
	await v.proof("saved-release-mode");

	const jpaRow = db
		.query("select scrape_mode, scrape_selector from jpa where id = 'jpa-verify-test'")
		.get() as { scrape_mode: string; scrape_selector: string };
	check(
		jpaRow.scrape_mode === "release" && jpaRow.scrape_selector === RELEASE_SELECTOR,
		"admin form saved release mode and selector",
	);
	const baseline = scrapeState();
	check(
		baseline.content_hash === "absent" && baseline.error_count === 0 && baseline.last_error === null,
		"absent selector stored the 'nothing published' baseline without an error",
	);

	const mailCount = mails(v.runId).length;
	await checkNow();
	await testJpa().getByText("Keine Änderung.").waitFor();
	await v.proof("absent-unchanged");
	check(scrapeState().error_count === 0, "checking again while absent records no error");

	await setFixture('<p class="ergebnis">Ergebnisse 2026/II</p>');
	await checkNow();
	await testJpa().getByText(/Änderung erkannt — 1 Mails? in Zustellung\./).waitFor();
	await v.proof("appeared-notified");
	const resultsMail = await waitForMail(v.runId, email, /Neue Ergebnisse: JPA Verifikation/);
	await Bun.sleep(1_000);
	check(mails(v.runId).length === mailCount + 1, "the release sent exactly one results mail");

	await checkNow();
	await testJpa().getByText("Keine Änderung.").waitFor();

	await setFixture("<p>Noch keine Ergebnisse</p>");
	await checkNow();
	await testJpa().getByText("Keine Änderung.").waitFor();
	await v.proof("vanished-unchanged");
	check(scrapeState().error_count === 0, "the release vanishing is no error");

	await setFixture('<p class="ergebnis">Ergebnisse 2026/II</p>');
	await checkNow();
	await testJpa().getByText("Keine Änderung.").waitFor();
	await Bun.sleep(1_000);
	check(mails(v.runId).length === mailCount + 1, "identical content reappearing sent no mail");

	await v.note("result", { email, jpaRow, baseline, resultsMail, finalState: scrapeState() });
	console.log("PASS release-mode");
} catch (error) {
	await v.proof("failure").catch(() => {});
	console.error("FAIL release-mode:", error);
	process.exitCode = 1;
} finally {
	db.close();
	await v.close();
}
