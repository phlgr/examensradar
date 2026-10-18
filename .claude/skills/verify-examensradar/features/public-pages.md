# Public pages

Anyone can read when each office last published results and when the next release is expected. That's on the per-office pages `/ergebnisse/<slug>` and the overview `/history`. Search engines and LLM crawlers get server-rendered data plus `sitemap.xml` and `llms.txt`.

## Sub-features

- `office-page`: `/ergebnisse/<slug>` has the h1 `Examensergebnisse <name>: Wann kommen sie?`, a breadcrumb `Brotkrumen`, a next-release sentence, and the signup form preselected to the office.
- `office-unknown`: an unknown slug renders the not-found state, not a 500.
- `history`: `/history` has the h1 `Wann kommen die Ergebnisse?` and past publications per office.
- `sitemap`: `/sitemap.xml` lists `/`, `/history` and every `/ergebnisse/<slug>`.
- `llms`: `/llms.txt` returns plain text describing the service and offices.
- `ssr`: the data above is in the server HTML, before JS runs.

## How to get to it (user POV)

- The footer nav `Examensergebnisse nach Prüfungsamt` lists links to every office page.
- The `Historie` header link goes to `/history`.
- Search engine and crawler fetches go to `/sitemap.xml` and `/llms.txt`.

## Driving it with pw.ts

Preconditions: baseline. The seed has mock NRW publications in `notification_log`, so NRW has history.

- **Office page.** `visit(base + "/ergebnisse/nrw")`. The heading `Examensergebnisse Justizprüfungsamt NRW: Wann kommen sie?` and `getByRole("navigation", { name: "Brotkrumen" })` are visible.
- **From the footer.** `visit(base)`, then in `getByRole("navigation", { name: "Examensergebnisse nach Prüfungsamt" })` click the link to an office. You land on its `/ergebnisse/<slug>`.
- **History.** Click the `Historie` header link. The heading `Wann kommen die Ergebnisse?` is visible and NRW entries are listed.
- **SSR.** `(await fetch(base + "/ergebnisse/nrw")).text()` already contains the h1 text, so it doesn't depend on JS.
- **Sitemap and llms.** `fetch(base + "/sitemap.xml")` returns XML containing `/ergebnisse/nrw`. `fetch(base + "/llms.txt")` returns 200 text.
- **Proof.** Screenshots + ARIA snapshots of both pages, plus the fetched bodies saved with `note()`.

## Gotchas

- Slugs with umlauts (`düsseldorf`, `köln`) appear percent-encoded in URLs. Take them from the footer links instead of typing them.
- `APP_URL` is the verify instance's base URL, so absolute URLs in the sitemap point at `127.0.0.1:<port>`, not examensradar.de. That's expected here.
