import { createFileRoute } from "@tanstack/react-router";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/check")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					const token = getAdminTokenFromRequest(request);
					const authenticated = token ? await verifyAdminToken(token) : false;
					return Response.json({ authenticated });
				} catch (error) {
					console.error("Admin check error:", error);
					return Response.json({ authenticated: false });
				}
			},
		},
	},
});
