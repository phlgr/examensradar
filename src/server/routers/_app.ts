import { router } from "../trpc";
import { adminRouter } from "./admin";
import { emailRouter } from "./email";
import { jpaRouter } from "./jpa";
import { subscriptionRouter } from "./subscription";
import { userRouter } from "./user";

export const appRouter = router({
	admin: adminRouter,
	email: emailRouter,
	jpa: jpaRouter,
	subscription: subscriptionRouter,
	user: userRouter,
});

export type AppRouter = typeof appRouter;
