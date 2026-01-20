import { defineConfig } from 'drizzle-kit'
import { execSync } from 'child_process'

let dbUrl: string;
try {
  // Dynamically find the database file
  dbUrl = execSync('node scripts/find-db.js', { encoding: 'utf-8' }).trim();
} catch {
  // Fallback for when db doesn't exist yet
  dbUrl = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite';
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl
  }
})
