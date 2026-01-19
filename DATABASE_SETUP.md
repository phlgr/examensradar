# Database Setup - Cloudflare D1 + Drizzle + Better Auth

This document explains the unified database setup for the Examensradar project.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│  (API Routes, Server Functions)                     │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────┐              ┌──────────────────┐
│   Drizzle    │              │   Better Auth    │
│   (src/db)   │              │   (Drizzle       │
│              │              │    Adapter)      │
└──────────────┘              └──────────────────┘
        │                               │
        └───────────────┬───────────────┘
                        ▼
                ┌──────────────┐
                │  Cloudflare  │
                │      D1      │
                │  (SQLite)    │
                └──────────────┘
```

## Key Components

### 1. Schema Definition (`src/db/schema.ts`)

**Single source of truth** for all database tables:
- Auth tables: `user`, `session`, `account`, `verification`
- App tables: `jpa`, `subscription`, `notificationLog`

**Important**: 
- TypeScript properties use **camelCase** (e.g., `websiteUrl`, `createdAt`)
- Database columns use **snake_case** (e.g., `website_url`, `created_at`)
- Drizzle handles the mapping automatically

Example:
```typescript
export const jpa = sqliteTable("jpa", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),  // TS: websiteUrl, DB: website_url
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

### 2. Database Layer (`src/db/index.ts`)

Uses **Drizzle ORM exclusively** - no raw SQL queries.

Benefits:
- Type-safe queries
- Automatic camelCase ↔ snake_case mapping
- Consistent API across all operations

Example:
```typescript
async getJpas(d1: D1Database): Promise<JPA[]> {
  const drizzle = createDrizzleDB(d1);
  return drizzle.select().from(schema.jpa).all();
}
```

### 3. Better Auth (`src/lib/auth.ts`)

Uses **Drizzle Adapter** directly:
```typescript
import { drizzleAdapter } from "better-auth/adapters/drizzle";

return betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    camelCase: true,  // Important! Our schema uses camelCase
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // ... other config
});
```

**Important**: Set `camelCase: true` because:
- TypeScript schema properties are camelCase (e.g., `expiresAt`)
- Database columns are snake_case (e.g., `expires_at`)
- Drizzle handles the mapping automatically
- Better Auth needs to know to use camelCase when accessing the schema

Benefits:
- No manual field mapping needed
- Works seamlessly with Drizzle schema
- Better Auth handles all auth operations

### 4. Drizzle Helper (`src/lib/db.ts`)

Creates Drizzle instance from D1:
```typescript
export function createDrizzleDB(d1: D1Database) {
  return drizzle(d1, { schema });
}
```

## Data Flow

### Reading Data

```
API Route → db.getJpas(d1) → Drizzle ORM → D1 Database
                                ↓
                    Returns: { websiteUrl: "..." }
                             (camelCase, as defined in schema)
```

### Writing Data

```
API Route → db.createSubscription(d1, ...) → Drizzle ORM
                                                ↓
                                    INSERT INTO subscription 
                                    (website_url, ...)
                                    (snake_case in DB)
```

## Database Migrations

### Local Development

```bash
# 1. Generate migration from schema changes
npm run db:generate

# 2. Apply migrations locally
npm run db:migrate:local

# 3. Seed database (optional)
npm run db:seed:local

# 4. Start dev server
npm run dev
```

### Production

```bash
# Apply migrations to production
npm run db:migrate:remote

# Seed production (if needed)
npm run db:seed:remote
```

## Common Patterns

### Querying with Filters

```typescript
import { eq, and } from "drizzle-orm";

// Single condition
const jpa = await drizzle
  .select()
  .from(schema.jpa)
  .where(eq(schema.jpa.slug, "example"))
  .get();

// Multiple conditions
await drizzle
  .delete(schema.subscription)
  .where(
    and(
      eq(schema.subscription.id, id),
      eq(schema.subscription.userId, userId)
    )
  )
  .run();
```

### Inserting Data

```typescript
await drizzle
  .insert(schema.jpa)
  .values({
    id: nanoid(),
    slug: "example",
    name: "Example JPA",
    websiteUrl: "https://example.com",
    createdAt: Date.now(),
  })
  .run();
```

### Type Safety

```typescript
// Infer types from schema
export type JPA = typeof schema.jpa.$inferSelect;
export type Subscription = typeof schema.subscription.$inferSelect;

// Use in functions
async function processJPA(jpa: JPA) {
  console.log(jpa.websiteUrl); // TypeScript knows this exists
}
```

## Troubleshooting

### Column name mismatch errors

**Symptom**: `no such column: websiteUrl` or `no such column: website_url`

**Solution**: 
- Check that schema uses camelCase for TS properties
- Verify snake_case is used for column names
- Use Drizzle ORM, not raw SQL

### Better Auth errors

**Symptom**: Auth operations fail with column errors

**Solution**:
- Ensure using `drizzleAdapter`
- Verify auth tables in schema match Better Auth expectations
- Check that `AuthEnv` is passed correctly to `createAuth()`

### Migration issues

**Symptom**: Schema and DB out of sync

**Solution**:
```bash
# Regenerate migrations
npm run db:generate

# For local dev, you can reset:
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
npm run db:seed:local
```

## Best Practices

1. ✅ **Always use Drizzle ORM** - No raw SQL queries
2. ✅ **Single schema file** - All tables in `src/db/schema.ts`
3. ✅ **Type inference** - Use `$inferSelect` and `$inferInsert`
4. ✅ **Consistent naming** - camelCase in TS, snake_case in DB
5. ✅ **Run migrations** - After any schema changes

## Files Reference

- `src/db/schema.ts` - All table definitions
- `src/db/index.ts` - Database query functions (Drizzle)
- `src/lib/db.ts` - Drizzle instance creator
- `src/lib/auth.ts` - Better Auth configuration
- `drizzle.config.ts` - Drizzle Kit configuration
- `drizzle/migrations/` - Generated migration files
- `src/db/seed.sql` - Seed data
