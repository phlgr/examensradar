import { createFileRoute } from "@tanstack/react-router";
import { getJpaBySlug } from "@/db";
import { queueResultsNotifications } from "@/server/notify-results";

interface WebhookPayload {
	jpa_slug: string;
}

/**
 * Manual escape hatch for triggering a results notification from outside —
 * kept after the scraper moved in-app so an external checker (or a curl from
 * the admin) can still fan out a publication the scraper missed.
 */
export const Route = createFileRoute("/api/webhook/results")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// Verify webhook secret
				const authHeader = request.headers.get("Authorization");
				const expectedSecret = process.env.WEBHOOK_SECRET;

				if (!expectedSecret) {
					console.error("WEBHOOK_SECRET not configured");
					return Response.json(
						{ error: "Server misconfigured" },
						{ status: 500 },
					);
				}

				if (authHeader !== `Bearer ${expectedSecret}`) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				let body: WebhookPayload;
				try {
					body = (await request.json()) as WebhookPayload;
				} catch {
					return Response.json({ error: "Invalid JSON" }, { status: 400 });
				}

				const { jpa_slug } = body;
				if (!jpa_slug) {
					return Response.json({ error: "Missing jpa_slug" }, { status: 400 });
				}

				const jpa = await getJpaBySlug(jpa_slug);
				if (!jpa) {
					return Response.json({ error: "JPA not found" }, { status: 404 });
				}

				const outcome = await queueResultsNotifications(jpa);

				if (outcome.status === "disabled") {
					return Response.json({
						message: "Notifications disabled for this JPA",
						sent: 0,
					});
				}

				if (outcome.push === 0 && outcome.mail === 0) {
					return Response.json({ message: "No subscribers", sent: 0 });
				}

				// 202: the fan-out is queued, not delivered — see
				// queueResultsNotifications for why nobody waits on it.
				return Response.json(
					{
						message: "Notifications queued",
						jpa: jpa.slug,
						notifiable: outcome.push + outcome.mail,
						push: outcome.push,
						mail: outcome.mail,
						total: outcome.total,
					},
					{ status: 202 },
				);
			},
		},
	},
});
