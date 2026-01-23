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
