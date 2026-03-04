-- Seed data for Examensradar

-- Insert NRW JPA
INSERT INTO jpa (id, slug, name, website_url, created_at)
VALUES (
  'jpa-nrw-001',
  'nrw',
  'Justizprüfungsamt NRW',
  'https://www.jpa.nrw.de/',
  unixepoch() * 1000
)
ON CONFLICT (slug) DO UPDATE SET
  name = excluded.name,
  website_url = excluded.website_url;

-- Mock notification history: 5 entries ~3 months apart for NRW
INSERT INTO notification_log (id, jpa_id, sent_at, subscriber_count)
VALUES
  ('mock-nrw-1', 'jpa-nrw-001', unixepoch('2024-12-13 10:17:00') * 1000, 12),
  ('mock-nrw-2', 'jpa-nrw-001', unixepoch('2025-03-17 10:22:00') * 1000, 15),
  ('mock-nrw-3', 'jpa-nrw-001', unixepoch('2025-06-13 10:09:00') * 1000, 18),
  ('mock-nrw-4', 'jpa-nrw-001', unixepoch('2025-09-16 10:31:00') * 1000, 21),
  ('mock-nrw-5', 'jpa-nrw-001', unixepoch('2025-12-17 10:14:00') * 1000, 24)
ON CONFLICT (id) DO UPDATE SET sent_at = excluded.sent_at;
