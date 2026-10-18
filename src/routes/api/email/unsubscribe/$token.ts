import { createFileRoute } from "@tanstack/react-router";
import { getSubscriberByUnsubscribeToken, unsubscribeSubscriber } from "@/db";

/** The List-Unsubscribe / List-Unsubscribe-Post target (RFC 8058). */
export const Route = createFileRoute("/api/email/unsubscribe/$token")({
	server: {
		handlers: {
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
