---
name: verify-examensradar
description: Launch an isolated Examensradar instance (TanStack Start web app) with a throwaway DB, a local SMTP sink and a fixture JPA page, then drive the real browser UI with Playwright and capture screenshots, ARIA snapshots, captured mail and DB state as proof. Use when you need to prove that a change to signup/confirm, subscription management, unsubscribe, the admin scraper ("Jetzt prüfen") or the public pages works in the running app, not just in unit tests.
---

# Verify Examensradar

Examensradar is a web app. Users pick a Justizprüfungsamt (JPA), enter an email address, confirm via a mailed link, and get a "Neue Ergebnisse" mail when the in-app scraper sees the JPA's page change. The main surface is the browser UI. Mail is the second surface, and every journey ends in a mail. Admin lives at `/admin`.

**Safety first:** the subscribers are real exam candidates, and a false "Neue Ergebnisse" mail is exactly the failure this product must never produce. This skill never touches `data/examensradar.db`, `.env.local` or prod. `launch` builds a fresh DB per run and points SMTP at a local sink, so no mail can leave the machine. It also disarms the scraper on every seeded JPA, so nothing polls real JPA sites. Never drive an instance this skill didn't launch, and never drive the user's `bun run dev` on port 3000. It may run with real SMTP creds from `.env.local`.

All commands run from the repo root. `V=.claude/skills/verify-examensradar/scripts`.

## Launch

```bash
$V/verify.sh setup                 # once per machine/worktree: bun install + Playwright toolchain in ~/.cache/examensradar-verify/tools
$V/verify.sh launch myrun          # prints: ready: http://127.0.0.1:<port>  run-id=myrun  evidence=/tmp/examensradar-verify/myrun/evidence
```

`launch` does these steps, starting from an empty run dir `/tmp/examensradar-verify/<run-id>/`:

1. Picks three free ports for the app, the SMTP sink and the fixture page. Parallel runs with different run-ids don't collide.
2. Starts `scripts/sidecar.ts`. It runs an SMTP sink that accepts any auth and stores every message, plus an HTTP fixture at `$FIXTURE_URL` that serves `state/fixture.html` inside `<article id="results">`.
3. Runs `scripts/migrate.ts` and `scripts/seed.ts` into `state/examensradar.db`. Then it nulls `scrape_url`/`scrape_selector` on all seeded JPAs and inserts the test JPA `jpa-verify-test` ("JPA Verifikation (Test)", slug `verify-test`), which watches the fixture.
4. Starts `bunx --bun vite dev` in its own process group with explicit env: `DATABASE_PATH`, `APP_URL=$BASE_URL` (mail links point at this instance), `SMTP_HOST=127.0.0.1` + sink port, `ADMIN_PASSWORD=verify-admin`, and `SCRAPE_INTERVAL_MS=86400000`, so only the boot check runs. That check stores the fixture baseline.
5. Reports **ready** only once `/api/trpc/jpa.getAll` serves the test JPA and the server log shows `[scraper] started`. If it isn't ready after 90 s, it prints the log tail and fails. Run `stop` afterwards anyway.

Run state (pids, DB, logs, mail) lives in `state/`. `state/env` holds `BASE_URL`, `DB`, `FIXTURE_URL`, `EVIDENCE_DIR` and `ADMIN_PASSWORD` for the other commands and for journeys.

## Doctor

```bash
$V/verify.sh doctor myrun
```

Read-only. It checks that the server and sidecar pids are alive and that the app port is owned by our process group. It checks that HTTP serves the test JPA, and that the listening process's real env has `SMTP_HOST=127.0.0.1` and this run's `DATABASE_PATH`. It also checks that no JPA other than the test JPA has a scrape URL, and it prints the git build (`+dirty` when the tree has uncommitted changes). Any `FAIL` means don't drive: stop and relaunch. Run it first, and again whenever something looks off.

## Drive

Journeys are short bun scripts on top of `scripts/pw.ts`, which wraps Playwright (headless Chromium, de-DE, 1280×1600):

```bash
bun $V/journeys/subscribe-confirm.ts myrun     # exits 0 and prints PASS subscribe-confirm
```

`pw.ts` provides the following:
- `open(name)` gives `{ page, base, env, runId, out, visit, proof, note, close }`.
- `visit(url)` means goto plus waiting for React hydration. **Always use it instead of `page.goto`.** SSR renders the forms first, so text typed before hydration is wiped and the submit button stays disabled.
- `proof(label)` writes a numbered screenshot plus an ARIA snapshot. `note(name, data)` writes JSON.
- `mails(runId)` and `waitForMail(runId, to, /subject/)` read what the sink captured. Each entry is `{ n, to, subject, links }`, with links already decoded, so take the confirm, manage and unsubscribe URLs from there.

To write a new journey, copy `journeys/subscribe-confirm.ts`. Use the locators from the matching `features/*.md`: labels, roles and button text, which are all German and literal. Use `example.test` addresses, with a different address for each journey in the same run (the mail throttle in `src/lib/mail-throttle.ts` keys on address and IP).

Other helpers:

```bash
$V/verify.sh mail myrun                       # captured mail, one JSON line each
$V/verify.sh sql myrun "select * from subscriber"   # read-only query on the run DB
$V/verify.sh fixture myrun '<p>Ergebnisse 2026/II</p>'  # change the test JPA's watched page
```

Feature recipes are in [`features/README.md`](features/README.md). Read the index and use every entry point the feature file lists.

## Evidence

Everything goes to `/tmp/examensradar-verify/<run-id>/evidence/`:
- `<journey>/NN-<step>.png` and `.aria.yml` show each user action and the state it produced. `result.json` holds the DB rows and mail entries the journey asserted on.
- `mail/NNN.eml` + `mail/index.jsonl` hold every captured message. `stop` copies them in.
- `logs/server.log`, `sidecar.log` and `db-init.log` are also copied in by `stop`.

Proof standards:
- Drive the real user path: the form, the link from the captured mail, the admin button. Don't use tRPC calls or DB writes to stand in for a step the map describes in the UI. Direct API calls are only acceptable for the API-only entry points the map lists (RFC 8058 one-click POST).
- Capture the action and the resulting state, not only the final screen.
- Verify side effects alongside the UI. That means `subscriber`/`email_subscription`/`notification_log` rows via `verify.sh sql`, and the right mail (recipient, subject, links) via `verify.sh mail`.
- The SMTP sink is the only mock. It sits at the real production boundary (the SMTP connection), and nodemailer, templates and the retry path all run for real. The fixture page stands in for a JPA website at the same kind of boundary (an HTTP fetch).

## Cleanup

```bash
$V/verify.sh stop myrun     # prints: stopped myrun; evidence kept at /tmp/examensradar-verify/myrun/evidence
```

`stop` kills only the two process groups `launch` started (from `state/*.pid`), never by name. It copies logs and mail into `evidence/` and deletes `state/` (DB, pids, fixture). Evidence survives until you delete `/tmp/examensradar-verify/<run-id>` yourself, or until a reboot clears `/tmp`. Run `stop` after every failed attempt too. Then `ss -ltn | grep <port>` should print nothing.

## Gotchas

- `.env.local` in the main checkout holds real Scaleway SMTP creds. `launch` overrides them with explicit env, and `doctor` verifies that the override reached the server. Never start the app another way for verification.
- Worktrees have no `node_modules` and no `data/`. `setup` installs deps, and `launch` never needs `data/`.
- Playwright is deliberately not a repo dependency, so knip and the lockfile stay clean. `pw.ts` imports it from `~/.cache/examensradar-verify/tools`.
- The vite dev server adds TanStack devtools (the floating palm-tree button, bottom right) to screenshots. That's expected in dev.
