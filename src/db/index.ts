import type { D1Database } from "@cloudflare/workers-types";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createDrizzleDB } from "@/lib/db";
import * as schema from "./schema";

export type User = typeof schema.user.$inferSelect;
export type JPA = typeof schema.jpa.$inferSelect;
export type Subscription = typeof schema.subscription.$inferSelect;
export type NotificationLog = typeof schema.notificationLog.$inferSelect;

export const db = {
	async getJpas(d1: D1Database): Promise<JPA[]> {
		const drizzle = createDrizzleDB(d1);
		return drizzle.select().from(schema.jpa).all();
	},

	async getJpaBySlug(d1: D1Database, slug: string): Promise<JPA | null> {
		const drizzle = createDrizzleDB(d1);
		const result = await drizzle
			.select()
			.from(schema.jpa)
			.where(eq(schema.jpa.slug, slug))
			.get();
		return result || null;
	},

	async getUserSubscriptions(
		d1: D1Database,
		userId: string,
	): Promise<Subscription[]> {
		const drizzle = createDrizzleDB(d1);
		return drizzle
			.select()
			.from(schema.subscription)
			.where(eq(schema.subscription.userId, userId))
			.all();
	},

	async getSubscriptionsByJpa(
		d1: D1Database,
		jpaId: string,
	): Promise<Subscription[]> {
		const drizzle = createDrizzleDB(d1);
		return drizzle
			.select()
			.from(schema.subscription)
			.where(eq(schema.subscription.jpaId, jpaId))
			.all();
	},

	async createSubscription(
		d1: D1Database,
		userId: string,
		jpaId: string,
	): Promise<Subscription> {
		const drizzle = createDrizzleDB(d1);
		const subscription = {
			id: nanoid(),
			userId,
			jpaId,
			ntfyTopic: `examensradar-${nanoid(10)}`,
			setupCompletedAt: null,
			createdAt: new Date(),
		};

		await drizzle.insert(schema.subscription).values(subscription).run();
		return subscription;
	},

	async deleteSubscription(
		d1: D1Database,
		id: string,
		userId: string,
	): Promise<void> {
		const drizzle = createDrizzleDB(d1);
		await drizzle
			.delete(schema.subscription)
			.where(
				and(
					eq(schema.subscription.id, id),
					eq(schema.subscription.userId, userId),
				),
			)
			.run();
	},

	async logNotification(
		d1: D1Database,
		jpaId: string,
		subscriberCount: number,
	): Promise<void> {
		const drizzle = createDrizzleDB(d1);
		await drizzle
			.insert(schema.notificationLog)
			.values({
				id: nanoid(),
				jpaId,
				sentAt: new Date(),
				subscriberCount,
			})
			.run();
	},

	async getUserById(d1: D1Database, userId: string): Promise<User | null> {
		const drizzle = createDrizzleDB(d1);
		const result = await drizzle
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.get();
		return result || null;
	},

	async updateUserOnboardingStatus(
		d1: D1Database,
		userId: string,
		completedAt: Date,
	): Promise<void> {
		const drizzle = createDrizzleDB(d1);
		await drizzle
			.update(schema.user)
			.set({ ntfyOnboardingCompletedAt: completedAt })
			.where(eq(schema.user.id, userId))
			.run();
	},

	async completeSubscriptionSetup(
		d1: D1Database,
		subscriptionId: string,
		userId: string,
	): Promise<void> {
		const drizzle = createDrizzleDB(d1);
		await drizzle
			.update(schema.subscription)
			.set({ setupCompletedAt: new Date() })
			.where(
				and(
					eq(schema.subscription.id, subscriptionId),
					eq(schema.subscription.userId, userId),
				),
			)
			.run();
	},

	async getSubscriptionById(
		d1: D1Database,
		id: string,
		userId: string,
	): Promise<Subscription | null> {
		const drizzle = createDrizzleDB(d1);
		const result = await drizzle
			.select()
			.from(schema.subscription)
			.where(
				and(
					eq(schema.subscription.id, id),
					eq(schema.subscription.userId, userId),
				),
			)
			.get();
		return result || null;
	},

	async deleteUser(d1: D1Database, userId: string): Promise<void> {
		const drizzle = createDrizzleDB(d1);
		// Subscriptions, sessions, and accounts will be cascade deleted due to foreign key constraints
		await drizzle.delete(schema.user).where(eq(schema.user.id, userId)).run();
	},
};
