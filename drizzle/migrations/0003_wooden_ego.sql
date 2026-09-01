CREATE TABLE `scrape_state` (
	`jpa_id` text PRIMARY KEY NOT NULL,
	`content_hash` text,
	`last_checked_at` integer NOT NULL,
	`last_changed_at` integer,
	`error_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	FOREIGN KEY (`jpa_id`) REFERENCES `jpa`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `jpa` ADD `scrape_url` text;--> statement-breakpoint
ALTER TABLE `jpa` ADD `scrape_selector` text;