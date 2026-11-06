# Oral exams

The NRW office pages list upcoming oral exam days with their places. The server fetches each office's published lists live (Hamm and Köln PDFs, Düsseldorf HTML month pages) the first time a page asks. It caches them for 6 hours and retries 15 minutes after a failed fetch (`src/server/oral-exams.ts`). The parsers live in `src/lib/oral-exams.ts`. Köln and Düsseldorf also publish which Kennziffer is examined where: the server reads those assignments (Köln's per-room PDFs, Düsseldorf's month pages) into the same cache entry, best effort, four documents at a time.

## Sub-features

- `oral-section`: `/ergebnisse/<slug>` for `hamm`, `köln` and `düsseldorf` has the section `Mündliche Prüfungen beim <name>` between the Klausur card grid and the FAQ. Days from today on sit in one card per month, as `Fr 13.11.` plus places (Hamm courts, Köln `Raum …`, Düsseldorf `Saal …`). Other offices, or an office with no upcoming days, have no section.
- `oral-disclaimer`: the intro under the heading says "… im fünften Monat nach den Klausuren statt …", and below the cards comes `Ohne Gewähr. Quelle: …, abgerufen am <Datum>`.
- `oral-lookup`: for `köln` and `düsseldorf` the section has the field `Deine Kennziffer` (placeholder `z. B. 1234/26`) above the month cards, with the line "Deine Kennziffer bleibt in deinem Browser. Wir speichern und senden sie nicht." Hamm has no field (it publishes no Kennziffer lists).
- `oral-lookup-load`: the Kennziffern load lazily with a GET to `/_serverFn/…` (`getOralExamAssignments`) the first time the field is focused or typed into. The response holds only upcoming assignments of that office, as `{ "<Kennziffer>": { date, place, start? } }`. `robots.txt` disallows `/_serverFn/`.
- `oral-lookup-result`: typing a Kennziffer (`6334/26`, ` 6334 / 26 ` and `6334-26` are the same) shows `Fr 06.11. · Raum 440A · ab ca. 10:00 Uhr` and highlights that day in the month cards. Düsseldorf publishes no start time, so it shows `Mi 11.11. · Saal B 2`. An unknown number shows "Für diese Kennziffer ist noch kein Termin veröffentlicht." and the Ladung hint. A failed load shows a neutral retry message.
- `oral-lookup-privacy`: the typed number is matched in the browser only. It is in no request, URL, history state, storage or cookie, and Enter does nothing. The single Plausible event `kennziffer_lookup` (at most once per page view) carries `{ jpa, found }`, never the number.
- `oral-privacy`: no examiner names appear anywhere on the page or in the assignments response, and no Kennziffer is in the SSR HTML or the route loader data.

## How to get to it (user POV)

- The office page of Hamm, Köln or Düsseldorf, section `Mündliche Prüfungen beim …`.

## Driving it with pw.ts

Preconditions: baseline and outbound internet. The instance fetches the real JPA sites, read-only.

- **Proof.** Run `bun $V/journeys/oral-exams.ts <run>`. It checks that the section is in the SSR HTML (with React's `<!-- -->` text separators stripped) and in the hydrated page, that every day has a date and a place, and that the disclaimer is there. For Köln and Düsseldorf it also checks that the SSR HTML has no Kennziffer (the placeholder aside), that nothing is requested before the field is used, takes a real Kennziffer from the lazily loaded response, types it, and checks the found state and the day highlight. It then types `9999/99` for the not-found state, presses Enter, and asserts that no request URL, the page URL, history state, storage or cookies contain a typed number and that Plausible got exactly one `kennziffer_lookup`. Hamm must have no field. Output is `evidence/oral-exams/` with screenshots per office (found and not found for Köln and Düsseldorf) and a `…-sample.json` with the Kennziffer masked.

## Gotchas

- The first request after boot waits for the live fetch. A JPA site that is down hides that office's section until a fetch succeeds.
- The section only shows days from today on, so its length depends on the real date and on what the offices have published.
- The journey needs at least one upcoming assignment per office. Before an office publishes Kennziffern for the next exams, the lookup is there but every number shows the not-published message, and the journey fails at "upcoming assignments loaded".
- Köln's altes-Recht rooms list a preparation and a talk time per candidate. The lookup shows the preparation time, the one a candidate has to be there for.
- A failing assignment document is logged as `[oral-exams] <slug>: <url>: <message>` in the server log and skipped; the day list is unaffected.
