import { createFileRoute } from "@tanstack/react-router";
import { deleteAdminSession } from "@/db";
import { buildAdminCookie, getAdminTokenFromRequest } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/logout")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const token = getAdminTokenFromRequest(request);
					if (token) {
						await deleteAdminSession(token);
					}

					return Response.json(
						{ success: true },
						{ headers: { "Set-Cookie": buildAdminCookie("", 0) } },
					);
				} catch (error) {
					console.error("Admin logout error:", error);
					return Response.json(
						{ error: "Internal server error" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
