import { router } from "../trpc";
import { adminRouter } from "./admin";
import { jpaRouter } from "./jpa";
import { subscriptionRouter } from "./subscription";
import { userRouter } from "./user";

export const appRouter = router({
	admin: adminRouter,
	jpa: jpaRouter,
	subscription: subscriptionRouter,
	user: userRouter,
});

export type AppRouter = typeof appRouter;
