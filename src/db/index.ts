import { Database } from "bun:sqlite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { nanoid } from "nanoid";
import * as schema from "./schema.ts";

type JPA = typeof schema.jpa.$inferSelect;
type Subscription = typeof schema.subscription.$inferSelect;
type AdminSession = typeof schema.adminSession.$inferSelect;

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
		createdAt: new Date(),
	};
	await db.insert(schema.jpa).values(jpa);
	return jpa;
};

export const updateJpa = async (
	id: string,
	data: { name?: string; slug?: string; websiteUrl?: string | null },
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

export const getSubscriptionsByJpa = async (
	jpaId: string,
): Promise<Subscription[]> => {
	return db
		.select()
		.from(schema.subscription)
		.where(eq(schema.subscription.jpaId, jpaId))
		.all();
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

export const createSubscription = async (
	deviceId: string,
	jpaId: string,
): Promise<Subscription> => {
	const subscription = {
		id: nanoid(),
		deviceId,
		jpaId,
		ntfyTopic: `examensradar-${nanoid(10)}`,
		setupCompletedAt: null,
		createdAt: new Date(),
	};

	await db.insert(schema.subscription).values(subscription);
	return subscription;
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

export const completeSubscriptionSetup = async (
	subscriptionId: string,
	deviceId: string,
): Promise<void> => {
	await db
		.update(schema.subscription)
		.set({ setupCompletedAt: new Date() })
		.where(
			and(
				eq(schema.subscription.id, subscriptionId),
				eq(schema.subscription.deviceId, deviceId),
			),
		);
};

// Notification log functions
export const logNotification = async (
	jpaId: string,
	subscriberCount: number,
): Promise<void> => {
	await db
		.insert(schema.notificationLog)
		.values({
			id: nanoid(),
			jpaId,
			sentAt: new Date(),
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
