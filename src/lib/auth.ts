import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/schema";
import { createDrizzleDB } from "./db";

export interface AuthEnv {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
}

export function createAuth(d1: D1Database, env: AuthEnv) {
	const db = createDrizzleDB(d1);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			// Our schema uses camelCase properties in TypeScript
			// but snake_case columns in the database
			// Drizzle handles the mapping, but we tell Better Auth
			// to use camelCase when accessing the Drizzle schema
			camelCase: true,
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			},
		},
		trustedOrigins: [env.BETTER_AUTH_URL],
		advanced: {
			useSecureCookies: process.env.NODE_ENV === "production",
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
