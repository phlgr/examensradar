import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { getD1 } from "@/lib/d1";

export const Route = createFileRoute("/api/jpas")({
	server: {
		handlers: {
			GET: async ({ context }) => {
				const d1 = await getD1(context);
				if (!d1) {
					return Response.json(
						{ error: "Database not configured" },
						{ status: 500 },
					);
				}

				const jpas = await db.getJpas(d1);
				return Response.json(jpas);
			},
		},
	},
});
