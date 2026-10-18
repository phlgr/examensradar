import { Database } from "bun:sqlite";
import { afterAll, mock } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const DB_PATH = `${process.env.TMPDIR ?? "/tmp"}/examensradar-test-${crypto.randomUUID()}.db`;
process.env.DATABASE_PATH = DB_PATH;

const setup = new Database(DB_PATH);
setup.run("PRAGMA journal_mode = WAL");
migrate(drizzle(setup), { migrationsFolder: "./drizzle/migrations" });
setup.close();

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
