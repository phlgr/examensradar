import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";

async function handleTRPC(request: Request, routerContext: unknown) {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext: (opts) => createContext({ ...opts, context: routerContext }),
	});
}

export const Route = createFileRoute("/api/trpc/$")({
	server: {
		handlers: {
			GET: ({ request, context }) => handleTRPC(request, context),
			POST: ({ request, context }) => handleTRPC(request, context),
		},
	},
});
