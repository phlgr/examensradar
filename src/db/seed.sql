-- Seed data for Examensradar

-- Insert NRW JPA
INSERT INTO jpa (id, slug, name, websiteUrl, createdAt)
VALUES (
  'jpa-nrw-001',
  'nrw',
  'Justizprüfungsamt NRW',
  'https://www.jpa.nrw.de/',
  unixepoch()
)
ON CONFLICT (slug) DO UPDATE SET
  name = excluded.name,
  websiteUrl = excluded.websiteUrl;
