import { Database } from "bun:sqlite";
import { afterAll, mock } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// Preloaded by bunfig.toml. src/db/index.ts opens its one connection when it is
// first imported, and bun runs every test file in the same process — so a
// per-file DATABASE_PATH only takes effect for whichever file loads it first.
// All test files therefore share this one throwaway database.
const DB_PATH = `${process.env.TMPDIR ?? "/tmp"}/examensradar-test-${crypto.randomUUID()}.db`;
process.env.DATABASE_PATH = DB_PATH;

const setup = new Database(DB_PATH);
setup.run("PRAGMA journal_mode = WAL");
migrate(drizzle(setup), { migrationsFolder: "./drizzle/migrations" });
setup.close();

// Stand-in for the SMTP transport: every mail the app hands to nodemailer is
// captured here instead of leaving the machine. Registered before any test
// file loads, so src/lib/mail.ts can never build the real transport.
export type SentMail = {
	to: string;
	subject: string;
	headers?: Record<string, string>;
};
export const sentMails: SentMail[] = [];
mock.module("nodemailer", () => ({
	default: {
		createTransport: () => ({
			sendMail: async (mail: SentMail) => {
				sentMails.push(mail);
				return { messageId: "test" };
			},
		}),
	},
}));
process.env.SMTP_HOST = "smtp.invalid";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";

afterAll(() => {
	for (const suffix of ["", "-wal", "-shm"]) {
		Bun.file(`${DB_PATH}${suffix}`)
			.delete()
			.catch(() => {});
	}
});
