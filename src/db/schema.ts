import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";

export const jpa = sqliteTable("jpa", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	websiteUrl: text("website_url"),
	notificationsDisabled: integer("notifications_disabled", {
		mode: "boolean",
	})
		.notNull()
		.default(false),
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

/**
 * A confirmed email address is the whole identity — no password, no session.
 * `manageToken` stands in for both: every mail footer links to it, and knowing
 * it is what authorises managing or ending a subscription.
 *
 * Rows are disposable, with two exceptions: once `unsubscribedAt` or
 * `bouncedAt` is set the row must survive cleanup, because it is the only
 * record that this address must not be mailed again. Anyone can type a
 * stranger's address into the signup form, so dropping that record would let an
 * opted-out address be re-subscribed and mailed.
 */
export const subscriber = sqliteTable("subscriber", {
	id: text("id").primaryKey(),
	/** Lowercased and trimmed on write, so uniqueness is on the real address. */
	email: text("email").notNull().unique(),
	manageToken: text("manage_token").notNull().unique(),
	/** Cleared once used, so a confirmation link works exactly once. */
	confirmToken: text("confirm_token").unique(),
	confirmExpiresAt: integer("confirm_expires_at", { mode: "timestamp_ms" }),
	/** Null while pending. Nothing is ever sent to a pending subscriber. */
	confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
	/** Einwilligungsnachweis: who consented, from where, and when. */
	consentIp: text("consent_ip"),
	consentAt: integer("consent_at", { mode: "timestamp_ms" }),
	bouncedAt: integer("bounced_at", { mode: "timestamp_ms" }),
	unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * One row per (address, JPA). Subscribing to several offices is intended, so
 * the pair is unique rather than the subscriber.
 */
export const emailSubscription = sqliteTable(
	"email_subscription",
	{
		id: text("id").primaryKey(),
		subscriberId: text("subscriber_id")
			.notNull()
			.references(() => subscriber.id, { onDelete: "cascade" }),
		jpaId: text("jpa_id")
			.notNull()
			.references(() => jpa.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		unique("email_subscription_subscriber_jpa_unq").on(
			table.subscriberId,
			table.jpaId,
		),
		index("email_subscription_jpaId_idx").on(table.jpaId),
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
	emailSubscriptions: many(emailSubscription),
	notificationLogs: many(notificationLog),
}));

export const subscriberRelations = relations(subscriber, ({ many }) => ({
	emailSubscriptions: many(emailSubscription),
}));

export const emailSubscriptionRelations = relations(
	emailSubscription,
	({ one }) => ({
		subscriber: one(subscriber, {
			fields: [emailSubscription.subscriberId],
			references: [subscriber.id],
		}),
		jpa: one(jpa, {
			fields: [emailSubscription.jpaId],
			references: [jpa.id],
		}),
	}),
);

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
	subscriber,
	emailSubscription,
	notificationLog,
	adminSession,
};
