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

test("manage and unsubscribe tokens are distinct credentials", async () => {
	const subscriber = await upsertPendingSubscriber("tokens@example.com", null);

	// The unsubscribe token is published via List-Unsubscribe, so it must not be
	// usable to read or alter the subscription.
	expect(subscriber.unsubscribeToken).toBeTruthy();
	expect(subscriber.unsubscribeToken).not.toBe(subscriber.manageToken);
	expect(
		await getSubscriberByManageToken(subscriber.unsubscribeToken),
	).toBeNull();
});

test("confirming retires only the superseded ntfy subscription", async () => {
	const migrated = await jpa("retire-migrated");
	const untouched = await jpa("retire-untouched");
	const deviceId = crypto.randomUUID();

	// The device already receives pushes for both offices.
	for (const office of [migrated, untouched]) {
		setup.run(
			"INSERT INTO subscription (id, device_id, jpa_id, ntfy_topic, setup_completed_at, created_at) VALUES (?,?,?,?,?,?)",
			[
				`sub-${office.slug}`,
				deviceId,
				office.id,
				`examensradar-${office.slug}`,
				Date.now(),
				Date.now(),
			],
		);
	}

	// It signs up by mail for one of them only.
	const pending = await upsertPendingSubscriber("retire@example.com", null);
	await addEmailSubscription(pending.id, migrated.id, deviceId);

	const remaining = () =>
		(
			setup
				.query("SELECT jpa_id FROM subscription WHERE device_id = ?")
				.all(deviceId) as { jpa_id: string }[]
		).map((row) => row.jpa_id);

	// Nothing is retired before the address is proven — dropping a working
	// channel for an unconfirmed one would leave them with neither.
	expect(remaining().sort()).toEqual([migrated.id, untouched.id].sort());

	await confirmSubscriber(pending.confirmToken as string);

	// Only the office now covered by mail loses its push.
	expect(remaining()).toEqual([untouched.id]);
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
	// Kept, so /confirm can recognize an already-used link.
	expect(confirmed.confirmToken).toBe(token);
	expect(confirmed.consentIp).toBe("1.2.3.4");

	const mailable = await getMailableSubscribersByJpa(office.id);
	expect(mailable).toHaveLength(1);
	expect(mailable[0]?.email).toBe("confirm@example.com");
	expect(mailable[0]?.manageToken).toBe(confirmed.manageToken);

	// A re-click is a no-op that still reports success.
	const again = await confirmSubscriber(token);
	expect(again?.id).toBe(confirmed.id);
	expect(again?.confirmedAt?.getTime()).toBe(confirmed.confirmedAt?.getTime());
});

test("a stale confirm link cannot undo a later unsubscribe", async () => {
	const office = await jpa("stale-link");
	const pending = await upsertPendingSubscriber("stale@example.com", null);
	await addEmailSubscription(pending.id, office.id);

	const token = pending.confirmToken as string;
	const confirmed = await confirmSubscriber(token);
	if (!confirmed) throw new Error("expected the confirmation to succeed");

	await unsubscribeSubscriber(confirmed.id);
	// The guard compares millisecond timestamps; make the ordering explicit so
	// a fast test run cannot land both writes in the same tick.
	setup.run(
		"UPDATE subscriber SET unsubscribed_at = consent_at + 5 WHERE email = ?",
		["stale@example.com"],
	);

	// The link predates the opt-out, so it must be refused outright.
	expect(await confirmSubscriber(token)).toBeNull();
	expect(await getMailableSubscribersByJpa(office.id)).toEqual([]);
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
