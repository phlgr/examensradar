declare global {
	interface Window {
		plausible?: (
			event: string,
			options?: { props?: Record<string, string | number | boolean> },
		) => void;
	}
}

export function trackEvent(
	event: string,
	props?: Record<string, string | number | boolean>,
): void {
	if (typeof window === "undefined") return;
	window.plausible?.(event, props ? { props } : undefined);
}

const TOKEN_ROUTES = new Set(["confirm", "unsubscribe"]);
const TOKEN_PARAMS = ["manage"];
const REDACTED = "REDACTED";

export function maskAnalyticsUrl(raw: string): string {
	let url: URL;

	try {
		url = new URL(raw);
	} catch {
		return REDACTED;
	}

	const segments = url.pathname.split("/");

	if (segments[1] && TOKEN_ROUTES.has(segments[1]) && segments[2]) {
		segments[2] = REDACTED;
		url.pathname = segments.join("/");
	}

	for (const param of TOKEN_PARAMS) {
		if (url.searchParams.has(param)) {
			url.searchParams.set(param, REDACTED);
		}
	}

	return url.toString();
}
