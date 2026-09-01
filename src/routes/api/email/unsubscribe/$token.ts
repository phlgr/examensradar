import { createFileRoute } from "@tanstack/react-router";
import { getSubscriberByUnsubscribeToken, unsubscribeSubscriber } from "@/db";

/**
 * The List-Unsubscribe / List-Unsubscribe-Post target (RFC 8058), also POSTed
 * by the /unsubscribe/:token page's button.
 *
 * POST-only on purpose: this URL is published to Gmail and every scanner
 * between us and the inbox, and scanners follow GETs. It renders nothing,
 * reveals nothing about the address, and can do nothing but unsubscribe.
 * Idempotent, so Gmail's one-click and a human's button press can both land.
 */
export const Route = createFileRoute("/api/email/unsubscribe/$token")({
	server: {
		handlers: {
			// Explicit, so a scanner GET can never fall through to anything.
			GET: async () =>
				new Response(null, { status: 405, headers: { Allow: "POST" } }),
			POST: async ({ params }) => {
				const subscriber = await getSubscriberByUnsubscribeToken(params.token);

				if (!subscriber) {
					return new Response(null, { status: 404 });
				}

				await unsubscribeSubscriber(subscriber.id);
				return new Response(null, { status: 200 });
			},
		},
	},
});
