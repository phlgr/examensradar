import { createFileRoute } from "@tanstack/react-router";
import {
	getAdminCookieName,
	getAdminTokenFromRequest,
	invalidateAdminToken,
} from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/logout")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const token = getAdminTokenFromRequest(request);
					if (token) {
						await invalidateAdminToken(token);
					}

					const cookieName = getAdminCookieName();

					// Clear the cookie
					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Max-Age=0`,
						},
					});
				} catch (error) {
					console.error("Admin logout error:", error);
					return new Response(
						JSON.stringify({ error: "Internal server error" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
