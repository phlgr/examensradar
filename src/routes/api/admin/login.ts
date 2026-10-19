import { createFileRoute } from "@tanstack/react-router";
import {
	buildAdminCookie,
	createAdminToken,
	verifyAdminPassword,
} from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/login")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const { password } = await request.json();

					if (!password || typeof password !== "string") {
						return Response.json(
							{ error: "Password required" },
							{ status: 400 },
						);
					}

					if (!verifyAdminPassword(password)) {
						return Response.json(
							{ error: "Invalid password" },
							{ status: 401 },
						);
					}

					const token = await createAdminToken();

					return Response.json(
						{ success: true },
						{ headers: { "Set-Cookie": buildAdminCookie(token) } },
					);
				} catch (error) {
					console.error("Admin login error:", error);
					return Response.json(
						{ error: "Internal server error" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
