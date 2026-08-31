import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// src/db/index.ts opens its connection at import time, so the path has to be
// set before that module is pulled in — hence the dynamic import below.
const DB_PATH = `${process.env.TMPDIR ?? "/tmp"}/examensradar-email-test-${crypto.randomUUID()}.db`;
process.env.DATABASE_PATH = DB_PATH;

const setup = new Database(DB_PATH);
setup.run("PRAGMA journal_mode = WAL");
migrate(drizzle(setup), { migrationsFolder: "./drizzle/migrations" });

const {
	addEmailSubscription,
	confirmSubscriber,
	countEmailSubscriptionsByJpa,
	createJpa,
	getMailableSubscribersByJpa,
	getSubscriberByEmail,
	getSubscriberByManageToken,
	getSubscriberJpas,
	normalizeEmail,
	removeEmailSubscription,
	unsubscribeSubscriber,
	upsertPendingSubscriber,
} = await import("./index.ts");

afterAll(() => {
	setup.close();
	for (const suffix of ["", "-wal", "-shm"]) {
		Bun.file(`${DB_PATH}${suffix}`)
			.delete()
			.catch(() => {});
	}
});

const jpa = async (slug: string) =>
	createJpa({ name: `Justizprüfungsamt ${slug}`, slug });

/** Pushes a subscriber's confirmation deadline into the past. */
const expireConfirmToken = (email: string) =>
	setup.run("UPDATE subscriber SET confirm_expires_at = ? WHERE email = ?", [
		Date.now() - 1000,
		email,
	]);

test("normalizeEmail folds case and whitespace", () => {
	expect(normalizeEmail("  Philipp@Example.DE ")).toBe("philipp@example.de");
});

test("a pending subscriber is never mailable", async () => {
	const office = await jpa("pending");
	const subscriber = await upsertPendingSubscriber("pending@example.com", null);
	await addEmailSubscription(subscriber.id, office.id);

	expect(subscriber.confirmedAt).toBeNull();
	expect(subscriber.confirmToken).toBeTruthy();
	// The subscription exists — it just earns no mail until confirmed.
	expect(await countEmailSubscriptionsByJpa(office.id)).toBe(1);
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);
});

test("confirming makes the address mailable and consumes the link", async () => {
	const office = await jpa("confirm");
	const pending = await upsertPendingSubscriber(
		"confirm@example.com",
		"1.2.3.4",
	);
	await addEmailSubscription(pending.id, office.id);

	const token = pending.confirmToken as string;
	const confirmed = await confirmSubscriber(token);

	if (!confirmed) throw new Error("expected the confirmation to succeed");

	expect(confirmed.confirmedAt).toBeInstanceOf(Date);
	expect(confirmed.confirmToken).toBeNull();
	expect(confirmed.consentIp).toBe("1.2.3.4");

	const mailable = await getMailableSubscribersByJpa(office.id);
	expect(mailable).toHaveLength(1);
	expect(mailable[0]?.email).toBe("confirm@example.com");
	expect(mailable[0]?.manageToken).toBe(confirmed.manageToken);

	// Single use: the same link must not confirm twice.
	expect(await confirmSubscriber(token)).toBeNull();
});

test("an expired confirmation link is refused", async () => {
	const office = await jpa("expired");
	const pending = await upsertPendingSubscriber("expired@example.com", null);
	await addEmailSubscription(pending.id, office.id);
	expireConfirmToken("expired@example.com");

	expect(await confirmSubscriber(pending.confirmToken as string)).toBeNull();
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);
});

test("one address may subscribe to several JPAs", async () => {
	const first = await jpa("multi-a");
	const second = await jpa("multi-b");

	const pending = await upsertPendingSubscriber("multi@example.com", null);
	await addEmailSubscription(pending.id, first.id);
	await addEmailSubscription(pending.id, second.id);
	// Adding the same pair again is a no-op rather than an error.
	await addEmailSubscription(pending.id, first.id);
	await confirmSubscriber(pending.confirmToken as string);

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
	await confirmSubscriber(pending.confirmToken as string);

	await unsubscribeSubscriber(pending.id);

	// Subscriptions are gone, but the address is remembered so it cannot be
	// silently re-added by anyone typing it into the form.
	const suppressed = await getSubscriberByEmail("unsub@example.com");
	expect(suppressed).not.toBeNull();
	expect(suppressed?.unsubscribedAt).toBeInstanceOf(Date);
	expect(await getSubscriberJpas(pending.id)).toEqual([]);
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);

	// The manage link still resolves, so the page can say "du bist abgemeldet".
	expect(await getSubscriberByManageToken(pending.manageToken)).not.toBeNull();
});

test("a fresh confirmed opt-in supersedes an earlier unsubscribe", async () => {
	const office = await jpa("resub");
	const first = await upsertPendingSubscriber("resub@example.com", null);
	await addEmailSubscription(first.id, office.id);
	await confirmSubscriber(first.confirmToken as string);
	await unsubscribeSubscriber(first.id);

	// Signing up again re-runs double opt-in; only the address owner can finish.
	const again = await upsertPendingSubscriber("resub@example.com", "5.6.7.8");
	await addEmailSubscription(again.id, office.id);
	expect(again.id).toBe(first.id);
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);

	const confirmed = await confirmSubscriber(again.confirmToken as string);
	expect(confirmed?.unsubscribedAt).toBeNull();
	expect(await getMailableSubscribersByJpa(office.id)).toHaveLength(1);
	// The manage token survives, so links in older mail keep working.
	expect(confirmed?.manageToken).toBe(first.manageToken);
});
