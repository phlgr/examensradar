ALTER TABLE `jpa` ADD `land` text;--> statement-breakpoint
UPDATE `jpa`
SET `land` = 'Nordrhein-Westfalen'
WHERE `slug` IN ('düsseldorf', 'köln', 'hamm', 'nrw');
