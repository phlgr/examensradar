import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { getSubscriberByManageToken } from "@/db";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { getManageTokenFromRequest } from "@/lib/manage-auth";

interface Context {
	request: Request;
	/** Response headers the fetch adapter merges in — how mutations set cookies. */
	resHeaders: Headers;
}

export async function createContext(
	opts: FetchCreateContextFnOptions & { context?: unknown },
): Promise<Context> {
	const { req, resHeaders } = opts;
	return { request: req, resHeaders };
}

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape }) {
		return shape;
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Requires the manage cookie set by `email.signIn`. The subscriber it
 * resolves to is the caller's identity — procedures behind this never take a
 * token or subscriber id as input.
 */
export const manageProcedure = t.procedure.use(async ({ ctx, next }) => {
	const token = getManageTokenFromRequest(ctx.request);
	const subscriber = token ? await getSubscriberByManageToken(token) : null;

	if (!subscriber) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Dieser Link ist nicht mehr gültig.",
		});
	}

	return next({
		ctx: {
			...ctx,
			subscriber,
		},
	});
});

// Admin procedure that requires a valid admin session
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
	const token = getAdminTokenFromRequest(ctx.request);

	if (!token) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Admin authentication required",
		});
	}

	const isValid = await verifyAdminToken(token);
	if (!isValid) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Invalid or expired admin session",
		});
	}

	return next({ ctx });
});
