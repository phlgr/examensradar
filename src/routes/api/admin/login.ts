import { createFileRoute } from "@tanstack/react-router";
import {
	createAdminToken,
	getAdminCookieName,
	verifyAdminPassword,
} from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/login")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const { password } = body;

					if (!password || typeof password !== "string") {
						return new Response(
							JSON.stringify({ error: "Password required" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					if (!verifyAdminPassword(password)) {
						return new Response(JSON.stringify({ error: "Invalid password" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}

					const token = await createAdminToken();
					const cookieName = getAdminCookieName();

					// Set httpOnly cookie with the token
					const isProduction = process.env.NODE_ENV === "production";
					const cookieOptions = [
						`${cookieName}=${token}`,
						"Path=/",
						"HttpOnly",
						"SameSite=Lax",
						`Max-Age=${7 * 24 * 60 * 60}`, // 7 days
					];

					if (isProduction) {
						cookieOptions.push("Secure");
					}

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Set-Cookie": cookieOptions.join("; "),
						},
					});
				} catch (error) {
					console.error("Admin login error:", error);
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
