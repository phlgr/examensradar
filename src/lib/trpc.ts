import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers/_app";
import { getOrCreateDeviceId } from "./device-id";

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
	return trpc.createClient({
		links: [
			httpBatchLink({
				url: "/api/trpc",
				transformer: superjson,
				headers() {
					// Only add device ID on client side
					if (typeof window !== "undefined") {
						return {
							"X-Device-ID": getOrCreateDeviceId(),
						};
					}
					return {};
				},
			}),
		],
	});
}
