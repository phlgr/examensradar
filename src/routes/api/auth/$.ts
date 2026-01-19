import { createFileRoute } from "@tanstack/react-router";
import { type AuthEnv, createAuth } from "@/lib/auth";
import { getD1 } from "@/lib/d1";

async function handleAuth(request: Request, context: unknown) {
	const d1 = await getD1(context);
	if (!d1) {
		return new Response("Database not configured", { status: 500 });
	}

	const env: AuthEnv = {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "fallback-secret",
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
	};

	const auth = createAuth(d1, env);
	return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request, context }) => handleAuth(request, context),
			POST: ({ request, context }) => handleAuth(request, context),
		},
	},
});
