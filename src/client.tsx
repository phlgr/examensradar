import { init } from "@plausible-analytics/tracker";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { maskAnalyticsUrl } from "@/lib/analytics";

init({
	domain: "examensradar.de",
	endpoint: "https://apps.gartz.dev/api/event",
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
