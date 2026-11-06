import { check, open } from "../pw.ts";

const OFFICES = ["hamm", "koeln", "duesseldorf"];
const HEADING = "Mündliche Prüfungen beim ";

const v = await open("oral-exams");
const { page } = v;

try {
	const deadline = Date.now() + 90_000;
	for (const param of OFFICES) {
		let ssr = "";
		while (Date.now() < deadline) {
			ssr = (await (await fetch(`${v.base}/ergebnisse/${param}`)).text()).replaceAll("<!-- -->", "");
			if (ssr.includes(HEADING)) break;
			await Bun.sleep(3000);
		}
		check(ssr.includes(HEADING), `${param}: oral exam section is in the SSR HTML`);

		await v.visit(`${v.base}/ergebnisse/${param}`);
		const section = page.locator("section", {
			has: page.getByRole("heading", { name: new RegExp(`^${HEADING}`) }),
		});
		const days = await section.locator("ol > li li").allInnerTexts();
		check(days.length > 0, `${param}: ${days.length} upcoming oral exam days render`);
		check(
			days.every((d) => /^[A-Z][a-z] \d{2}\.\d{2}\.\s+\S/.test(d)),
			`${param}: every day shows a date and a place`,
		);
		check(
			(await section.getByText("im fünften Monat nach den Klausuren").count()) === 1,
			`${param}: five-month disclaimer shown`,
		);
		await section.scrollIntoViewIfNeeded();
		await v.proof(`oral-${param}`);
		v.note(`oral-${param}`, { days });
	}
	console.log("PASS oral-exams");
} finally {
	await v.close();
}
