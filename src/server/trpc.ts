import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { type AuthEnv, createAuth } from "@/lib/auth";
import { getD1 } from "@/lib/d1";

interface Context {
	d1: D1Database | null;
	auth: ReturnType<typeof createAuth> | null;
	request: Request;
	env: AuthEnv;
}

export async function createContext(
	opts: FetchCreateContextFnOptions & { context?: unknown },
): Promise<Context> {
	const { req } = opts;
	// Get D1 from context - pass the context from TanStack Router
	const d1 = await getD1(opts.context);

	// Validate required environment variables
	if (!process.env.BETTER_AUTH_SECRET) {
		throw new Error("BETTER_AUTH_SECRET environment variable is required");
	}
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		throw new Error(
			"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required",
		);
	}

	const env: AuthEnv = {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	};

	const auth = d1 ? createAuth(d1, env) : null;

	return {
		d1,
		auth,
		request: req,
		env,
	};
}

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape }) {
		return shape;
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.auth || !ctx.d1) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Database not configured",
		});
	}

	const session = await ctx.auth.api.getSession({
		headers: ctx.request.headers,
	});

	if (!session?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	return next({
		ctx: {
			...ctx,
			d1: ctx.d1,
			auth: ctx.auth,
			session,
			user: session.user,
		},
	});
});
