CREATE TABLE `failed_list` (
	`id` text PRIMARY KEY NOT NULL,
	`jpa_id` text NOT NULL,
	`url` text NOT NULL,
	`exam_month` text,
	`failed_count` integer NOT NULL,
	`first_seen_at` integer NOT NULL,
	FOREIGN KEY (`jpa_id`) REFERENCES `jpa`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `failed_list_url_unique` ON `failed_list` (`url`);--> statement-breakpoint
CREATE INDEX `failed_list_jpaId_idx` ON `failed_list` (`jpa_id`);