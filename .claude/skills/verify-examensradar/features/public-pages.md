# Public pages

Anyone can read when each office last published results and when the next release is expected. That's on the per-office pages `/ergebnisse/<slug>` and the office index `/ergebnisse`. `/history` is a 301 to `/ergebnisse`. Search engines and LLM crawlers get server-rendered data plus `sitemap.xml` and `llms.txt`.

## Sub-features

- `office-page`: `/ergebnisse/<slug>` has the title `<name>: Termine & Ergebnisse 1. Examen | Examensradar` (the brand suffix is dropped above 60 characters), the h1 `<name>: Klausurtermine und Ergebnisse im 1. Examen`, a breadcrumb `Brotkrumen`, an answer block right under the h1 that says when results come (`h1 + p`, it follows the phase: released in the last 7 days, overdue, waiting, running, upcoming, prediction only, or nothing known), a small `Veröffentlicht meist …` line when a prediction exists, and the signup form locked to the office (no `Dein Justizprüfungsamt` select). The exam calendar section is its own feature: [exam-calendar](./exam-calendar.md).
- `office-unknown`: an unknown slug returns 404 with the router's default `Not Found` text, not a 500.
- `results-index`: `/ergebnisse` has the h1 `Examensergebnisse nach Prüfungsamt`, the group heading `NRW` and one link row per office (name, last release, next expected release), then the FAQ `Zu den Prognosen`.
- `history-redirect`: `/history` and `/history/` answer 301 with `Location: /ergebnisse`.
- `sitemap`: `/sitemap.xml` lists `/`, `/ergebnisse` and every `/ergebnisse/<slug>`. An office's `<lastmod>` is the later of its last release and its exam calendar's `Stand`.
- `llms`: `/llms.txt` returns plain text describing the service and offices, with a `## Klausurtermine (NRW)` section listing the next sittings.
- `robots`: `/robots.txt` disallows `/admin`, `/api/`, `/confirm/` and `/unsubscribe/`, but not `/subscriptions`, so crawlers can read that page's `noindex`.
- `ssr`: the data above is in the server HTML, before JS runs.

## How to get to it (user POV)

- The footer nav `Examensergebnisse nach Prüfungsamt` lists links to every office page.
- The `Ergebnisse` link in the header (and the one in the footer) goes to `/ergebnisse`. In the header it stays active on office pages.
- Search engine and crawler fetches go to `/sitemap.xml` and `/llms.txt`.

## Driving it with pw.ts

Preconditions: baseline. The seed has mock NRW publications in `notification_log`, so NRW has history.

- **Office page.** `visit(base + "/ergebnisse/nrw")`. The heading `Justizprüfungsamt NRW: Klausurtermine und Ergebnisse im 1. Examen` and `getByRole("navigation", { name: "Brotkrumen" })` are visible. NRW has no exam calendar, so there is no `Klausurtermine beim …` heading.
- **From the footer.** `visit(base)`, then in `getByRole("navigation", { name: "Examensergebnisse nach Prüfungsamt" })` click the link to an office. You land on its `/ergebnisse/<slug>`.
- **Office without history.** `/ergebnisse/duesseldorf` shows `Für das JPA bei dem OLG Düsseldorf haben wir noch keine Veröffentlichung erfasst.` That sentence is in the FAQ. The answer block names the oldest waiting sitting with only the month, e.g. `voraussichtlich Ende November`.
- **Results index.** Click `page.getByRole("banner").getByRole("link", { name: "Ergebnisse" })`. A bare `getByRole("link", { name: "Ergebnisse" })` also matches the footer link. The heading `Examensergebnisse nach Prüfungsamt` is visible and each office is a link to its page.
- **History redirect.** `fetch(base + "/history", { redirect: "manual" })` returns 301 with `location` ending in `/ergebnisse`. Same for `/history/`.
- **SSR.** `(await fetch(base + "/ergebnisse/nrw")).text()` already contains the h1 text, so it doesn't depend on JS.
- **Sitemap, llms and robots.** `fetch(base + "/sitemap.xml")` returns XML containing `<loc>https://examensradar.de/ergebnisse/nrw</loc>`, and the Hamm entry has a `<lastmod>`. `fetch(base + "/llms.txt")` returns 200 text containing `## Klausurtermine (NRW)`. `fetch(base + "/robots.txt")` has no `Disallow: /subscriptions`. `journeys/exam-calendar.ts` checks these three.
- **Proof.** Screenshots + ARIA snapshots of both pages, plus the fetched bodies saved with `note()`.

## Gotchas

- URL params are transliterated from the slug (`jpaParam` in `src/lib/seo.ts`): `düsseldorf` becomes `/ergebnisse/duesseldorf`, `köln` becomes `/ergebnisse/koeln`.
- `sitemap.xml` and `llms.txt` build absolute URLs from the hardcoded `SITE_URL` (`https://examensradar.de`), not `APP_URL`, so they never point at the verify instance.
- Driven on 2026-11-05 with an ad-hoc script (office pages, no-history state); the crawler files are in `journeys/exam-calendar.ts`. There is no journey for the office and index pages themselves yet.
