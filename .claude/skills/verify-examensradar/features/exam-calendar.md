# Exam calendar

Every office's Klausur dates appear on its office page as month pods: the exam days (with subject when known), the expected (or real) results date, and a calendar download per upcoming sitting. Offices of one Land share one calendar (the three NRW offices). Subscribers of an office get the next sittings' calendar links in their welcome mail. The dates come from the offices' pages and PDFs via `bun run calendar:update` (a dev script, not part of the running app).

Sittings come in three shapes:
- **Days with subjects** stated by the office: NRW (6 days), Niedersachsen (6), Berlin-Brandenburg (7, two in criminal law).
- **Days with inferred subjects**: Bremen, Thüringen and Schleswig-Holstein name the days but no subjects. Subjects are copied from other Länder writing the same days and the pod says `Fächer laut Terminplan <Länder>, verbindlich ist deine Ladung.` Days no other Land covers (Schleswig-Holstein's seventh exam) show just the date.
- **Range only**: Bayern and Baden-Württemberg publish only the first and last day. The pod says `Einzelne Klausurtage nennt das Prüfungsamt nicht.` and has no day list.

## Sub-features

- `calendar-pods`: `/ergebnisse/<slug>` for every office in `OFFICE_SOURCES` (`src/lib/exam-calendar.data.ts`) has the section `Klausurtermine beim <name>` with one pod per sitting: the latest released one (`geschrieben`, `Ergebnisse veröffentlicht am … ✓`), written ones awaiting results (`geschrieben`), a running one (`läuft gerade`) or the next one (`nächster Durchgang`, outlined), and up to six upcoming. A run of months without a sitting shows one `Keine Klausuren` pod (`Juli`, or `Oktober – Februar`) from the `sm` breakpoint up. The legend `ZR Zivilrecht · ÖR Öffentliches Recht · SR Strafrecht` shows only when some day has a subject. The intro says `Die Termine gelten für alle Justizprüfungsämter in <Land>.` only when another office shares the calendar. The button `Ältere Veröffentlichungen anzeigen` above the pods reveals older releases. They are in the SSR HTML as `hidden` list items: a release that matches a sitting is a dimmed sitting pod, and an older one is a small `Ergebnisse veröffentlicht am …` card. Offices without a calendar show their releases as small cards under `Ergebnisse beim <name>`, with no toggle. Offices with neither have no section.
- `calendar-results`: each pod ends with `Ergebnisse voraussichtlich` and a date, or `Ende <Monat>` when the office has no release history yet.
- `calendar-download`: upcoming and running pods have the link `In den Kalender` to `/api/kalender/<param>/<sitting start>`. It downloads `klausuren-<monat>-<jahr>.ics` with one all-day event per exam day ("Viel Erfolg wünscht dir Examensradar!", summary `Examensklausur` plus the subject when known, an "Das Fach stammt aus dem gemeinsamen Terminplan (…)" note when inferred) and a results event. A range-only sitting is one multi-day event `Examensklausuren` from start to end. Unknown office or sitting is 404.
- `calendar-event`: clicking the link calls Rybbit with `calendar_download` and props `{ jpa: <office display name, e.g. "OLG Hamm">, sitting: <YYYY-MM-DD>, month: <YYYY-MM> }`.
- `calendar-welcome`: confirming a subscription to an office with a calendar mails a welcome mail with up to three `/api/kalender/<param>/<date>` links (sittings that start after today) under "Klausurtermine in deinen Kalender".

## How to get to it (user POV)

- Any office page (footer nav `Examensergebnisse nach Prüfungsamt`), section `Klausurtermine beim …`.
- The welcome mail after confirming a subscription.

## Driving it with pw.ts

Preconditions: baseline. The seeded offices have calendars but no release history, so results read `Ende <Monat>` unless you insert `notification_log` rows into the run DB. The non-NRW offices come from migration `0009_add-non-nrw-jpas.sql`, which `launch` applies.

- **Pods.** `visit(base + "/ergebnisse/hamm")`. The h1 `OLG Hamm: Klausurtermine und Ergebnisse im 1. Examen` and the heading `Klausurtermine beim OLG Hamm` are visible; the section's `ol > li` pods render. The current pod is the `li` with text `nächster Durchgang` or `läuft gerade`; its days are `ul > li`.
- **Download.** Read `href` from the section's first `getByRole("link", { name: "In den Kalender" })`, then `Promise.all([page.waitForEvent("download"), link.click()])`. The suggested filename matches `klausuren-<monat>-<jahr>.ics`; the unfolded file (`replace(/\r\n /g, "")`) has one `BEGIN:VEVENT` per exam day plus the results event (7 for NRW) and the luck message.
- **Other shapes.** `/ergebnisse/bremen` (`JPA Bremen`): six days with subjects and the `Fächer laut Terminplan Nordrhein-Westfalen` line; its ics carries the not-confirmed note. `/ergebnisse/bayern` (`LJPA Bayern`): no day list, no legend; its ics has 2 events, the range event `SUMMARY:Examensklausuren` with `DTEND` the day after the last exam. `/ergebnisse/berlin-brandenburg` (`GJPA Berlin-Brandenburg`): seven days, two `SR`.
- **Rybbit.** After `visit()`, replace `window.rybbit.event` with a recorder in `page.evaluate`, then click. It records exactly `calendar_download` with `{ jpa: "OLG Hamm", sitting, month }`. The real network call to Rybbit is not exercised.
- **Welcome links.** Sign up a new address from the Hamm page form, confirm via the mailed link, then `waitForMail(run, email, /Alles bereit/).links` holds 1 to 3 `/api/kalender/hamm/<date>` links; fetching one returns `text/calendar`.
- **Proof.** Run `bun $V/journeys/exam-calendar.ts <run>`. It covers all of the above plus the crawler files from [public-pages](./public-pages.md) (`sitemap.xml` lastmod, `llms.txt` section, `robots.txt`). Its output is `evidence/exam-calendar/` with a screenshot per office (Hamm, Bremen, Bayern, Berlin-Brandenburg), the downloaded Bremen and Bayern `.ics` files and `result.json`.

## Gotchas

- Which pods show, and which is `läuft gerade` or `nächster Durchgang`, depends on the real date. Read dates from the page (the link `href`), don't hardcode months.
- The calendar data is static and ends with the last year each office published. `bun run calendar:update` regenerates `src/lib/exam-calendar.data.ts`; it keeps sittings the sources no longer list (Thüringen and Schleswig-Holstein show only upcoming ones) and is idempotent.
- The `.ics` link inside the file and in the mail use `APP_URL`, so on the verify instance they point at the local base.
- Driven end to end on 2026-11-14 with `journeys/exam-calendar.ts`.
