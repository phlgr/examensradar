# Exam calendar

The NRW offices' Klausur dates appear on their office pages as month pods: the six exam days with subject, the expected (or real) results date, and a calendar download per upcoming sitting. Subscribers of an office with a calendar get the next sittings' calendar links in their welcome mail. The dates come from the offices' PDFs via `bun run calendar:update` (a dev script, not part of the running app).

## Sub-features

- `calendar-pods`: `/ergebnisse/<slug>` for `hamm`, `köln` and `düsseldorf` has the section `Klausurtermine beim <name>` with one pod per sitting: the latest released one (`geschrieben`, `Ergebnisse veröffentlicht am … ✓`), written ones awaiting results (`geschrieben`), a running one (`läuft gerade`) or the next one (`nächster Durchgang`, outlined), and up to six upcoming. Months without a sitting show a `Keine Klausuren` pod from the `sm` breakpoint up. The button `Ältere Veröffentlichungen anzeigen` above the pods reveals older releases. They are in the SSR HTML as `hidden` list items: a release that matches a sitting is a dimmed sitting pod, and an older one is a small `Ergebnisse veröffentlicht am …` card. Offices without a calendar show their releases as small cards under `Ergebnisse beim <name>`, with no toggle. Offices with neither have no section.
- `calendar-results`: each pod ends with `Ergebnisse voraussichtlich` and a date, or `Ende <Monat>` when the office has no release history yet.
- `calendar-download`: upcoming and running pods have the link `In den Kalender` to `/api/kalender/<param>/<first exam day>`. It downloads `klausuren-<monat>-<jahr>.ics` with six all-day exam events ("Viel Erfolg wünscht dir Examensradar!") and a results event. Unknown office or sitting is 404.
- `calendar-event`: clicking the link calls Plausible with `calendar_download` and props `{ jpa: <slug>, sitting: <YYYY-MM-DD> }`.
- `calendar-welcome`: confirming a subscription to an office with a calendar mails a welcome mail with up to three `/api/kalender/<param>/<date>` links (sittings that start after today) under "Klausurtermine in deinen Kalender".

## How to get to it (user POV)

- The office page of Hamm, Köln or Düsseldorf (footer nav `Examensergebnisse nach Prüfungsamt`), section `Klausurtermine beim …`.
- The welcome mail after confirming a subscription to one of those offices.

## Driving it with pw.ts

Preconditions: baseline. The seeded offices `OLG Hamm`, `… Köln` and `… Düsseldorf` have calendars but no release history, so results read `Ende <Monat>` there unless you insert `notification_log` rows into the run DB.

- **Pods.** `visit(base + "/ergebnisse/hamm")`. The h1 `OLG Hamm: Klausurtermine und Ergebnisse im 1. Examen` and the heading `Klausurtermine beim OLG Hamm` are visible; the section's `ol > li` pods render.
- **Download.** Read `href` from the section's first `getByRole("link", { name: "In den Kalender" })`, then `Promise.all([page.waitForEvent("download"), link.click()])`. The suggested filename matches `klausuren-<monat>-<jahr>.ics`; the unfolded file (`replace(/\r\n /g, "")`) has 7 `BEGIN:VEVENT` and the luck message.
- **Plausible.** After `visit()`, replace `window.plausible` with a recorder in `page.evaluate`, then click. It records exactly `calendar_download` with `{ props: { jpa: "hamm", sitting } }`. The real network call to Plausible is not exercised.
- **Welcome links.** Sign up a new address from the Hamm page form, confirm via the mailed link, then `waitForMail(run, email, /Alles bereit/).links` holds 1 to 3 `/api/kalender/hamm/<date>` links; fetching one returns `text/calendar`.
- **Proof.** Run `bun $V/journeys/exam-calendar.ts <run>`. It covers all of the above plus the crawler files from [public-pages](./public-pages.md) (`sitemap.xml` lastmod, `llms.txt` section, `robots.txt`). Its output is `evidence/exam-calendar/` with a pods screenshot and `result.json`.

## Gotchas

- Which pods show, and which is `läuft gerade` or `nächster Durchgang`, depends on the real date. Read dates from the page (the link `href`), don't hardcode months.
- The calendar data is static and ends with the last year published (currently 2028). Once a year's PDFs are out, `bun run calendar:update` regenerates `src/lib/exam-calendar.data.ts`.
- The `.ics` link inside the file and in the mail use `APP_URL`, so on the verify instance they point at the local base.
- Driven end to end on 2026-11-05 with `journeys/exam-calendar.ts`.
