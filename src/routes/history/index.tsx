import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/history/")({
	server: {
		handlers: {
			GET: () =>
				new Response(null, {
					status: 301,
					headers: { Location: "/ergebnisse" },
				}),
		},
	},
});
