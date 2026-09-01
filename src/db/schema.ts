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
	/**
	 * Where the in-app scraper looks for new results. Separate from
	 * `websiteUrl` because the page students should open is not always the page
	 * whose change means "results are out". Scraping is on iff both `scrapeUrl`
	 * and `scrapeSelector` are set.
	 */
	scrapeUrl: text("scrape_url"),
	/** CSS selector narrowing the page to the section worth watching. */
	scrapeSelector: text("scrape_selector"),
	notificationsDisabled: integer("notifications_disabled", {
		mode: "boolean",
	})
		.notNull()
		.default(false),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * One row per scraped JPA: the content baseline plus check bookkeeping.
 *
 * `contentHash` doubles as the concurrency guard. Every observed change is
 * claimed with a compare-and-swap on it, and only the winner notifies — so two
 * server instances overlapping during a zero-downtime deploy can both scrape,
 * but nobody gets notified twice. Null means "no baseline yet": the first
 * successful scrape only stores the hash and never notifies, because we cannot
 * know whether the content is new.
 */
export const scrapeState = sqliteTable("scrape_state", {
	jpaId: text("jpa_id")
		.primaryKey()
		.references(() => jpa.id, { onDelete: "cascade" }),
	contentHash: text("content_hash"),
	lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }).notNull(),
	lastChangedAt: integer("last_changed_at", { mode: "timestamp_ms" }),
	/** Consecutive failures; reset by any successful check. */
	errorCount: integer("error_count").notNull().default(0),
	lastError: text("last_error"),
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
	/**
	 * Separate from `manageToken` on purpose. The List-Unsubscribe header hands
	 * this URL to Gmail and to every scanner in between, so the credential we
	 * publish must only be able to unsubscribe — not read the address or alter
	 * subscriptions the way the manage token can.
	 */
	unsubscribeToken: text("unsubscribe_token").notNull().unique(),
	/**
	 * Kept after use (rotated on every signup, dead once expired) so /confirm
	 * can recognize an already-used link. A used link is inert: confirming is
	 * only possible while `confirmedAt` is null, and the manage credential is
	 * never handed to whoever replays it — see `classifyConfirmToken`.
	 */
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
		/**
		 * The device that signed this address up, when there was one. On
		 * confirmation the matching ntfy subscription for the same JPA is deleted,
		 * so nobody receives both a push and a mail for one publication.
		 *
		 * Recorded here rather than read at confirmation time because the
		 * confirmation link is often opened on a different device than the signup,
		 * and it is per-JPA so migrating one office never silently drops the push
		 * for another.
		 */
		deviceId: text("device_id"),
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
	scrapeState,
};
