# Unsubscribe

The welcome, manage-link and results mails carry an unsubscribe link and RFC 8058 `List-Unsubscribe` headers. The confirm mail carries neither. The `/unsubscribe/:token` page asks once ("Abmelden"), and "Jetzt abmelden" ends all mail to that address. Mail clients can do the same with a one-click POST. A GET to the API URL does nothing (405), so link scanners can't unsubscribe anyone.

## Sub-features

- `unsub-page`: `/unsubscribe/<token>` shows the heading `Abmelden`. The `Jetzt abmelden` button leads to the heading `Abgemeldet.`
- `unsub-oneclick`: `POST /api/email/unsubscribe/<token>` returns 200 and sets `unsubscribed_at`. Both paths also delete every `email_subscription` row of that address.
- `unsub-invalid`: on `/unsubscribe/<unknown token>`, `Jetzt abmelden` shows `Dieser Link ist nicht mehr gültig.`
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
- **One-click.** With a second confirmed address, read the `List-Unsubscribe:` header from its `.eml` (unfold it first: `eml.replace(/\r?\n[ \t]+/g, " ")`) and `fetch(url, { method: "POST" })` it. It returns 200, `unsubscribed_at` is set and `select count(*) from email_subscription where subscriber_id = …` is 0. This API-only entry point is the one place a direct request is the real user path.
- **Invalid link.** `visit(base + "/unsubscribe/nope")`, click `Jetzt abmelden`. `Dieser Link ist nicht mehr gültig.` appears.
- **GET inert.** `fetch(url)` returns 405 and `unsubscribed_at` stays null (check with an address that is still subscribed).
- **Sticky.** After the one-click POST, sign the second address up again from the landing form. It gets a new confirm mail, and its row has `confirmed_at` null with `unsubscribed_at` still set until it confirms.
- **Proof.** Run `bun $V/journeys/unsubscribe.ts <run>` last, after the other journeys. It covers `unsub-get-inert` (using the welcome mail's `List-Unsubscribe` header) and `unsub-page`. Its output is `evidence/unsubscribe/01..02*.png` + `result.json`. `unsub-oneclick`, `unsub-invalid` and `unsub-sticky` are not in the journey. One-click (200, subscriptions deleted) and the invalid-link page were driven on 2026-11-05 with an ad-hoc script; sticky re-signup and the 404 for an unknown one-click token on 2026-10-19.

## Gotchas

- Unsubscribed rows are deliberately kept (suppression list), so don't expect the subscriber row to disappear.
