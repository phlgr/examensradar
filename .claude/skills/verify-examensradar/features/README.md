# Examensradar verification map

This directory is the maintained source for verifying Examensradar's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe. Commands assume `V=.claude/skills/verify-examensradar/scripts` and the repo root as the working directory.

## Baseline preconditions

- `$V/verify.sh launch <run-id>` printed `ready`, and `$V/verify.sh doctor <run-id>` printed no `FAIL`.
- The DB is that run's fresh copy: the seeded JPAs (NRW, Düsseldorf, Köln, Hamm, …) with scraping off, plus `JPA Verifikation (Test)` (`jpa-verify-test`), whose scraper watches the fixture page and already has a baseline.
- No subscribers exist until a journey creates them. Use `verify+<something>@example.test` addresses only.
- Admin password is `verify-admin`.

## Driving conventions

- Drive the browser through `scripts/pw.ts` (`open`, `visit`, `proof`, `waitForMail`). Always `visit()`, never a bare `page.goto()`, or input typed before hydration is lost.
- Use labels, roles and the literal German button text listed in each recipe. Don't use CSS classes or DOM position.
- Follow links out of captured mail (`waitForMail(...).links`). Don't build token URLs from DB rows, because mail is part of the path under test.
- Each new signup uses its own address. Throttling is per address and IP inside one server process.
- Scope lookups on a JPA card with `v.card(heading)`. `page.locator("div", { has: heading })` also matches the list container, so text like `Aktiv` can resolve on another JPA's card while a request is in flight.

## Proof and skip reporting

- Capture each user action and the state it produced with `proof(label)`, a screenshot plus ARIA snapshot.
- Mutation proof includes a second, read-only view: a `verify.sh sql` row, or the captured mail (recipient, subject, links).
- Record the feature file and entry point used with every artifact. The journey name is the evidence subdirectory.
- If an entry point can't be reached, report it as unverified, with the attempted step and the unmet precondition. Don't report it as verified through a different path.

## Feature entry contract

Each feature file has an H1, one paragraph of user-visible behavior, then exactly these H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with pw.ts`, `Gotchas`.

## Features

Recipes not marked as driven were written from the code. Their locators are unverified until a run passes, so fix the file when a step doesn't match the app.

- [Subscribe and confirm](./subscribe-confirm.md): landing-page, office-page and signed-out `/subscriptions` signup; confirm mail; confirm page; welcome mail. **Landing entry driven by `journeys/subscribe-confirm.ts`; all entries driven on 2026-10-19.**
- [Manage subscriptions](./manage-subscriptions.md): manage-link sign-in, add/remove offices, sign out, resend the manage link. **Driven end to end on 2026-10-19** (`journeys/manage-subscriptions.ts`).
- [Unsubscribe](./unsubscribe.md): the `/unsubscribe/:token` page and the RFC 8058 one-click POST. **Page and GET-inert in `journeys/unsubscribe.ts`; one-click POST and sticky re-signup driven on 2026-10-19 without a journey.**
- [Admin scraper and results mail](./admin-scraper.md): admin login, "Jetzt prüfen", and the "Neue Ergebnisse" fan-out. **Login, unchanged, notify, exactly-once and logout in `journeys/admin-scraper.ts`; pause and selector error driven on 2026-10-19 without a journey.**
- [Public pages](./public-pages.md): office pages `/ergebnisse/:slug`, `/history`, `sitemap.xml`, `llms.txt`. **Driven on 2026-10-19 without a journey.**
