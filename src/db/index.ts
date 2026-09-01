import { Database } from "bun:sqlite";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { nanoid } from "nanoid";
import * as schema from "./schema.ts";

type JPA = typeof schema.jpa.$inferSelect;
type Subscription = typeof schema.subscription.$inferSelect;
type AdminSession = typeof schema.adminSession.$inferSelect;
type Subscriber = typeof schema.subscriber.$inferSelect;

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/examensradar.db";

const sqlite = new Database(DATABASE_PATH);
sqlite.run("PRAGMA journal_mode = WAL");

const db = drizzle(sqlite, { schema });

// JPA functions
export const getJpas = async (): Promise<JPA[]> => {
	return db.select().from(schema.jpa).all();
};

export const getJpaBySlug = async (slug: string): Promise<JPA | null> => {
	const result = await db
		.select()
		.from(schema.jpa)
		.where(eq(schema.jpa.slug, slug))
		.get();
	return result || null;
};

export const getJpaById = async (id: string): Promise<JPA | null> => {
	const result = await db
		.select()
		.from(schema.jpa)
		.where(eq(schema.jpa.id, id))
		.get();
	return result || null;
};

export const createJpa = async (data: {
	name: string;
	slug: string;
	websiteUrl?: string | null;
}): Promise<JPA> => {
	const jpa = {
		id: nanoid(),
		name: data.name,
		slug: data.slug,
		websiteUrl: data.websiteUrl ?? null,
		notificationsDisabled: false,
		createdAt: new Date(),
	};
	await db.insert(schema.jpa).values(jpa);
	return jpa;
};

export const updateJpa = async (
	id: string,
	data: {
		name?: string;
		slug?: string;
		websiteUrl?: string | null;
		notificationsDisabled?: boolean;
	},
): Promise<void> => {
	await db.update(schema.jpa).set(data).where(eq(schema.jpa.id, id));
};

export const deleteJpa = async (id: string): Promise<void> => {
	await db.delete(schema.jpa).where(eq(schema.jpa.id, id));
};

// Subscription functions (now using deviceId instead of userId)
export const getDeviceSubscriptions = async (
	deviceId: string,
): Promise<Subscription[]> => {
	return db
		.select()
		.from(schema.subscription)
		.where(eq(schema.subscription.deviceId, deviceId))
		.all();
};

/**
 * Subscriptions for a JPA that are worth pushing to.
 *
 * Publishing to a topic nobody ever subscribed to in the ntfy app still costs a
 * request against ntfy.sh's per-IP burst limit, and on 2026-08-31 that waste is
 * what caused a third of a real result notification to be dropped. So we only
 * notify devices that have proven they can receive pushes.
 *
 * A subscription qualifies if it completed setup itself, OR if the same device
 * completed setup on any other subscription — a device that verified once is
 * demonstrably reachable, even if it skipped the code entry the second time.
 */
export const getNotifiableSubscriptionsByJpa = async (
	jpaId: string,
): Promise<Subscription[]> => {
	const verifiedDevices = db
		.select({ deviceId: schema.subscription.deviceId })
		.from(schema.subscription)
		.where(isNotNull(schema.subscription.setupCompletedAt));

	return db
		.select()
		.from(schema.subscription)
		.where(
			and(
				eq(schema.subscription.jpaId, jpaId),
				or(
					isNotNull(schema.subscription.setupCompletedAt),
					inArray(schema.subscription.deviceId, verifiedDevices),
				),
			),
		)
		.all();
};

export const countSubscriptionsByJpa = async (
	jpaId: string,
): Promise<number> => {
	return db
		.select()
		.from(schema.subscription)
		.where(eq(schema.subscription.jpaId, jpaId))
		.all().length;
};

export const getSubscriptionCountsByJpa = async (): Promise<
	Map<string, number>
> => {
	const subscriptions = await db.select().from(schema.subscription).all();
	const counts = new Map<string, number>();
	for (const sub of subscriptions) {
		counts.set(sub.jpaId, (counts.get(sub.jpaId) ?? 0) + 1);
	}
	return counts;
};

export const deleteSubscription = async (
	id: string,
	deviceId: string,
): Promise<void> => {
	await db
		.delete(schema.subscription)
		.where(
			and(
				eq(schema.subscription.id, id),
				eq(schema.subscription.deviceId, deviceId),
			),
		);
};

// Email subscriber functions
/**
 * Deliberately short: a confirm link that leaks later — scanner logs, a
 * forwarded mail — should already be dead, and whoever misses the window just
 * signs up again for a fresh link. The "15 Minuten" copy in
 * `renderConfirmMail` must match this value.
 */
const CONFIRM_TTL_MS = 15 * 60 * 1000;

const newToken = () => nanoid(32);

/** Uniqueness has to be on the real address, not on how it was typed. */
export const normalizeEmail = (email: string): string =>
	email.trim().toLowerCase();

/** Confirmed and not suppressed — the only state that may receive results mail. */
export const isActiveSubscriber = (
	subscriber: Pick<Subscriber, "confirmedAt" | "unsubscribedAt" | "bouncedAt">,
): boolean =>
	Boolean(
		subscriber.confirmedAt &&
			!subscriber.unsubscribedAt &&
			!subscriber.bouncedAt,
	);

export const getSubscriberByEmail = async (
	email: string,
): Promise<Subscriber | null> => {
	const result = await db
		.select()
		.from(schema.subscriber)
		.where(eq(schema.subscriber.email, email))
		.get();
	return result || null;
};

export const getSubscriberByManageToken = async (
	token: string,
): Promise<Subscriber | null> => {
	const result = await db
		.select()
		.from(schema.subscriber)
		.where(eq(schema.subscriber.manageToken, token))
		.get();
	return result || null;
};

/**
 * Looks up by the credential published via List-Unsubscribe. Callers must only
 * ever unsubscribe with the result — this token deliberately grants nothing
 * else, because Gmail and mail scanners get to see it.
 */
export const getSubscriberByUnsubscribeToken = async (
	token: string,
): Promise<Subscriber | null> => {
	const result = await db
		.select()
		.from(schema.subscriber)
		.where(eq(schema.subscriber.unsubscribeToken, token))
		.get();
	return result || null;
};

/**
 * Creates a pending subscriber, or puts an existing one back into pending with
 * a fresh token. Re-running double opt-in is what makes it safe to reset a
 * subscriber who had unsubscribed or hard-bounced: only the address owner can
 * complete it.
 *
 * Clearing `confirmedAt` is what makes "pending" a real row state: /confirm
 * can tell an unused link from a used one without comparing timestamps. The
 * suppression flags stay untouched until the new confirmation lands, so an
 * abandoned re-signup never erases an opt-out. Refuses an active subscriber —
 * resetting one to pending would silently stop their mail.
 */
export const upsertPendingSubscriber = async (
	email: string,
	ip: string | null,
): Promise<Subscriber & { confirmToken: string }> => {
	const now = new Date();
	const existing = await getSubscriberByEmail(email);

	if (existing && isActiveSubscriber(existing)) {
		throw new Error("refusing to reset an active subscriber to pending");
	}

	const pending = {
		confirmToken: newToken(),
		confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
		confirmedAt: null,
		consentIp: ip,
		consentAt: now,
	};

	if (existing) {
		const updated = await db
			.update(schema.subscriber)
			.set(pending)
			.where(eq(schema.subscriber.id, existing.id))
			.returning()
			.get();
		return { ...updated, confirmToken: pending.confirmToken };
	}

	const subscriber = {
		id: nanoid(),
		email,
		manageToken: newToken(),
		unsubscribeToken: newToken(),
		...pending,
		bouncedAt: null,
		unsubscribedAt: null,
		createdAt: now,
	};

	await db.insert(schema.subscriber).values(subscriber);
	return subscriber;
};

/**
 * Retires the ntfy subscriptions that this address has just taken over, so a
 * publication cannot arrive twice — once as a push and once as a mail.
 *
 * Deliberately runs at confirmation rather than signup: dropping a working
 * channel before the replacement is proven would leave anyone who mistypes their
 * address, or never clicks, with no notifications at all. Scoped to the JPAs
 * actually being replaced, so migrating one office never silently ends the push
 * for another.
 *
 * Returns how many were retired, for the log.
 */
const retireSupersededNtfySubscriptions = async (
	subscriberId: string,
): Promise<number> => {
	const replacements = await db
		.select({
			jpaId: schema.emailSubscription.jpaId,
			deviceId: schema.emailSubscription.deviceId,
		})
		.from(schema.emailSubscription)
		.where(
			and(
				eq(schema.emailSubscription.subscriberId, subscriberId),
				isNotNull(schema.emailSubscription.deviceId),
			),
		)
		.all();

	let retired = 0;

	for (const { jpaId, deviceId } of replacements) {
		if (!deviceId) continue;

		const deleted = await db
			.delete(schema.subscription)
			.where(
				and(
					eq(schema.subscription.deviceId, deviceId),
					eq(schema.subscription.jpaId, jpaId),
				),
			)
			.returning()
			.all();

		retired += deleted.length;
	}

	return retired;
};

const getSubscriberByConfirmToken = async (
	token: string,
): Promise<Subscriber | null> => {
	const result = await db
		.select()
		.from(schema.subscriber)
		.where(eq(schema.subscriber.confirmToken, token))
		.get();
	return result || null;
};

/**
 * The one classifier for confirm links, shared by what /confirm renders and
 * what confirming checks, so the two can never disagree.
 *
 * `pending` — the link is live and awaiting its button press.
 * `confirmed` — the link was used and the subscriber is active. Reopening a
 *   used link is not an error, but it grants nothing: the manage credential
 *   only ever travels through the confirm mutation's pending → active
 *   transition, never to whoever replays a used link later.
 * `invalid` — unknown or rotated token, expired, or a used link whose
 *   subscriber has since opted out: an old mail must never undo that.
 */
export type ConfirmTokenState =
	| { state: "pending" | "confirmed"; subscriber: Subscriber }
	| { state: "invalid"; subscriber: null };

export const classifyConfirmToken = async (
	token: string,
): Promise<ConfirmTokenState> => {
	const subscriber = await getSubscriberByConfirmToken(token);
	const expired =
		subscriber?.confirmExpiresAt &&
		subscriber.confirmExpiresAt.getTime() < Date.now();

	if (!subscriber || expired) return { state: "invalid", subscriber: null };
	if (!subscriber.confirmedAt) return { state: "pending", subscriber };

	return isActiveSubscriber(subscriber)
		? { state: "confirmed", subscriber }
		: { state: "invalid", subscriber: null };
};

/**
 * Completes double opt-in for a `pending` link. Clearing
 * `unsubscribedAt`/`bouncedAt` is the point: a fresh confirmed opt-in
 * supersedes an earlier suppression, and only the address owner can produce
 * one.
 *
 * The token is kept after use (it rotates on every signup and dies with
 * `confirmExpiresAt` anyway) so /confirm can recognize an already-used link —
 * but a used link is inert: anything except `pending` is refused here.
 */
export const confirmSubscriber = async (
	token: string,
): Promise<Subscriber | null> => {
	const { state, subscriber } = await classifyConfirmToken(token);
	if (state !== "pending") return null;

	const confirmed = await db
		.update(schema.subscriber)
		.set({
			confirmedAt: new Date(),
			unsubscribedAt: null,
			bouncedAt: null,
		})
		.where(eq(schema.subscriber.id, subscriber.id))
		.returning()
		.get();

	// Retired here rather than by the caller so that "confirmed" and "no longer
	// double-notified" cannot drift apart.
	await retireSupersededNtfySubscriptions(subscriber.id);

	return confirmed;
};

/**
 * Keeps the subscriber row as a suppression record and drops what it subscribed
 * to. Deleting the row would let the address be re-added by anyone typing it in.
 */
export const unsubscribeSubscriber = async (id: string): Promise<void> => {
	await db
		.delete(schema.emailSubscription)
		.where(eq(schema.emailSubscription.subscriberId, id));

	await db
		.update(schema.subscriber)
		.set({ unsubscribedAt: new Date() })
		.where(eq(schema.subscriber.id, id));
};

export const addEmailSubscription = async (
	subscriberId: string,
	jpaId: string,
	deviceId: string | null = null,
): Promise<void> => {
	await db
		.insert(schema.emailSubscription)
		.values({
			id: nanoid(),
			subscriberId,
			jpaId,
			deviceId,
			createdAt: new Date(),
		})
		.onConflictDoNothing();
};

export const removeEmailSubscription = async (
	subscriberId: string,
	jpaId: string,
): Promise<void> => {
	await db
		.delete(schema.emailSubscription)
		.where(
			and(
				eq(schema.emailSubscription.subscriberId, subscriberId),
				eq(schema.emailSubscription.jpaId, jpaId),
			),
		);
};

export const getSubscriberJpas = async (subscriberId: string) => {
	return db
		.select({
			jpaId: schema.jpa.id,
			jpaName: schema.jpa.name,
			jpaSlug: schema.jpa.slug,
			createdAt: schema.emailSubscription.createdAt,
		})
		.from(schema.emailSubscription)
		.innerJoin(schema.jpa, eq(schema.emailSubscription.jpaId, schema.jpa.id))
		.where(eq(schema.emailSubscription.subscriberId, subscriberId))
		.all();
};

/**
 * Addresses worth sending a results notification to: confirmed, still
 * subscribed, and not suppressed. Everything the fan-out needs, so it never has
 * to decide mailability itself.
 */
export const getMailableSubscribersByJpa = async (
	jpaId: string,
): Promise<
	{ email: string; manageToken: string; unsubscribeToken: string }[]
> => {
	return db
		.select({
			email: schema.subscriber.email,
			manageToken: schema.subscriber.manageToken,
			unsubscribeToken: schema.subscriber.unsubscribeToken,
		})
		.from(schema.emailSubscription)
		.innerJoin(
			schema.subscriber,
			eq(schema.emailSubscription.subscriberId, schema.subscriber.id),
		)
		.where(
			and(
				eq(schema.emailSubscription.jpaId, jpaId),
				isNotNull(schema.subscriber.confirmedAt),
				isNull(schema.subscriber.unsubscribedAt),
				isNull(schema.subscriber.bouncedAt),
			),
		)
		.all();
};

export const countEmailSubscriptionsByJpa = async (
	jpaId: string,
): Promise<number> => {
	return db
		.select()
		.from(schema.emailSubscription)
		.where(eq(schema.emailSubscription.jpaId, jpaId))
		.all().length;
};

export const getNotificationHistory = async () => {
	return db
		.select({
			sentAt: schema.notificationLog.sentAt,
			jpaName: schema.jpa.name,
			jpaSlug: schema.jpa.slug,
			jpaWebsiteUrl: schema.jpa.websiteUrl,
		})
		.from(schema.notificationLog)
		.leftJoin(schema.jpa, eq(schema.notificationLog.jpaId, schema.jpa.id))
		.orderBy(desc(schema.notificationLog.sentAt))
		.limit(500)
		.all();
};

// Notification log functions
/**
 * `sentAt` is passed in rather than taken as `now` because the fan-out runs in
 * the background and can spend minutes backing off. /history derives publication
 * day/hour patterns from this column, so it has to record when the office
 * published, not when we finished delivering.
 */
export const logNotification = async (
	jpaId: string,
	subscriberCount: number,
	sentAt: Date = new Date(),
): Promise<void> => {
	await db
		.insert(schema.notificationLog)
		.values({
			id: nanoid(),
			jpaId,
			sentAt,
			subscriberCount,
		})
		.run();
};

// Admin session functions
export const createAdminSession = async (
	token: string,
	expiresAt: Date,
): Promise<AdminSession> => {
	const session = {
		id: nanoid(),
		token,
		expiresAt,
		createdAt: new Date(),
	};
	await db.insert(schema.adminSession).values(session);
	return session;
};

export const getAdminSessionByToken = async (
	token: string,
): Promise<AdminSession | null> => {
	const result = await db
		.select()
		.from(schema.adminSession)
		.where(eq(schema.adminSession.token, token))
		.get();
	return result || null;
};

export const deleteAdminSession = async (token: string): Promise<void> => {
	await db
		.delete(schema.adminSession)
		.where(eq(schema.adminSession.token, token));
};
