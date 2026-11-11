CREATE TABLE `mail_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`subscriber_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`last_error` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `notification_log`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscriber`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mail_outbox_status_next_attempt_idx` ON `mail_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `mail_outbox_release_subscriber_unq` ON `mail_outbox` (`release_id`,`subscriber_id`);