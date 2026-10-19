# Subscribe and confirm

A visitor picks a Justizprüfungsamt, enters an email address and submits. They always see the same "Fast geschafft." reply. A pending address gets a confirm mail, and opening its link and pressing "Jetzt bestätigen" activates the subscription and sends a welcome mail with the manage and unsubscribe links. An already-active address gets a manage-link mail instead and nothing changes.

## Sub-features

- `signup-new` creates a pending subscriber + subscription and mails "Bitte bestätige deine E-Mail-Adresse".
- `signup-active` gives an already-confirmed address the identical reply, but the mail is "Dein Link zur Abo-Verwaltung" and no subscription is added.
- `confirm` opens `/confirm/:token` showing "Anmeldung bestätigen". "Jetzt bestätigen" leads to "E-Mail bestätigt." with the office name, and mails "Alles bereit — wir halten dich auf dem Laufenden".
- `confirm-reopen`: reopening a used link shows "E-Mail bestätigt." again, not an error. It has no `Abo verwalten` link; it points to the "Willkommens-E-Mail" instead.
- `confirm-invalid`: an unknown token shows "Link nicht mehr gültig".

## How to get to it (user POV)

- Landing page `/`: the form `#anmelden` in the hero.
- Office page `/ergebnisse/<slug>`: the same form, preselected to that office.
- `/subscriptions` while signed out: the same signup form above "Link zuschicken".
- The link in the confirm mail.

## Driving it with pw.ts

Preconditions: baseline. The address you use has never been used in this run.

- **Open the form.** `await v.visit(v.base)`. The combobox labelled `Dein Justizprüfungsamt` is enabled.
- **Fill it.** `page.getByLabel("Dein Justizprüfungsamt").selectOption({ label: "JPA Verifikation (Test)" })`, then `page.getByLabel("E-Mail-Adresse").fill(email)`. The `Benachrichtigen lassen` button becomes enabled.
- **Submit.** `page.getByRole("button", { name: "Benachrichtigen lassen" }).click()`. `getByRole("status")` contains `Fast geschafft.` and the address.
- **Side effect.** `verify.sh sql <run> "select confirmed_at from subscriber where email='<email>'"` shows one row with `confirmed_at` null, plus an `email_subscription` row for `jpa-verify-test`. `waitForMail(run, email, /bestätige deine E-Mail/)` returns one link containing `/confirm/` that starts with `BASE_URL`.
- **Confirm.** `visit(confirmLink)`. The heading `Anmeldung bestätigen` is shown. Click the `Jetzt bestätigen` button. The heading `E-Mail bestätigt.` appears with "JPA Verifikation (Test)", along with the `Abo verwalten` link (`getByRole("link")`), which signs in to `/subscriptions`.
- **Second view.** `confirmed_at` is now set, and `waitForMail(run, email, /Alles bereit/)` has links to `/subscriptions?manage=` and `/unsubscribe/`.
- **Office-page entry.** `visit(base + "/ergebnisse/verify-test")`. The combobox already shows the test office. Repeat Fill/Submit with a new address.
- **Signed-out `/subscriptions` entry.** Use a context without the manage cookie. The page has two `E-Mail-Adresse` fields (signup and resend), so scope to the signup form: `page.locator("#anmelden").getByLabel("E-Mail-Adresse")`. Its office select defaults to the first office, so pick the test JPA explicitly.
- **Already-active.** Submit the confirmed address again. The reply is identical, the mail subject is `Dein Link zur Abo-Verwaltung`, and the `email_subscription` count is unchanged.
- **Proof.** Run `bun $V/journeys/subscribe-confirm.ts <run>`, which covers the landing entry, `signup-new` and `confirm`. Its output is `evidence/subscribe-confirm/01..04*.png` + `result.json`.

## Gotchas

- Typing before hydration silently loses the input and the button stays disabled. Use `visit()`.
- `confirmState` never returns the manage token, by design. Only the confirm mutation's response (the `Abo verwalten` link) and the welcome mail carry it.
- Throttle (`src/lib/mail-throttle.ts`): 3 mails per address and 10 per IP per hour, in memory. A throttled request gets the same reply but sends no mail and writes no rows. Confirm, manage-link and resend mails all count against an address, so use a new address and don't assume a missing mail is a bug.
- Office-page entry, signed-out `/subscriptions` entry, already-active, reopen and unknown token were driven on 2026-10-19 but are not in the journey.
