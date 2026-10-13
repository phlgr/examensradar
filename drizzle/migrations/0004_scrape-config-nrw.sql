-- Seed the in-app scraper with the config the retired changebot used
-- (examensradar-changebot/.changebotrc.yml). Keyed on slug so this applies to
-- the production rows and is a no-op where those slugs don't exist.
UPDATE `jpa`
SET `scrape_url` = 'https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06aktuelles/index.php',
	`scrape_selector` = 'article#mainArticle'
WHERE `slug` = 'düsseldorf' AND `scrape_url` IS NULL;--> statement-breakpoint
UPDATE `jpa`
SET `scrape_url` = 'https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/002_aktuelles/',
	`scrape_selector` = 'section.article-zwischentext:has(.titlebarTitle:contains("§ 20"))'
WHERE `slug` = 'köln' AND `scrape_url` IS NULL;--> statement-breakpoint
UPDATE `jpa`
SET `scrape_url` = 'https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/02_staatl_pflichtfachpruefung/04_termine/01_aufsichtsarbeiten-schriftlich/05_informationen_20_Abs1_Nr_1_JAG/',
	`scrape_selector` = 'article#mainArticle'
WHERE `slug` = 'hamm' AND `scrape_url` IS NULL;
