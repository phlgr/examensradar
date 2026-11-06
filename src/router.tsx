import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
	const router = createRouter({
		routeTree,
		context: {},

		scrollRestoration: true,
		scrollRestorationBehavior: "instant",
		defaultPreloadStaleTime: 0,
	});

	return router;
};
