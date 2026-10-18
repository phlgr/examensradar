# Unsubscribe

Every list mail carries an unsubscribe link and RFC 8058 `List-Unsubscribe` headers. The `/unsubscribe/:token` page asks once ("Abmelden"), and "Jetzt abmelden" ends all mail to that address. Mail clients can do the same with a one-click POST. A GET to the API URL does nothing (405), so link scanners can't unsubscribe anyone.

## Sub-features

- `unsub-page`: `/unsubscribe/<token>` shows the heading `Abmelden`. The `Jetzt abmelden` button leads to the heading `Abgemeldet.`
- `unsub-oneclick`: `POST /api/email/unsubscribe/<token>` returns 200 and sets `unsubscribed_at`.
- `unsub-get-inert`: `GET /api/email/unsubscribe/<token>` returns 405 and changes nothing.
- `unsub-sticky`: after unsubscribing, signing up the address again from the form doesn't re-activate it without a new confirm.

## How to get to it (user POV)

- The "Abmelden" link in the footer of the welcome, manage-link or results mail (`/unsubscribe/…` in `links`).
- The mail client's own unsubscribe button. That's the one-click POST, using the `List-Unsubscribe` header in `mail/NNN.eml`.

## Driving it with pw.ts

Preconditions: a confirmed subscriber and its welcome mail.

- **Open the page.** Take `unsubLink` from `waitForMail(run, email, /Alles bereit/).links` (the one containing `/unsubscribe/`), then `visit(unsubLink)`. The heading `Abmelden` is shown.
- **Unsubscribe.** Click the `Jetzt abmelden` button. The heading `Abgemeldet.` appears.
- **Second view.** `verify.sh sql <run> "select unsubscribed_at from subscriber where email='<email>'"` is non-null.
- **One-click.** With a second confirmed address, read the `List-Unsubscribe:` header from its `.eml` and `fetch(url, { method: "POST" })` it. It returns 200 and `unsubscribed_at` is set. This API-only entry point is the one place a direct request is the real user path.
- **GET inert.** `fetch(url)` returns 405 and `unsubscribed_at` stays null (check with an address that is still subscribed).
- **Proof.** Screenshots of both page states, the sql row, and the HTTP status codes in `note()`.

## Gotchas

- Unsubscribed rows are deliberately kept (suppression list), so don't expect the subscriber row to disappear.
