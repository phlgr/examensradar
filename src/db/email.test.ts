import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";

const setup = new Database(process.env.DATABASE_PATH as string);

const {
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
	normalizeEmail,
	removeEmailSubscription,
	unsubscribeSubscriber,
	upsertPendingSubscriber,
} = await import("./index.ts");

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

test("normalizeEmail folds case and whitespace", () => {
	expect(normalizeEmail("  Philipp@Example.DE ")).toBe("philipp@example.de");
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
