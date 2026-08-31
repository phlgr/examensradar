CREATE TABLE `email_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`jpa_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscriber`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jpa_id`) REFERENCES `jpa`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_subscription_jpaId_idx` ON `email_subscription` (`jpa_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_subscription_subscriber_jpa_unq` ON `email_subscription` (`subscriber_id`,`jpa_id`);--> statement-breakpoint
CREATE TABLE `subscriber` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`manage_token` text NOT NULL,
	`confirm_token` text,
	`confirm_expires_at` integer,
	`confirmed_at` integer,
	`consent_ip` text,
	`consent_at` integer,
	`bounced_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriber_email_unique` ON `subscriber` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriber_manage_token_unique` ON `subscriber` (`manage_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriber_confirm_token_unique` ON `subscriber` (`confirm_token`);