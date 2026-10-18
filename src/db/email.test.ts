import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { TEST_DB_PATH } from "../test-setup.ts";
import {
	addEmailSubscription,
	classifyConfirmToken,
	confirmSubscriber,
	countEmailSubscriptionsByJpa,
	createJpa,
	getMailableSubscribersByJpa,
	getSubscriberByEmail,
	getSubscriberByManageToken,
	getSubscriberJpas,
	getSubscriptionCountsByJpa,
	removeEmailSubscription,
	subscriberStatus,
	unsubscribeSubscriber,
	upsertPendingSubscriber,
} from "./index.ts";

const setup = new Database(TEST_DB_PATH);

afterAll(() => {
	setup.close();
});

const jpa = async (slug: string) =>
	createJpa({ name: `Justizprüfungsamt ${slug}`, slug });

const expireConfirmToken = (email: string) =>
	setup.run("UPDATE subscriber SET confirm_expires_at = ? WHERE email = ?", [
		Date.now() - 1000,
		email,
	]);

test("manage and unsubscribe tokens are distinct credentials", async () => {
	const subscriber = await upsertPendingSubscriber("tokens@example.com", null);

	expect(subscriber.unsubscribeToken).toBeTruthy();
	expect(subscriber.unsubscribeToken).not.toBe(subscriber.manageToken);
	expect(
		await getSubscriberByManageToken(subscriber.unsubscribeToken),
	).toBeNull();
});

test("an address is one subscriber regardless of case and whitespace", async () => {
	const first = await upsertPendingSubscriber("  Mixed@Example.DE ", null);
	expect(first.email).toBe("mixed@example.de");

	const again = await upsertPendingSubscriber("MIXED@example.de", null);
	expect(again.id).toBe(first.id);
	expect((await getSubscriberByEmail(" mixed@EXAMPLE.de"))?.id).toBe(first.id);

	await confirmSubscriber(again.confirmToken);
	await expect(
		upsertPendingSubscriber("Mixed@Example.de", null),
	).rejects.toThrow();
});

test("only active subscribers are mailed and counted", async () => {
	const office = await jpa("status");
	const subscribe = async (email: string) => {
		const subscriber = await upsertPendingSubscriber(email, null);
		await addEmailSubscription(subscriber.id, office.id);
		return subscriber;
	};
	const status = async (email: string) => {
		const subscriber = await getSubscriberByEmail(email);
		if (!subscriber) throw new Error(`missing subscriber ${email}`);
		return subscriberStatus(subscriber);
	};

	await subscribe("status-pending@example.com");

	const active = await subscribe("status-active@example.com");
	await confirmSubscriber(active.confirmToken);

	const bounced = await subscribe("status-bounced@example.com");
	await confirmSubscriber(bounced.confirmToken);
	setup.run("UPDATE subscriber SET bounced_at = ? WHERE email = ?", [
		Date.now(),
		"status-bounced@example.com",
	]);

	const unsubscribed = await subscribe("status-unsub@example.com");
	await confirmSubscriber(unsubscribed.confirmToken);
	await unsubscribeSubscriber(unsubscribed.id);

	const reoptIn = await subscribe("status-reopt@example.com");
	await confirmSubscriber(reoptIn.confirmToken);
	await unsubscribeSubscriber(reoptIn.id);
	await subscribe("status-reopt@example.com");

	expect({
		pending: await status("status-pending@example.com"),
		active: await status("status-active@example.com"),
		bounced: await status("status-bounced@example.com"),
		unsubscribed: await status("status-unsub@example.com"),
		reoptIn: await status("status-reopt@example.com"),
	}).toEqual({
		pending: "pending",
		active: "active",
		bounced: "bounced",
		unsubscribed: "unsubscribed",
		reoptIn: "pending",
	});

	const mailable = await getMailableSubscribersByJpa(office.id);
	expect(mailable.map((subscriber) => subscriber.email)).toEqual([
		"status-active@example.com",
	]);
	expect((await getSubscriptionCountsByJpa()).get(office.id)).toBe(
		mailable.length,
	);
	expect(await countEmailSubscriptionsByJpa(office.id)).toBe(4);
});

test("a pending subscriber is never mailable", async () => {
	const office = await jpa("pending");
	const subscriber = await upsertPendingSubscriber("pending@example.com", null);
	await addEmailSubscription(subscriber.id, office.id);

	expect(subscriber.confirmedAt).toBeNull();
	expect(subscriber.confirmToken).toBeTruthy();
	expect(await countEmailSubscriptionsByJpa(office.id)).toBe(1);
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);
});

test("admin counts only mailable subscribers, not pending ones", async () => {
	const office = await jpa("admin-count");
	const pending = await upsertPendingSubscriber(
		"count-pending@example.com",
		null,
	);
	await addEmailSubscription(pending.id, office.id);
	const confirmed = await upsertPendingSubscriber("count-ok@example.com", null);
	await addEmailSubscription(confirmed.id, office.id);
	await confirmSubscriber(confirmed.confirmToken);

	expect((await getSubscriptionCountsByJpa()).get(office.id)).toBe(1);
});

test("confirming makes the address mailable and consumes the link", async () => {
	const office = await jpa("confirm");
	const pending = await upsertPendingSubscriber(
		"confirm@example.com",
		"1.2.3.4",
	);
	await addEmailSubscription(pending.id, office.id);

	const token = pending.confirmToken;
	const confirmed = await confirmSubscriber(token);

	if (!confirmed) throw new Error("expected the confirmation to succeed");

	expect(confirmed.confirmedAt).toBeInstanceOf(Date);
	expect(confirmed.confirmToken).toBe(token);
	expect(confirmed.consentIp).toBe("1.2.3.4");

	const mailable = await getMailableSubscribersByJpa(office.id);
	expect(mailable).toHaveLength(1);
	expect(mailable[0]?.email).toBe("confirm@example.com");
	expect(mailable[0]?.manageToken).toBe(confirmed.manageToken);

	expect(await classifyConfirmToken(token)).toMatchObject({
		state: "confirmed",
	});
	expect(await confirmSubscriber(token)).toBeNull();
});

test("an active subscriber cannot be reset to pending", async () => {
	const pending = await upsertPendingSubscriber("guard@example.com", null);
	await confirmSubscriber(pending.confirmToken);

	await expect(
		upsertPendingSubscriber("guard@example.com", null),
	).rejects.toThrow();
});

test("a used confirm link cannot undo a later unsubscribe", async () => {
	const office = await jpa("stale-link");
	const pending = await upsertPendingSubscriber("stale@example.com", null);
	await addEmailSubscription(pending.id, office.id);

	const token = pending.confirmToken;
	const confirmed = await confirmSubscriber(token);
	if (!confirmed) throw new Error("expected the confirmation to succeed");

	await unsubscribeSubscriber(confirmed.id);

	expect(await classifyConfirmToken(token)).toMatchObject({
		state: "invalid",
	});
	expect(await confirmSubscriber(token)).toBeNull();
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);
});

test("an expired confirmation link is refused", async () => {
	const office = await jpa("expired");
	const pending = await upsertPendingSubscriber("expired@example.com", null);
	await addEmailSubscription(pending.id, office.id);
	expireConfirmToken("expired@example.com");

	expect(await classifyConfirmToken(pending.confirmToken)).toMatchObject({
		state: "invalid",
	});
	expect(await confirmSubscriber(pending.confirmToken)).toBeNull();
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);
});

test("a used confirm link still reads confirmed after the TTL", async () => {
	const office = await jpa("late-reopen");
	const pending = await upsertPendingSubscriber("late@example.com", null);
	await addEmailSubscription(pending.id, office.id);
	await confirmSubscriber(pending.confirmToken);
	expireConfirmToken("late@example.com");

	expect(await classifyConfirmToken(pending.confirmToken)).toMatchObject({
		state: "confirmed",
	});
	expect(await confirmSubscriber(pending.confirmToken)).toBeNull();
});

test("one address may subscribe to several JPAs", async () => {
	const first = await jpa("multi-a");
	const second = await jpa("multi-b");

	const pending = await upsertPendingSubscriber("multi@example.com", null);
	await addEmailSubscription(pending.id, first.id);
	await addEmailSubscription(pending.id, second.id);
	await addEmailSubscription(pending.id, first.id);
	await confirmSubscriber(pending.confirmToken);

	expect(await getSubscriberJpas(pending.id)).toHaveLength(2);
	expect(await getMailableSubscribersByJpa(first.id)).toHaveLength(1);
	expect(await getMailableSubscribersByJpa(second.id)).toHaveLength(1);

	await removeEmailSubscription(pending.id, first.id);
	expect(await getMailableSubscribersByJpa(first.id)).toEqual([]);
	expect(await getMailableSubscribersByJpa(second.id)).toHaveLength(1);
});

test("unsubscribing keeps the row as a suppression record", async () => {
	const office = await jpa("unsub");
	const pending = await upsertPendingSubscriber("unsub@example.com", null);
	await addEmailSubscription(pending.id, office.id);
	await confirmSubscriber(pending.confirmToken);

	await unsubscribeSubscriber(pending.id);

	const suppressed = await getSubscriberByEmail("unsub@example.com");
	expect(suppressed).not.toBeNull();
	expect(suppressed?.unsubscribedAt).toBeInstanceOf(Date);
	expect(await getSubscriberJpas(pending.id)).toEqual([]);
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);

	expect(await getSubscriberByManageToken(pending.manageToken)).not.toBeNull();
});

test("a fresh confirmed opt-in supersedes an earlier unsubscribe", async () => {
	const office = await jpa("resub");
	const first = await upsertPendingSubscriber("resub@example.com", null);
	await addEmailSubscription(first.id, office.id);
	await confirmSubscriber(first.confirmToken);
	await unsubscribeSubscriber(first.id);

	const again = await upsertPendingSubscriber("resub@example.com", "5.6.7.8");
	await addEmailSubscription(again.id, office.id);
	expect(again.id).toBe(first.id);
	expect(again.confirmedAt).toBeNull();
	expect(await classifyConfirmToken(again.confirmToken)).toMatchObject({
		state: "pending",
	});
	expect(await classifyConfirmToken(first.confirmToken)).toMatchObject({
		state: "invalid",
	});
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);

	const confirmed = await confirmSubscriber(again.confirmToken);
	expect(confirmed?.unsubscribedAt).toBeNull();
	expect(await getMailableSubscribersByJpa(office.id)).toHaveLength(1);
	expect(confirmed?.manageToken).toBe(first.manageToken);
});
