import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

interface Context {
	request: Request;
	deviceId: string | null;
}

export async function createContext(
	opts: FetchCreateContextFnOptions & { context?: unknown },
): Promise<Context> {
	const { req } = opts;

	// Extract device ID from header
	const deviceId = req.headers.get("X-Device-ID");

	return {
		request: req,
		deviceId,
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

// Device procedure that requires a device ID header
export const deviceProcedure = t.procedure.use(async ({ ctx, next }) => {
	const deviceId = ctx.deviceId;

	if (!deviceId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Device ID required",
		});
	}

	// Validate device ID format (UUID)
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(deviceId)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid device ID format",
		});
	}

	return next({
		ctx: {
			...ctx,
			deviceId,
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
