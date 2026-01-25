CREATE TABLE `admin_session` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_session_token_unique` ON `admin_session` (`token`);--> statement-breakpoint
CREATE TABLE `jpa` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`website_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jpa_slug_unique` ON `jpa` (`slug`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`jpa_id` text,
	`sent_at` integer NOT NULL,
	`subscriber_count` integer,
	FOREIGN KEY (`jpa_id`) REFERENCES `jpa`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`jpa_id` text NOT NULL,
	`ntfy_topic` text NOT NULL,
	`setup_completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`jpa_id`) REFERENCES `jpa`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_ntfy_topic_unique` ON `subscription` (`ntfy_topic`);--> statement-breakpoint
CREATE INDEX `subscription_deviceId_idx` ON `subscription` (`device_id`);--> statement-breakpoint
CREATE INDEX `subscription_jpaId_idx` ON `subscription` (`jpa_id`);