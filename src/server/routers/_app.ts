import { router } from "../trpc";
import { emailRouter } from "./email";
import { jpaRouter } from "./jpa";

export const appRouter = router({
	email: emailRouter,
	jpa: jpaRouter,
});

export type AppRouter = typeof appRouter;
