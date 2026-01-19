import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { createAuth } from "@/lib/auth";
import { getD1 } from "@/lib/d1";

export const Route = createFileRoute("/api/subscriptions/")({
	server: {
		handlers: {
			GET: async ({ request, context }) => {
				const d1 = await getD1(context);
				if (!d1) {
					return Response.json(
						{ error: "Database not configured" },
						{ status: 500 },
					);
				}

				const auth = createAuth(d1, {
					BETTER_AUTH_SECRET:
						process.env.BETTER_AUTH_SECRET ?? "fallback-secret",
					BETTER_AUTH_URL:
						process.env.BETTER_AUTH_URL || "http://localhost:3000",
					GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
					GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
				});
				const session = await auth.api.getSession({ headers: request.headers });

				if (!session?.user) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				const subscriptions = await db.getUserSubscriptions(
					d1,
					session.user.id,
				);
				return Response.json(subscriptions);
			},

			POST: async ({ request, context }) => {
				const d1 = await getD1(context);
				if (!d1) {
					return Response.json(
						{ error: "Database not configured" },
						{ status: 500 },
					);
				}

				const auth = createAuth(d1, {
					BETTER_AUTH_SECRET:
						process.env.BETTER_AUTH_SECRET ?? "fallback-secret",
					BETTER_AUTH_URL:
						process.env.BETTER_AUTH_URL || "http://localhost:3000",
					GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
					GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
				});
				const session = await auth.api.getSession({ headers: request.headers });

				if (!session?.user) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				const body = (await request.json()) as { jpaId: string };
				const { jpaId } = body;

				if (!jpaId) {
					return Response.json({ error: "Missing jpaId" }, { status: 400 });
				}

				// Check if already subscribed
				const existing = await db.getUserSubscriptions(d1, session.user.id);
				if (existing.some((s) => s.jpaId === jpaId)) {
					return Response.json(
						{ error: "Already subscribed" },
						{ status: 400 },
					);
				}

				const subscription = await db.createSubscription(
					d1,
					session.user.id,
					jpaId,
				);
				return Response.json(subscription, { status: 201 });
			},
		},
	},
});
