DELETE FROM notification_log WHERE jpa_id = 'jpa-nrw-001';
DELETE FROM jpa WHERE slug = 'nrw';

INSERT INTO jpa (id, slug, name, website_url, scrape_url, scrape_selector, land, created_at)
VALUES
  (
    'jpa-olg-duesseldorf',
    'düsseldorf',
    'OLG Düsseldorf',
    'https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06aktuelles/index.php',
    'https://www.olg-duesseldorf.nrw.de/aufgaben/pruefungsamt/06aktuelles/index.php',
    'article#mainArticle',
    'Nordrhein-Westfalen',
    unixepoch() * 1000
  ),
  (
    'jpa-olg-koeln',
    'köln',
    'OLG Köln',
    'https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/002_aktuelles/',
    'https://www.olg-koeln.nrw.de/aufgaben/justizpruefungsamt/002_aktuelles/',
    'section.article-zwischentext:has(.titlebarTitle:contains("§ 20"))',
    'Nordrhein-Westfalen',
    unixepoch() * 1000
  ),
  (
    'jpa-olg-hamm',
    'hamm',
    'OLG Hamm',
    'https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/02_staatl_pflichtfachpruefung/04_termine/01_aufsichtsarbeiten-schriftlich/05_informationen_20_Abs1_Nr_1_JAG/',
    'https://www.olg-hamm.nrw.de/aufgaben/justizpruefungsamt/02_staatl_pflichtfachpruefung/04_termine/01_aufsichtsarbeiten-schriftlich/05_informationen_20_Abs1_Nr_1_JAG/',
    'article#mainArticle',
    'Nordrhein-Westfalen',
    unixepoch() * 1000
  )
ON CONFLICT (slug) DO UPDATE SET
  scrape_url = excluded.scrape_url,
  scrape_selector = excluded.scrape_selector,
  land = excluded.land;

INSERT INTO notification_log (id, jpa_id, sent_at, subscriber_count)
VALUES
  ('mock-hamm-1', 'jpa-olg-hamm', unixepoch('2024-12-13 10:17:00') * 1000, 12),
  ('mock-hamm-2', 'jpa-olg-hamm', unixepoch('2025-03-17 10:22:00') * 1000, 15),
  ('mock-hamm-3', 'jpa-olg-hamm', unixepoch('2025-06-13 10:09:00') * 1000, 18),
  ('mock-hamm-4', 'jpa-olg-hamm', unixepoch('2025-09-16 10:31:00') * 1000, 21),
  ('mock-hamm-5', 'jpa-olg-hamm', unixepoch('2025-12-17 10:14:00') * 1000, 24)
ON CONFLICT (id) DO UPDATE SET sent_at = excluded.sent_at;
