import { init } from "@plausible-analytics/tracker";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

// The client entry only runs in the browser, so the analytics tracker — which
// reads `location` at module load — can be imported and initialised here
// directly. autoCapturePageviews (default) tracks SPA navigations via the
// History API.
init({
	domain: "examensradar.de",
	endpoint: "https://apps.gartz.dev/api/event",
});

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
	);
});
