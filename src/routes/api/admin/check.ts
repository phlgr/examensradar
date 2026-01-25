import { createFileRoute } from "@tanstack/react-router";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/check")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					const token = getAdminTokenFromRequest(request);

					if (!token) {
						return new Response(JSON.stringify({ authenticated: false }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}

					const isValid = await verifyAdminToken(token);

					return new Response(JSON.stringify({ authenticated: isValid }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Admin check error:", error);
					return new Response(JSON.stringify({ authenticated: false }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
			},
		},
	},
});
