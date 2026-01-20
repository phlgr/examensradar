import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { nanoid } from "nanoid";
import * as schema from "./schema.ts";

export type User = typeof schema.user.$inferSelect;
export type JPA = typeof schema.jpa.$inferSelect;
export type Subscription = typeof schema.subscription.$inferSelect;
export type NotificationLog = typeof schema.notificationLog.$inferSelect;

export const db = drizzle(env.DB, { schema });

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

export const getUserSubscriptions = async (
	userId: string,
): Promise<Subscription[]> => {
	return db
		.select()
		.from(schema.subscription)
		.where(eq(schema.subscription.userId, userId))
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

export const createSubscription = async (
	userId: string,
	jpaId: string,
): Promise<Subscription> => {
	const subscription = {
		id: nanoid(),
		userId,
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
	userId: string,
): Promise<void> => {
	await db
		.delete(schema.subscription)
		.where(
			and(
				eq(schema.subscription.id, id),
				eq(schema.subscription.userId, userId),
			),
		);
};

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

export const getUserById = async (userId: string): Promise<User | null> => {
	return (
		(await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.get()) || null
	);
};

export const updateUserOnboardingStatus = async (
	userId: string,
	completedAt: Date,
): Promise<void> => {
	await db
		.update(schema.user)
		.set({ ntfyOnboardingCompletedAt: completedAt })
		.where(eq(schema.user.id, userId));
};

export const completeSubscriptionSetup = async (
	subscriptionId: string,
	userId: string,
): Promise<void> => {
	await db
		.update(schema.subscription)
		.set({ setupCompletedAt: new Date() })
		.where(
			and(
				eq(schema.subscription.id, subscriptionId),
				eq(schema.subscription.userId, userId),
			),
		);
};

export const getSubscriptionById = async (
	id: string,
	userId: string,
): Promise<Subscription | null> => {
	return (
		(await db
			.select()
			.from(schema.subscription)
			.where(
				and(
					eq(schema.subscription.id, id),
					eq(schema.subscription.userId, userId),
				),
			)
			.get()) || null
	);
};

export const deleteUser = async (userId: string): Promise<void> => {
	// Subscriptions, sessions, and accounts will be cascade deleted due to foreign key constraints
	await db.delete(schema.user).where(eq(schema.user.id, userId));
};
