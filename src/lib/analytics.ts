// Thin, SSR-safe wrapper around the Plausible tracker. The tracker sets
// `window.plausible` on init (see src/client.tsx); we call through that rather
// than importing @plausible-analytics/tracker into components, since that
// package reads `location` at module load and would crash server rendering.

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

/** First path segment of the routes whose second segment is a credential. */
const TOKEN_ROUTES = new Set(["confirm", "unsubscribe"]);
/** Query parameters that carry a credential (`?manage=` token, `?restore=` device id). */
const TOKEN_PARAMS = ["manage", "restore"];
const REDACTED = "REDACTED";

/**
 * Strips bearer credentials out of a URL before analytics sees it.
 *
 * `/confirm/<token>` and its siblings put the credential in the path, and
 * `?manage=<token>` / `?restore=<deviceId>` put one in the query — each is
 * enough on its own to act as the subscriber. Plausible captures pageviews
 * automatically, so without this every such visit would file the credential
 * away in analytics storage, where nothing treats it as a secret.
 *
 * The referrer needs the same treatment: navigating away from
 * `/confirm/<token>` sends that URL as the referrer of the next pageview.
 *
 * Paths are kept in shape (`/confirm/REDACTED`) so they still aggregate.
 */
export function maskAnalyticsUrl(raw: string): string {
	let url: URL;

	try {
		url = new URL(raw);
	} catch {
		// Not parseable, so it cannot be reasoned about — drop it rather than
		// forward something unexamined.
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
