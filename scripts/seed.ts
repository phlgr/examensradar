import { Database } from "bun:sqlite";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/examensradar.db";
const sqlite = new Database(DATABASE_PATH);

const seedSql = await Bun.file("./src/db/seed.sql").text();
sqlite.run(seedSql);

console.log("Seed data inserted!");
sqlite.close();
