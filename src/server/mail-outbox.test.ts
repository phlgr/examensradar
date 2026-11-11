import { afterAll, expect, test } from "bun:test";
import {
	addEmailSubscription,
	confirmSubscriber,
	createJpa,
	getNotificationHistory,
	leaseDueMails,
	unsubscribeSubscriber,
	upsertPendingSubscriber,
} from "../db/index.ts";
import { sendFailures, sentMails } from "../test-setup.ts";
import { drainMailOutbox } from "./mail-outbox.ts";
import { checkJpa } from "./scraper.ts";

const realFetch = globalThis.fetch;

afterAll(() => {
	globalThis.fetch = realFetch;
});

const serve = (content: string) => {
	globalThis.fetch = (async () =>
		new Response(
			`<html><body><article id="main">${content}</article></body></html>`,
		)) as unknown as typeof fetch;
};

const noKick = () => {};

const newOffice = async (notificationsDisabled = false) => {
	const id = crypto.randomUUID();
	const jpa = await createJpa({
		name: `Outbox-JPA ${id}`,
		slug: `outbox-${id}`,
		scrapeUrl: "https://example.org/aktuelles",
		scrapeSelector: "article#main",
	});
	return { ...jpa, notificationsDisabled };
};

const subscribe = async (
	jpaId: string,
	{ confirmed }: { confirmed: boolean } = { confirmed: true },
) => {
	const email = `${crypto.randomUUID()}@example.org`;
	const subscriber = await upsertPendingSubscriber(email, null);
	await addEmailSubscription(subscriber.id, jpaId);
	if (confirmed) await confirmSubscriber(subscriber.confirmToken);
	return { id: subscriber.id, email };
};

const publishChange = async (
	jpa: Awaited<ReturnType<typeof newOffice>>,
	kick?: () => void,
) => {
	serve("alte Meldung");
	expect((await checkJpa(jpa, kick)).result).toBe("baseline");
	serve("Neue Ergebnisse!");
	return checkJpa(jpa, kick);
};

const mailsTo = (email: string) =>
	sentMails.filter((mail) => mail.to === email);

const releasesOf = async (slug: string) =>
	(await getNotificationHistory()).filter((entry) => entry.jpaSlug === slug);

const smtp = (responseCode: number) =>
	Object.assign(new Error("smtp"), { responseCode });

test("a change at an office without subscribers still records a release", async () => {
	const jpa = await newOffice();

	expect(await publishChange(jpa)).toEqual({ result: "notified", mail: 0 });
	await drainMailOutbox();

	expect(await releasesOf(jpa.slug)).toHaveLength(1);
});

test("a change mails each active subscriber exactly once and skips pending ones", async () => {
	const jpa = await newOffice();
	const first = await subscribe(jpa.id);
	const second = await subscribe(jpa.id);
	const pending = await subscribe(jpa.id, { confirmed: false });

	expect(await publishChange(jpa)).toEqual({ result: "notified", mail: 2 });
	await drainMailOutbox();
	expect((await checkJpa(jpa)).result).toBe("unchanged");
	await drainMailOutbox();

	expect(mailsTo(first.email)).toHaveLength(1);
	expect(mailsTo(second.email)).toHaveLength(1);
	expect(mailsTo(pending.email)).toHaveLength(0);
	expect(mailsTo(first.email)[0]?.subject).toBe(`Neue Ergebnisse: ${jpa.name}`);
	expect(mailsTo(first.email)[0]?.headers?.["List-Unsubscribe-Post"]).toBe(
		"List-Unsubscribe=One-Click",
	);
	expect(await releasesOf(jpa.slug)).toHaveLength(1);
});

test("mails left pending by a restart go out on the next drain, once", async () => {
	const jpa = await newOffice();
	const subscriber = await subscribe(jpa.id);

	await publishChange(jpa, noKick);
	expect(mailsTo(subscriber.email)).toHaveLength(0);

	await drainMailOutbox();
	await drainMailOutbox();

	expect(mailsTo(subscriber.email)).toHaveLength(1);
});

test("a retryable SMTP failure is delivered once after the backoff", async () => {
	const jpa = await newOffice();
	const subscriber = await subscribe(jpa.id);
	sendFailures.set(subscriber.email, [smtp(421)]);

	await publishChange(jpa, noKick);
	await drainMailOutbox();
	expect(mailsTo(subscriber.email)).toHaveLength(0);

	await drainMailOutbox();
	expect(mailsTo(subscriber.email)).toHaveLength(0);

	const later = () => new Date(Date.now() + 60_000);
	await drainMailOutbox(later);
	await drainMailOutbox(later);
	expect(mailsTo(subscriber.email)).toHaveLength(1);
});

test("a permanent SMTP failure is not retried", async () => {
	const jpa = await newOffice();
	const subscriber = await subscribe(jpa.id);
	sendFailures.set(subscriber.email, [smtp(550)]);

	await publishChange(jpa, noKick);
	await drainMailOutbox();
	await drainMailOutbox(() => new Date(Date.now() + 3_600_000));

	expect(mailsTo(subscriber.email)).toHaveLength(0);
});

test("a retryable failure that never clears is abandoned after five attempts", async () => {
	const jpa = await newOffice();
	const subscriber = await subscribe(jpa.id);
	sendFailures.set(subscriber.email, Array(6).fill(smtp(421)));

	await publishChange(jpa, noKick);
	for (let hour = 0; hour < 6; hour++) {
		await drainMailOutbox(() => new Date(Date.now() + hour * 3_600_000));
	}

	expect(sendFailures.get(subscriber.email)).toHaveLength(1);
	expect(mailsTo(subscriber.email)).toHaveLength(0);
});

test("a subscriber who unsubscribes before the drain gets no mail", async () => {
	const jpa = await newOffice();
	const subscriber = await subscribe(jpa.id);

	await publishChange(jpa, noKick);
	await unsubscribeSubscriber(subscriber.id);
	await drainMailOutbox();

	expect(mailsTo(subscriber.email)).toHaveLength(0);
});

test("a paused office mails nobody and records no release", async () => {
	const jpa = await newOffice(true);
	const subscriber = await subscribe(jpa.id);

	expect((await publishChange(jpa)).result).toBe("paused");
	await drainMailOutbox();

	expect(mailsTo(subscriber.email)).toHaveLength(0);
	expect(await releasesOf(jpa.slug)).toHaveLength(0);
});

test("two workers leasing at once never both get the same mail, and a lapsed lease frees it", async () => {
	const jpa = await newOffice();
	const subscriber = await subscribe(jpa.id);
	await publishChange(jpa, noKick);

	const now = new Date(Date.now() + 1_000);
	const leasesOf = (rows: Awaited<ReturnType<typeof leaseDueMails>>) =>
		rows.filter((row) => row.email === subscriber.email);
	const [a, b] = await Promise.all([
		leaseDueMails(now, 1_000, 60_000),
		leaseDueMails(now, 1_000, 60_000),
	]);
	expect(leasesOf(a).length + leasesOf(b).length).toBe(1);

	expect(leasesOf(await leaseDueMails(now, 1_000, 60_000))).toHaveLength(0);
	const lapsed = new Date(now.getTime() + 61_000);
	expect(leasesOf(await leaseDueMails(lapsed, 1_000, 60_000))).toHaveLength(1);
});
