import { router } from "../trpc";
import { jpaRouter } from "./jpa";
import { subscriptionRouter } from "./subscription";

export const appRouter = router({
	jpa: jpaRouter,
	subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
