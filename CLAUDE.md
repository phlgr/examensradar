# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Examensradar sends email notifications when German judicial examination offices (JPAs) publish new exam results. Users subscribe to JPAs by email (double opt-in, magic-link management) - no app installation or account required.

## Commands

```bash
bun run dev          # Start dev server on port 3000
bun run build        # Build for production
bun run start        # Run production build

bun run lint         # Run type checking (tsgo) + Biome fix
bun run lint:types   # Type check only (tsgo)
bun run lint:fix     # Biome lint/format only

bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Apply migrations
bun run db:seed      # Seed database with JPAs
# db:studio was removed — drizzle-kit's sqlite driver is better-sqlite3, which
# has no linux prebuild and needs node-gyp. Use the drizzle-gateway container
# on the server for a GUI.
```

## Architecture

**TanStack Start + tRPC + Drizzle**

```
src/
├── routes/           # File-based routing (TanStack Router)
│   ├── api/          # Server endpoints (admin auth, email unsubscribe, tRPC)
│   └── *.tsx         # Page components
├── server/
│   ├── trpc.ts       # tRPC context + procedures (publicProcedure, manageProcedure, adminProcedure)
│   └── routers/      # tRPC routers merged in _app.ts
├── db/
│   ├── schema.ts     # Drizzle schema (jpa, subscription, notificationLog, adminSession)
│   └── index.ts      # Database queries (exported functions, not raw db access)
└── lib/              # Utilities (mail, device ID, admin auth, tRPC client)
```

**Key patterns:**
- No user accounts: subscribers manage their subscriptions via a magic-link manage cookie
- Three tRPC procedure types: `publicProcedure`, `manageProcedure` (requires manage cookie), `adminProcedure` (requires admin session)
- In-app scraper (`src/server/scraper.ts`, booted at server start by the nitro plugin in `src/server/plugins/scraper.ts`) polls each JPA's `scrapeUrl`/`scrapeSelector` and fans out via `src/server/notify-results.ts`; a compare-and-swap on `scrape_state.content_hash` guarantees a change is only notified once even with overlapping instances. Manual triggering goes through the admin page's "Jetzt prüfen" (`jpa.scrapeNow`), which runs the same CAS-guarded check
- Notifications sent via mail (see `src/lib/mail.ts`); ntfy push is sunset — legacy `subscription` rows remain in the DB but are never read or notified

**Database:** Bun SQLite with Drizzle ORM. Path: `./data/examensradar.db`

## Code Style

- **Formatter:** Biome with tabs, double quotes
- **Pre-commit:** lefthook runs type checking, Biome fix, and knip (unused exports)
- **Imports:** Use `@/` alias for `src/` directory
