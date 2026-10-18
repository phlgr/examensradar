import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// Uses bun:sqlite so the deploy needs no native module — drizzle-kit's sqlite
// driver is better-sqlite3, which has no linux prebuild and must be compiled
// with node-gyp.
const databasePath = process.env.DATABASE_PATH || "./data/examensradar.db";

const sqlite = new Database(databasePath);
sqlite.run("PRAGMA journal_mode = WAL");

migrate(drizzle(sqlite), { migrationsFolder: "./drizzle/migrations" });

console.log(`migrations applied to ${databasePath}`);
sqlite.close();
