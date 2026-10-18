# Manage subscriptions

A confirmed subscriber opens the manage link from any mail. The link is traded for an httpOnly cookie and the token leaves the URL. `/subscriptions` then shows "Angemeldet als <email>" and one card per office, where they can subscribe or unsubscribe per office and sign out. A signed-out visitor can ask for the manage link to be mailed again.

## Sub-features

- `manage-signin`: `/subscriptions?manage=<token>` shows the signed-in view and the URL no longer has `manage=`.
- `manage-add`: "Abonnieren" on an office card adds it and shows the `Aktiv` badge.
- `manage-remove`: "Abbestellen" on an active card removes it.
- `manage-signout`: "Ausloggen" clears the cookie, and the page reloads signed out.
- `manage-resend`: signed out, "Link zuschicken" mails "Dein Link zur Abo-Verwaltung", but only to active addresses. The reply is the same either way.

## How to get to it (user POV)

- The `/subscriptions?manage=…` link in the welcome, manage-link or results mail.
- The "Abo verwalten" button on the confirm success page.
- The "Benachrichtigungen" header link, which reaches `/subscriptions` and is signed out unless the cookie is set.

## Driving it with pw.ts

Preconditions: a confirmed subscriber from [subscribe-confirm](./subscribe-confirm.md), in the same browser context or with the welcome mail's manage link at hand.

- **Sign in.** `visit(manageLink)` from `waitForMail(run, email, /Alles bereit/)`. The text `Angemeldet als` and the address are visible, and `page.url()` has no `manage=`.
- **Add an office.** On the card whose heading is `JPA bei dem OLG Köln`, click its `Abonnieren` button: `page.locator("div", { has: page.getByRole("heading", { name: "JPA bei dem OLG Köln" }) }).getByRole("button", { name: "Abonnieren" })`. The card shows `Aktiv`, and `verify.sh sql` shows an `email_subscription` row for `jpa-olg-koeln`.
- **Remove an office.** On the same card, click `Abbestellen`. `Aktiv` disappears and the row is gone.
- **Sign out.** Click the `Ausloggen` button. After the reload, the signup form and `Link zuschicken` are shown.
- **Resend.** Signed out, `getByLabel("E-Mail-Adresse")` resolves to two fields (signup + resend). Use `.last()` for the resend form, fill in the confirmed address, and click `Link zuschicken`. `waitForMail(run, email, /Abo-Verwaltung/)` arrives. With an unknown `example.test` address, the reply is the same and no mail is captured.
- **Proof.** Take a `proof()` after each step, plus the sql rows before and after add/remove.

## Gotchas

- With the cookie, the signed-in view replaces the signup form. Use a fresh `context` (`v.context.browser().newContext()`) for the signed-out steps, or sign out first.
- The office list has a search box (`Prüfungsamt suchen`) only when there are many offices, so don't rely on it existing.
