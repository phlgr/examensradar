import { init } from "@plausible-analytics/tracker";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { maskAnalyticsUrl } from "@/lib/analytics";

// The client entry only runs in the browser, so the analytics tracker — which
// reads `location` at module load — can be imported and initialised here
// directly. autoCapturePageviews (default) tracks SPA navigations via the
// History API.
init({
	domain: "examensradar.de",
	endpoint: "https://apps.gartz.dev/api/event",
	// Pageviews are captured automatically, and some of our URLs carry a bearer
	// credential — see maskAnalyticsUrl.
	transformRequest: (payload) => ({
		...payload,
		u: maskAnalyticsUrl(payload.u),
		r: payload.r ? maskAnalyticsUrl(payload.r) : payload.r,
	}),
});

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
	);
});
