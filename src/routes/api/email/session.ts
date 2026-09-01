import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSubscriberByManageToken } from "@/db";
import { buildClearManageCookie, buildManageCookie } from "@/lib/manage-auth";

const bodySchema = z.object({ token: z.string().min(16).max(64) });

/**
 * Exchanges a manage token for the httpOnly cookie (POST) or clears it
 * (DELETE). The token reaches the page as `/subscriptions?manage=<token>` from
 * mail links; the page trades it in here and scrubs it from the URL, so the
 * credential never sits in the address bar longer than one exchange.
 */
export const Route = createFileRoute("/api/email/session")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = bodySchema.safeParse(
					await request.json().catch(() => null),
				);
				const subscriber = body.success
					? await getSubscriberByManageToken(body.data.token)
					: null;

				if (!body.success || !subscriber) {
					return new Response(null, { status: 401 });
				}

				return new Response(null, {
					status: 200,
					headers: { "Set-Cookie": buildManageCookie(body.data.token) },
				});
			},
			DELETE: async () => {
				return new Response(null, {
					status: 200,
					headers: { "Set-Cookie": buildClearManageCookie() },
				});
			},
		},
	},
});
