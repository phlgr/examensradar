import rybbit from "@rybbit/js";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { ANALYTICS_MASK_PATTERNS } from "@/lib/analytics";

window.rybbit = rybbit;
void rybbit.init({
	analyticsHost: "https://data.gartz.dev/api",
	siteId: "c08ec841c4c0",
	maskPatterns: ANALYTICS_MASK_PATTERNS,
});

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
	);
});
