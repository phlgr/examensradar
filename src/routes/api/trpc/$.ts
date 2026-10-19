import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";

const handleTRPC = ({ request }: { request: Request }) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext,
	});

export const Route = createFileRoute("/api/trpc/$")({
	server: {
		handlers: {
			GET: handleTRPC,
			POST: handleTRPC,
		},
	},
});
