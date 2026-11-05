import { describe, expect, test } from "bun:test";
import { calendarOffers, renderWelcomeMail } from "./mail-templates.ts";

const TOKENS = { manage: "m-token", unsubscribe: "u-token" };
const NOW = new Date("2026-11-05T12:00:00+01:00");

describe("calendarOffers", () => {
	const offers = calendarOffers(
		[
			{ jpaSlug: "hamm", jpaName: "Justizprüfungsamt Hamm" },
			{ jpaSlug: "berlin", jpaName: "Berlin" },
		],
		NOW,
	);

	test("offers the next three sittings, only for JPAs with a calendar", () => {
		expect(offers).toHaveLength(1);
		expect(offers[0].jpaName).toBe("Justizprüfungsamt Hamm");
		expect(offers[0].links).toHaveLength(3);
		expect(offers[0].links[0].label).toBe("19.–27. November 2026");
		expect(offers[0].links[0].url).toEndWith("/api/kalender/hamm/2026-11-19");
	});

	test("skips sittings that start today or earlier", () => {
		const onStartDay = calendarOffers(
			[{ jpaSlug: "hamm", jpaName: "Hamm" }],
			new Date("2026-11-19T08:00:00+01:00"),
		);
		expect(onStartDay[0].links[0].url).not.toContain("2026-11-19");
	});
});

describe("renderWelcomeMail", () => {
	const offers = calendarOffers(
		[{ jpaSlug: "hamm", jpaName: "Justizprüfungsamt Hamm" }],
		NOW,
	);

	test("lists the calendar links in html and text", () => {
		const mail = renderWelcomeMail(TOKENS, offers);
		for (const part of [mail.html, mail.text]) {
			expect(part).toContain("Klausurtermine in deinen Kalender");
			expect(part).toContain("/api/kalender/hamm/2026-11-19");
			expect(part).toContain("19.–27. November 2026");
			expect(part).toContain("Ohne Gewähr.");
		}
	});

	test("without offers it is unchanged", () => {
		const mail = renderWelcomeMail(TOKENS);
		expect(renderWelcomeMail(TOKENS, [])).toEqual(mail);
		expect(mail.html).not.toContain("Kalender");
		expect(mail.text).toContain("über den Link unten.\n\nAbo verwalten: ");
	});
});
