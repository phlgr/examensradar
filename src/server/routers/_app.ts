import { router } from "../trpc";
import { emailRouter } from "./email";
import { jpaRouter } from "./jpa";
import { subscriptionRouter } from "./subscription";

export const appRouter = router({
	email: emailRouter,
	jpa: jpaRouter,
	subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
