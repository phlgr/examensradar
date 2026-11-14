-- First-exam offices outside NRW (refs #317). Selectors were tested against
-- the live pages and archived results-day snapshots. Baden-Württemberg, Bayern
-- and Thüringen only render their element on results day, hence 'release'.
-- Keyed on slug so re-running or a manually created row is a no-op.
INSERT INTO `jpa` (`id`, `slug`, `name`, `land`, `scrape_mode`, `website_url`, `scrape_url`, `scrape_selector`, `created_at`)
VALUES
	(
		'jpa-berlin-brandenburg',
		'berlin-brandenburg',
		'Prüfungsamt Berlin-Brandenburg',
		'Berlin',
		'standing',
		'https://www.berlin.de/sen/justiz/juristenausbildung/juristische-pruefungen/artikel.435227.php',
		'https://www.berlin.de/sen/justiz/juristenausbildung/juristische-pruefungen/artikel.435227.php',
		'.modul-download__left',
		unixepoch() * 1000
	),
	(
		'jpa-schleswig-holstein',
		'schleswig-holstein',
		'Justizprüfungsamt Schleswig-Holstein',
		'Schleswig-Holstein',
		'standing',
		'https://www.schleswig-holstein.de/DE/justiz/gerichte-und-justizbehoerden/OLG/Aufgaben/Justizpruefungsamt/Termine/MuendlichePruefung',
		'https://www.schleswig-holstein.de/DE/justiz/gerichte-und-justizbehoerden/OLG/Aufgaben/Justizpruefungsamt/Termine/MuendlichePruefung',
		'main .s-richtext',
		unixepoch() * 1000
	),
	(
		'jpa-bremen',
		'bremen',
		'Justizprüfungsamt Bremen',
		'Bremen',
		'standing',
		'https://www.oberlandesgericht.bremen.de/informationen/justizpruefungsamt/klausurergebnisse-1709',
		'https://www.oberlandesgericht.bremen.de/informationen/justizpruefungsamt/klausurergebnisse-1709',
		'main',
		unixepoch() * 1000
	),
	(
		'jpa-niedersachsen',
		'niedersachsen',
		'Landesjustizprüfungsamt Niedersachsen',
		'Niedersachsen',
		'standing',
		'https://justizportal.niedersachsen.de/startseite/karriere/landesjustizprufungsamt/staatliche_pflichtfachprufung_und_erste_prufung/ergebnisse-158132.html',
		'https://justizportal.niedersachsen.de/startseite/karriere/landesjustizprufungsamt/staatliche_pflichtfachprufung_und_erste_prufung/ergebnisse-158132.html',
		'#articleContent_158132',
		unixepoch() * 1000
	),
	(
		'jpa-baden-wuerttemberg',
		'baden-württemberg',
		'Landesjustizprüfungsamt Baden-Württemberg',
		'Baden-Württemberg',
		'release',
		'https://jum.baden-wuerttemberg.de/de/justiz/justizpruefungsamt/juristenausbildung-und-pruefungen/staatspruefung-in-der-ersten-juristischen-pruefung/bekanntgabe-der-aktuellen-pruefungsergebnisse',
		'https://jum.baden-wuerttemberg.de/de/justiz/justizpruefungsamt/juristenausbildung-und-pruefungen/staatspruefung-in-der-ersten-juristischen-pruefung/bekanntgabe-der-aktuellen-pruefungsergebnisse',
		'.article__section:has(a[href$=".pdf"])',
		unixepoch() * 1000
	),
	(
		'jpa-bayern',
		'bayern',
		'Landesjustizprüfungsamt Bayern',
		'Bayern',
		'release',
		'https://www.justiz.bayern.de/landesjustizpruefungsamt/erste-juristische-staatspruefung/',
		'https://www.justiz.bayern.de/landesjustizpruefungsamt/erste-juristische-staatspruefung/',
		'dt:contains("Aktuelles / Weiteres") + dd li:has(a[href$="mdl.htm"]) strong',
		unixepoch() * 1000
	),
	(
		'jpa-thueringen',
		'thüringen',
		'Justizprüfungsamt Thüringen',
		'Thüringen',
		'release',
		'https://justiz.thueringen.de/jpa/pflichtfachpruefung/ergebnisse-schriftlicher-teil-der-staatspruefung',
		'https://justiz.thueringen.de/jpa/pflichtfachpruefung/ergebnisse-schriftlicher-teil-der-staatspruefung',
		'main section.th-box .th-media h2',
		unixepoch() * 1000
	)
ON CONFLICT (`slug`) DO NOTHING;
