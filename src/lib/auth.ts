import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, haveIBeenPwned } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

export interface AuthEnv {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	ADMIN_USER_IDS?: string;
}

export function createAuth(env: AuthEnv) {
	// Parse admin user IDs from environment (comma-separated)
	const adminUserIds =
		env.ADMIN_USER_IDS?.split(",")
			.map((id) => id.trim())
			.filter(Boolean) ?? [];

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		plugins: [
			haveIBeenPwned(),
			admin({
				adminUserIds,
			}),
		],
		emailAndPassword: {
			enabled: true,
		},
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
