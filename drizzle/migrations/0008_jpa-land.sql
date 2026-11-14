ALTER TABLE `jpa` ADD `land` text;--> statement-breakpoint
-- Backfill: every office that existed before this column is in NRW.
UPDATE `jpa`
SET `land` = 'Nordrhein-Westfalen'
WHERE `slug` IN ('düsseldorf', 'köln', 'hamm', 'nrw');
