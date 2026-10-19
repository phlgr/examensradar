# Admin scraper and results mail

The admin logs in at `/admin/login` and sees every JPA with its subscriber count and scraper status. "Jetzt prüfen" runs the same compare-and-swap-guarded check as the scheduler. If the watched section changed since the baseline, every confirmed subscriber of that office gets "Neue Ergebnisse: <office>", `/history` gains an entry, and a second check of the same content notifies nobody.

## Sub-features

- `admin-login`: the password `verify-admin` reaches `/admin`, and a wrong password shows an error.
- `scrape-unchanged`: "Jetzt prüfen" on unchanged content shows `Keine Änderung.`
- `scrape-notify`: after a content change, it shows `Änderung erkannt — N Mails in Zustellung.` and N mails go out, one per confirmed subscriber.
- `scrape-once`: a second "Jetzt prüfen" on the same changed content shows `Keine Änderung.` with no new mail.
- `scrape-paused`: with notifications paused for the JPA (the bell icon button on its card), it shows `Änderung erkannt, aber Benachrichtigungen sind pausiert.` and no mail.
- `scrape-error`: a selector that matches nothing shows `Fehler: selector matched nothing: …`.

## How to get to it (user POV)

- `/admin/login`, then `/admin`, then the JPA card, then the `Jetzt prüfen` button under "Scraper".
- The scheduler does the same thing on its own every `SCRAPE_INTERVAL_MS`. The verify instance sets that to 24 h, so only the boot check runs.

## Driving it with pw.ts

Preconditions: at least one confirmed `example.test` subscriber on `JPA Verifikation (Test)` (run [subscribe-confirm](./subscribe-confirm.md) first). `verify.sh doctor` passes, which guarantees that only the test JPA can scrape.

- **Wrong password.** Fill `Passwort` with anything else and click `Anmelden`. `Falsches Passwort` appears and no `admin_session` cookie is set.
- **Log in.** `visit(base + "/admin/login")`, then `page.getByLabel("Passwort").fill("verify-admin")`, then click the `Anmelden` button. The URL becomes `/admin` and the heading `JPA Verifikation (Test)` is visible.
- **Unchanged check.** On the test JPA card (`v.card("JPA Verifikation (Test)")`), click `Jetzt prüfen`. `Keine Änderung.` appears next to the button.
- **Publish results.** In a shell, run `$V/verify.sh fixture <run> '<p>Ergebnisse <something new></p>'`.
- **Notify.** Click `Jetzt prüfen` again. `Änderung erkannt — N Mails in Zustellung.` appears, with N equal to the number of confirmed, not unsubscribed subscribers on the test JPA. The journey reads N from the DB.
- **Side effects.** `waitForMail(run, email, /Neue Ergebnisse: JPA Verifikation/)` arrives for each subscriber and for nobody else. `verify.sh sql <run> "select * from notification_log where jpa_id='jpa-verify-test'"` has one new row with `subscriber_count` = N.
- **Exactly once.** Click `Jetzt prüfen` a third time. It shows `Keine Änderung.` and `verify.sh mail` has no new line.
- **Log out.** Click `Abmelden`. The URL becomes `/admin/login`, the cookie is cleared, and visiting `/admin` redirects back to login.
- **Proof.** Run `bun $V/journeys/admin-scraper.ts <run>` after `subscribe-confirm`. It covers everything above, sets unique fixture content, and works on a reused instance. Its output is `evidence/admin-scraper/01..06*.png` + `result.json`.
- **Pause.** On the test JPA card, click the icon button named `Benachrichtigungen pausieren` (its `title`; it has no text). The card shows the badge `Pausiert` and the button becomes `Benachrichtigungen aktivieren`. Publish new fixture content and click `Jetzt prüfen`. It shows `Änderung erkannt, aber Benachrichtigungen sind pausiert.`, no mail is captured and `notification_log` gains no row. Click `Benachrichtigungen aktivieren` to undo it; the pause persists in the run DB otherwise.
- **Selector error.** Click the card's `Bearbeiten` icon button, set `CSS-Selektor (optional)` to `#does-not-exist` and click `Speichern`. Click `Jetzt prüfen`. It shows `Fehler: selector matched nothing: #does-not-exist`. To restore, edit the selector back to `article#results` and save. Saving a changed scrape URL or selector drops the baseline and re-checks at once, so the next `Jetzt prüfen` shows `Keine Änderung.` and only content changed after that notifies.

## Gotchas

- Pause and selector error were driven on 2026-10-19 but are not in the journey.
- Use `getByText("Pausiert", { exact: true })`. Without `exact`, it also matches the paused outcome text.
- Never point a seeded (real) JPA at the fixture or re-enable its scrape URL. `doctor` fails if any JPA other than the test JPA has a scrape URL.
- A fixture change is reported only once per content hash. To notify again, set different content.
