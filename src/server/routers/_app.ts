import { router } from "../trpc";
import { jpaRouter } from "./jpa";
import { subscriptionRouter } from "./subscription";
import { userRouter } from "./user";

export const appRouter = router({
	jpa: jpaRouter,
	subscription: subscriptionRouter,
	user: userRouter,
});

export type AppRouter = typeof appRouter;
