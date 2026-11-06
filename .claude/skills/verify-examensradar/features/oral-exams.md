# Oral exams

The NRW office pages list upcoming oral exam days with their places. The server fetches each office's published lists live (Hamm and Köln PDFs, Düsseldorf HTML month pages) the first time a page asks. It caches them for 6 hours and retries 15 minutes after a failed fetch (`src/server/oral-exams.ts`). The parsers live in `src/lib/oral-exams.ts`.

## Sub-features

- `oral-section`: `/ergebnisse/<slug>` for `hamm`, `köln` and `düsseldorf` has the section `Mündliche Prüfungen beim <name>`, below the Klausur pods. Days from today on are grouped by month, as `Fr 13.11.` plus places (Hamm courts, Köln `Raum …`, Düsseldorf `Saal …`). Other offices, or an office with no upcoming days, have no section.
- `oral-disclaimer`: below the list come the line "… im fünften Monat nach den Klausuren statt …" and `Ohne Gewähr. Quelle: …, abgerufen am <Datum>`.
- `oral-privacy`: no examiner names or Kennziffern appear anywhere on the page.

## How to get to it (user POV)

- The office page of Hamm, Köln or Düsseldorf, section `Mündliche Prüfungen beim …`.

## Driving it with pw.ts

Preconditions: baseline and outbound internet. The instance fetches the real JPA sites, read-only.

- **Proof.** Run `bun $V/journeys/oral-exams.ts <run>`. It checks that the section is in the SSR HTML (with React's `<!-- -->` text separators stripped) and in the hydrated page, that every day has a date and a place, and that the disclaimer is there. Output is `evidence/oral-exams/` with one screenshot per office.

## Gotchas

- The first request after boot waits for the live fetch. A JPA site that is down hides that office's section until a fetch succeeds.
- The section only shows days from today on, so its length depends on the real date and on what the offices have published.
