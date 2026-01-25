import { adminProcedure, router } from "../trpc";

export const adminRouter = router({
	getWebhookSecret: adminProcedure.query(() => {
		return process.env.WEBHOOK_SECRET ?? null;
	}),
});
