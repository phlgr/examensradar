import { Database } from "bun:sqlite";
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	lte,
	min,
	sql,
} from "drizzle-orm";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { normalizeEmail } from "@/lib/email";
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
		id: crypto.randomUUID(),
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
): Promise<JPA | null> => {
	const updated = await db
		.update(schema.jpa)
		.set(data)
		.where(eq(schema.jpa.id, id))
		.returning()
		.get();
	return updated ?? null;
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

export type ScrapeChangeClaim =
	| { kind: "lost" }
	| { kind: "paused" }
	| { kind: "queued"; releaseId: string; mail: number };

/**
 * Wins the compare-and-swap on the content hash and, in the same transaction,
 * records the release and queues one mail per active subscriber. A crash can
 * therefore neither lose a claimed change nor leave a release half-queued.
 */
export const claimScrapeChange = async (
	jpaId: string,
	oldHash: string,
	newHash: string,
	{ notify }: { notify: boolean },
): Promise<ScrapeChangeClaim> => {
	return db.transaction((tx) => {
		const now = new Date();
		const claimed = tx
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

		if (claimed.length === 0) return { kind: "lost" };
		if (!notify) return { kind: "paused" };

		const recipients = tx
			.select({ id: schema.subscriber.id })
			.from(schema.emailSubscription)
			.innerJoin(
				schema.subscriber,
				eq(schema.emailSubscription.subscriberId, schema.subscriber.id),
			)
			.where(and(eq(schema.emailSubscription.jpaId, jpaId), activeSubscriber))
			.all();

		const releaseId = crypto.randomUUID();
		tx.insert(schema.notificationLog)
			.values({
				id: releaseId,
				jpaId,
				sentAt: now,
				subscriberCount: recipients.length,
			})
			.run();

		if (recipients.length > 0) {
			tx.insert(schema.mailOutbox)
				.values(
					recipients.map(({ id }) => ({
						id: crypto.randomUUID(),
						releaseId,
						subscriberId: id,
						nextAttemptAt: now,
						createdAt: now,
					})),
				)
				.run();
		}

		return { kind: "queued", releaseId, mail: recipients.length };
	});
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
		.where(activeSubscriber)
		.groupBy(schema.emailSubscription.jpaId)
		.all();
	return new Map(rows.map((row) => [row.jpaId, row.count]));
};

const newToken = () => crypto.randomUUID();

export type SubscriberStatus =
	| "pending"
	| "active"
	| "unsubscribed"
	| "bounced";

/** A re-opt-in after unsubscribing is pending again until confirmed. */
export const subscriberStatus = (
	subscriber: Pick<Subscriber, "confirmedAt" | "unsubscribedAt" | "bouncedAt">,
): SubscriberStatus => {
	if (!subscriber.confirmedAt) return "pending";
	if (subscriber.bouncedAt) return "bounced";
	if (subscriber.unsubscribedAt) return "unsubscribed";
	return "active";
};

/** SQL form of `subscriberStatus(...) === "active"`; keep the two in sync. */
const activeSubscriber = and(
	isNotNull(schema.subscriber.confirmedAt),
	isNull(schema.subscriber.unsubscribedAt),
	isNull(schema.subscriber.bouncedAt),
);

export const getSubscriberByEmail = async (
	email: string,
): Promise<Subscriber | null> => {
	const result = await db
		.select()
		.from(schema.subscriber)
		.where(eq(schema.subscriber.email, normalizeEmail(email)))
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
	/** Pass the row the caller already loaded to skip a second lookup. */
	known?: Subscriber | null,
): Promise<Subscriber & { confirmToken: string }> => {
	const now = new Date();
	const existing =
		known === undefined ? await getSubscriberByEmail(email) : known;

	if (existing && subscriberStatus(existing) === "active") {
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
		id: crypto.randomUUID(),
		email: normalizeEmail(email),
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

	switch (subscriberStatus(subscriber)) {
		case "pending": {
			const expired =
				subscriber.confirmExpiresAt &&
				subscriber.confirmExpiresAt.getTime() < Date.now();
			return expired
				? { state: "invalid", subscriber: null }
				: { state: "pending", subscriber };
		}
		case "active":
			return { state: "confirmed", subscriber };
		default:
			return { state: "invalid", subscriber: null };
	}
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
	// One transaction: a single WAL commit instead of two, and no window where
	// the subscriptions are gone but the subscriber still reads as active.
	db.transaction((tx) => {
		tx.delete(schema.emailSubscription)
			.where(eq(schema.emailSubscription.subscriberId, id))
			.run();
		tx.update(schema.subscriber)
			.set({ unsubscribedAt: new Date() })
			.where(eq(schema.subscriber.id, id))
			.run();
	});
};

export const addEmailSubscription = async (
	subscriberId: string,
	jpaId: string,
): Promise<void> => {
	await db
		.insert(schema.emailSubscription)
		.values({
			id: crypto.randomUUID(),
			subscriberId,
			jpaId,
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
		.where(and(eq(schema.emailSubscription.jpaId, jpaId), activeSubscriber))
		.all();
};

export const countEmailSubscriptionsByJpa = async (
	jpaId: string,
): Promise<number> => {
	const row = await db
		.select({ count: sql<number>`count(*)` })
		.from(schema.emailSubscription)
		.where(eq(schema.emailSubscription.jpaId, jpaId))
		.get();
	return row?.count ?? 0;
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

/**
 * Pushes the due rows' next attempt past the lease in the same statement that
 * picks them, so a second process (an old and a new container overlapping
 * during a deploy) cannot take the same mail. A worker that dies mid-lease
 * leaves its rows due again once the lease runs out.
 */
export const leaseDueMails = async (
	now: Date,
	limit: number,
	leaseMs: number,
) => {
	const due = and(
		eq(schema.mailOutbox.status, "pending"),
		lte(schema.mailOutbox.nextAttemptAt, now),
	);
	const leased = await db
		.update(schema.mailOutbox)
		.set({ nextAttemptAt: new Date(now.getTime() + leaseMs) })
		.where(
			and(
				due,
				inArray(
					schema.mailOutbox.id,
					db
						.select({ id: schema.mailOutbox.id })
						.from(schema.mailOutbox)
						.where(due)
						.orderBy(asc(schema.mailOutbox.nextAttemptAt))
						.limit(limit),
				),
			),
		)
		.returning({ id: schema.mailOutbox.id })
		.all();

	if (leased.length === 0) return [];

	const rows = await db
		.select({
			id: schema.mailOutbox.id,
			attempts: schema.mailOutbox.attempts,
			email: schema.subscriber.email,
			manageToken: schema.subscriber.manageToken,
			unsubscribeToken: schema.subscriber.unsubscribeToken,
			confirmedAt: schema.subscriber.confirmedAt,
			unsubscribedAt: schema.subscriber.unsubscribedAt,
			bouncedAt: schema.subscriber.bouncedAt,
			jpaName: schema.jpa.name,
			websiteUrl: schema.jpa.websiteUrl,
		})
		.from(schema.mailOutbox)
		.innerJoin(
			schema.subscriber,
			eq(schema.mailOutbox.subscriberId, schema.subscriber.id),
		)
		.innerJoin(
			schema.notificationLog,
			eq(schema.mailOutbox.releaseId, schema.notificationLog.id),
		)
		.leftJoin(schema.jpa, eq(schema.notificationLog.jpaId, schema.jpa.id))
		.where(
			inArray(
				schema.mailOutbox.id,
				leased.map(({ id }) => id),
			),
		)
		.all();

	return rows.map(({ confirmedAt, unsubscribedAt, bouncedAt, ...row }) => ({
		...row,
		active:
			subscriberStatus({ confirmedAt, unsubscribedAt, bouncedAt }) === "active",
	}));
};

export type MailOutcome =
	| { kind: "sent" }
	| { kind: "skipped" }
	| { kind: "retry"; at: Date; error: string }
	| { kind: "failed"; error: string };

/** Only touches rows still pending, so settling twice is a no-op. */
export const settleMail = async (
	id: string,
	outcome: MailOutcome,
): Promise<void> => {
	const attempted = { attempts: sql`${schema.mailOutbox.attempts} + 1` };

	const change = (() => {
		switch (outcome.kind) {
			case "sent":
				return { ...attempted, status: "sent", sentAt: new Date() } as const;
			case "skipped":
				return { status: "skipped" } as const;
			case "retry":
				return {
					...attempted,
					nextAttemptAt: outcome.at,
					lastError: outcome.error,
				};
			case "failed":
				return {
					...attempted,
					status: "failed",
					lastError: outcome.error,
				} as const;
		}
	})();

	await db
		.update(schema.mailOutbox)
		.set(change)
		.where(
			and(
				eq(schema.mailOutbox.id, id),
				eq(schema.mailOutbox.status, "pending"),
			),
		);
};

export const getNextMailAttemptAt = async (): Promise<Date | null> => {
	const row = await db
		.select({ at: min(schema.mailOutbox.nextAttemptAt) })
		.from(schema.mailOutbox)
		.where(eq(schema.mailOutbox.status, "pending"))
		.get();
	return row?.at ?? null;
};

export const createAdminSession = async (
	token: string,
	expiresAt: Date,
): Promise<AdminSession> => {
	const session = {
		id: crypto.randomUUID(),
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
