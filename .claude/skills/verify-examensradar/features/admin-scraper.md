# Admin scraper and results mail

The admin logs in at `/admin/login` and sees every JPA with its subscriber count and scraper status. "Jetzt prüfen" runs the same compare-and-swap-guarded check as the scheduler. If the watched section changed since the baseline, every confirmed subscriber of that office gets "Neue Ergebnisse: <office>", `/history` gains an entry, and a second check of the same content notifies nobody.

## Sub-features

- `admin-login`: the password `verify-admin` reaches `/admin`, and a wrong password shows an error.
- `scrape-unchanged`: "Jetzt prüfen" on unchanged content shows `Keine Änderung.`
- `scrape-notify`: after a content change, it shows `Änderung erkannt — N Mails in Zustellung.` and N mails go out, one per confirmed subscriber.
- `scrape-once`: a second "Jetzt prüfen" on the same changed content shows `Keine Änderung.` with no new mail.
- `scrape-paused`: with notifications paused for the JPA (edit form), it shows `Änderung erkannt, aber Benachrichtigungen sind pausiert.` and no mail.
- `scrape-error`: a selector that matches nothing shows `Fehler: selector matched nothing: …`.

## How to get to it (user POV)

- `/admin/login`, then `/admin`, then the JPA card, then the `Jetzt prüfen` button under "Scraper".
- The scheduler does the same thing on its own every `SCRAPE_INTERVAL_MS`. The verify instance sets that to 24 h, so only the boot check runs.

## Driving it with pw.ts

Preconditions: at least one confirmed `example.test` subscriber on `JPA Verifikation (Test)` (run [subscribe-confirm](./subscribe-confirm.md) first). `verify.sh doctor` passes, which guarantees that only the test JPA can scrape.

- **Log in.** `visit(base + "/admin/login")`, then `page.getByLabel("Passwort").fill("verify-admin")`, then click the `Anmelden` button. The URL becomes `/admin` and the heading `JPA Verifikation (Test)` is visible.
- **Unchanged check.** On the test JPA card (`page.locator("div", { has: page.getByRole("heading", { name: "JPA Verifikation (Test)" }) })`), click `Jetzt prüfen`. `Keine Änderung.` appears next to the button.
- **Publish results.** In a shell, run `$V/verify.sh fixture <run> '<p>Ergebnisse Termin 2026/II online</p>'`.
- **Notify.** Click `Jetzt prüfen` again. `Änderung erkannt — 1 Mails in Zustellung.` appears, with N equal to the number of confirmed subscribers.
- **Side effects.** `waitForMail(run, email, /Neue Ergebnisse: JPA Verifikation/)` arrives for each subscriber and for nobody else. `verify.sh sql <run> "select * from notification_log where jpa_id='jpa-verify-test'"` has one new row with `subscriber_count` = N.
- **Exactly once.** Click `Jetzt prüfen` a third time. It shows `Keine Änderung.` and `verify.sh mail` has no new line.
- **Proof.** Take a `proof()` after each click, plus the mail index and the notification_log row in `note()`.

## Gotchas

- The tRPC path (`POST /api/trpc/jpa.scrapeNow` with the admin cookie) was confirmed on 2026-10-18 and returned `{"result":"notified","mail":1}` with the mail captured. The admin UI path above has not been driven yet, so treat its locators as unverified until a run passes.
- Never point a seeded (real) JPA at the fixture or re-enable its scrape URL. `doctor` fails if any JPA other than the test JPA has a scrape URL.
- A fixture change is reported only once per content hash. To notify again, set different content.
