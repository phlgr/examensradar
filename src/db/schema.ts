import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jpa = sqliteTable("jpa", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	websiteUrl: text("website_url"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const subscription = sqliteTable(
	"subscription",
	{
		id: text("id").primaryKey(),
		deviceId: text("device_id").notNull(),
		jpaId: text("jpa_id")
			.notNull()
			.references(() => jpa.id, { onDelete: "cascade" }),
		ntfyTopic: text("ntfy_topic").notNull().unique(),
		setupCompletedAt: integer("setup_completed_at", {
			mode: "timestamp_ms",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("subscription_deviceId_idx").on(table.deviceId),
		index("subscription_jpaId_idx").on(table.jpaId),
	],
);

export const notificationLog = sqliteTable("notification_log", {
	id: text("id").primaryKey(),
	jpaId: text("jpa_id").references(() => jpa.id),
	sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
	subscriberCount: integer("subscriber_count"),
});

// Admin session for simple password-based admin auth
export const adminSession = sqliteTable("admin_session", {
	id: text("id").primaryKey(),
	token: text("token").notNull().unique(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const jpaRelations = relations(jpa, ({ many }) => ({
	subscriptions: many(subscription),
	notificationLogs: many(notificationLog),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
	jpa: one(jpa, {
		fields: [subscription.jpaId],
		references: [jpa.id],
	}),
}));

export const notificationLogRelations = relations(
	notificationLog,
	({ one }) => ({
		jpa: one(jpa, {
			fields: [notificationLog.jpaId],
			references: [jpa.id],
		}),
	}),
);

export const schema = {
	jpa,
	subscription,
	notificationLog,
	adminSession,
};
