# Public pages

Anyone can read when each office last published results and when the next release is expected. That's on the per-office pages `/ergebnisse/<slug>` and the overview `/history`. Search engines and LLM crawlers get server-rendered data plus `sitemap.xml` and `llms.txt`.

## Sub-features

- `office-page`: `/ergebnisse/<slug>` has the h1 `Examensergebnisse <name>: Wann kommen sie?`, a breadcrumb `Brotkrumen`, a next-release sentence, and the signup form preselected to the office.
- `office-unknown`: an unknown slug returns 404 with the router's default `Not Found` text, not a 500.
- `history`: `/history` has the h1 `Wann kommen die Ergebnisse?` and past publications per office.
- `sitemap`: `/sitemap.xml` lists `/`, `/history` and every `/ergebnisse/<slug>`.
- `llms`: `/llms.txt` returns plain text describing the service and offices.
- `ssr`: the data above is in the server HTML, before JS runs.

## How to get to it (user POV)

- The footer nav `Examensergebnisse nach Prüfungsamt` lists links to every office page.
- The `Historie` link in the header (and the one in the footer) goes to `/history`.
- Search engine and crawler fetches go to `/sitemap.xml` and `/llms.txt`.

## Driving it with pw.ts

Preconditions: baseline. The seed has mock NRW publications in `notification_log`, so NRW has history.

- **Office page.** `visit(base + "/ergebnisse/nrw")`. The heading `Examensergebnisse Justizprüfungsamt NRW: Wann kommen sie?` and `getByRole("navigation", { name: "Brotkrumen" })` are visible.
- **From the footer.** `visit(base)`, then in `getByRole("navigation", { name: "Examensergebnisse nach Prüfungsamt" })` click the link to an office. You land on its `/ergebnisse/<slug>`.
- **Office without history.** `/ergebnisse/duesseldorf` shows `Für das JPA bei dem OLG Düsseldorf haben wir noch keine Veröffentlichung erfasst.` That sentence appears twice (intro and FAQ), so use `.first()`.
- **History.** Click `page.getByRole("banner").getByRole("link", { name: "Historie" })`. A bare `getByRole("link", { name: "Historie" })` also matches the footer link. The heading `Wann kommen die Ergebnisse?` is visible and NRW entries are listed.
- **SSR.** `(await fetch(base + "/ergebnisse/nrw")).text()` already contains the h1 text, so it doesn't depend on JS.
- **Sitemap and llms.** `fetch(base + "/sitemap.xml")` returns XML containing `<loc>https://examensradar.de/ergebnisse/nrw</loc>`. `fetch(base + "/llms.txt")` returns 200 text.
- **Proof.** Screenshots + ARIA snapshots of both pages, plus the fetched bodies saved with `note()`.

## Gotchas

- URL params are transliterated from the slug (`jpaParam` in `src/lib/seo.ts`): `düsseldorf` becomes `/ergebnisse/duesseldorf`, `köln` becomes `/ergebnisse/koeln`.
- `sitemap.xml` and `llms.txt` build absolute URLs from the hardcoded `SITE_URL` (`https://examensradar.de`), not `APP_URL`, so they never point at the verify instance.
- Driven on 2026-10-19 with an ad-hoc script; there is no journey for this feature yet.
