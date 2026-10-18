import { Database } from "bun:sqlite";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { nanoid } from "nanoid";
import { CONFIRM_TTL_HOURS } from "@/lib/mail-templates";
import * as schema from "./schema.ts";

type JPA = typeof schema.jpa.$inferSelect;
type AdminSession = typeof schema.adminSession.$inferSelect;
type Subscriber = typeof schema.subscriber.$inferSelect;

let connection: BunSQLiteDatabase<typeof schema> | undefined;

export const openDatabase = (path: string) => {
	const sqlite = new Database(path);
	sqlite.run("PRAGMA journal_mode = WAL");
	connection = drizzle(sqlite, { schema });
};

// Opens the default database on first query unless openDatabase ran first,
// so importing this module has no side effects.
const db = new Proxy({} as BunSQLiteDatabase<typeof schema>, {
	get: (_, key) => {
		if (!connection) {
			openDatabase(process.env.DATABASE_PATH || "./data/examensradar.db");
		}
		const value = Reflect.get(connection as object, key);
		return typeof value === "function" ? value.bind(connection) : value;
	},
});

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
	scrapeUrl?: string | null;
	scrapeSelector?: string | null;
}): Promise<JPA> => {
	const jpa = {
		id: nanoid(),
		name: data.name,
		slug: data.slug,
		websiteUrl: data.websiteUrl ?? null,
		scrapeUrl: data.scrapeUrl ?? null,
		scrapeSelector: data.scrapeSelector ?? null,
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
		scrapeUrl?: string | null;
		scrapeSelector?: string | null;
		notificationsDisabled?: boolean;
	},
): Promise<void> => {
	await db.update(schema.jpa).set(data).where(eq(schema.jpa.id, id));
};

export const deleteJpa = async (id: string): Promise<void> => {
	await db.delete(schema.jpa).where(eq(schema.jpa.id, id));
};

type ScrapeState = typeof schema.scrapeState.$inferSelect;

export const getScrapableJpas = async (): Promise<JPA[]> => {
	return db
		.select()
		.from(schema.jpa)
		.where(
			and(
				isNotNull(schema.jpa.scrapeUrl),
				isNotNull(schema.jpa.scrapeSelector),
			),
		)
		.all();
};

export const getScrapeStates = async (): Promise<ScrapeState[]> => {
	return db.select().from(schema.scrapeState).all();
};

export const ensureScrapeState = async (
	jpaId: string,
): Promise<ScrapeState> => {
	await db
		.insert(schema.scrapeState)
		.values({ jpaId, contentHash: null, lastCheckedAt: new Date() })
		.onConflictDoNothing();

	const state = await db
		.select()
		.from(schema.scrapeState)
		.where(eq(schema.scrapeState.jpaId, jpaId))
		.get();

	if (!state) throw new Error(`scrape state missing for JPA ${jpaId}`);
	return state;
};

export const claimScrapeBaseline = async (
	jpaId: string,
	hash: string,
): Promise<boolean> => {
	const claimed = await db
		.update(schema.scrapeState)
		.set({
			contentHash: hash,
			lastCheckedAt: new Date(),
			errorCount: 0,
			lastError: null,
		})
		.where(
			and(
				eq(schema.scrapeState.jpaId, jpaId),
				isNull(schema.scrapeState.contentHash),
			),
		)
		.returning()
		.all();

	return claimed.length > 0;
};

export const claimScrapeChange = async (
	jpaId: string,
	oldHash: string,
	newHash: string,
): Promise<boolean> => {
	const now = new Date();
	const claimed = await db
		.update(schema.scrapeState)
		.set({
			contentHash: newHash,
			lastCheckedAt: now,
			lastChangedAt: now,
			errorCount: 0,
			lastError: null,
		})
		.where(
			and(
				eq(schema.scrapeState.jpaId, jpaId),
				eq(schema.scrapeState.contentHash, oldHash),
			),
		)
		.returning()
		.all();

	return claimed.length > 0;
};

export const dropScrapeBaseline = async (jpaId: string): Promise<void> => {
	await db
		.delete(schema.scrapeState)
		.where(eq(schema.scrapeState.jpaId, jpaId));
};

export const recordScrapeSuccess = async (jpaId: string): Promise<void> => {
	await db
		.update(schema.scrapeState)
		.set({ lastCheckedAt: new Date(), errorCount: 0, lastError: null })
		.where(eq(schema.scrapeState.jpaId, jpaId));
};

export const recordScrapeError = async (
	jpaId: string,
	message: string,
): Promise<void> => {
	await db
		.update(schema.scrapeState)
		.set({
			lastCheckedAt: new Date(),
			errorCount: sql`${schema.scrapeState.errorCount} + 1`,
			lastError: message,
		})
		.where(eq(schema.scrapeState.jpaId, jpaId));
};

export const getSubscriptionCountsByJpa = async (): Promise<
	Map<string, number>
> => {
	const rows = await db
		.select({
			jpaId: schema.emailSubscription.jpaId,
			count: sql<number>`count(*)`,
		})
		.from(schema.emailSubscription)
		.innerJoin(
			schema.subscriber,
			eq(schema.emailSubscription.subscriberId, schema.subscriber.id),
		)
		.where(
			and(
				isNotNull(schema.subscriber.confirmedAt),
				isNull(schema.subscriber.unsubscribedAt),
				isNull(schema.subscriber.bouncedAt),
			),
		)
		.groupBy(schema.emailSubscription.jpaId)
		.all();
	return new Map(rows.map((row) => [row.jpaId, row.count]));
};

const newToken = () => nanoid(32);

export const normalizeEmail = (email: string): string =>
	email.trim().toLowerCase();

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
		confirmExpiresAt: new Date(
			now.getTime() + CONFIRM_TTL_HOURS * 60 * 60 * 1000,
		),
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

export type ConfirmTokenState =
	| { state: "pending" | "confirmed"; subscriber: Subscriber }
	| { state: "invalid"; subscriber: null };

export const classifyConfirmToken = async (
	token: string,
): Promise<ConfirmTokenState> => {
	const subscriber = await getSubscriberByConfirmToken(token);
	if (!subscriber) return { state: "invalid", subscriber: null };

	if (!subscriber.confirmedAt) {
		const expired =
			subscriber.confirmExpiresAt &&
			subscriber.confirmExpiresAt.getTime() < Date.now();
		return expired
			? { state: "invalid", subscriber: null }
			: { state: "pending", subscriber };
	}

	return isActiveSubscriber(subscriber)
		? { state: "confirmed", subscriber }
		: { state: "invalid", subscriber: null };
};

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

	return confirmed;
};

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
): Promise<void> => {
	await db
		.insert(schema.emailSubscription)
		.values({ id: nanoid(), subscriberId, jpaId, createdAt: new Date() })
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

export const logNotification = async (
	jpaId: string,
	subscriberCount: number,
	publishedAt: Date = new Date(),
): Promise<void> => {
	await db
		.insert(schema.notificationLog)
		.values({
			id: nanoid(),
			jpaId,
			sentAt: publishedAt,
			subscriberCount,
		})
		.run();
};

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
