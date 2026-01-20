import { createFileRoute } from "@tanstack/react-router";
import { type AuthEnv, createAuth } from "@/lib/auth";

async function handleAuth(request: Request) {
	// Validate required environment variables
	if (!process.env.BETTER_AUTH_SECRET) {
		throw new Error("BETTER_AUTH_SECRET environment variable is required");
	}
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		throw new Error(
			"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required",
		);
	}

	const env: AuthEnv = {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	};

	const auth = createAuth(env);
	return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleAuth(request),
			POST: ({ request }) => handleAuth(request),
		},
	},
});
