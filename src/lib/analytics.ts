declare global {
	interface Window {
		rybbit?: {
			event: (
				name: string,
				properties?: Record<string, string | number | boolean>,
			) => void;
		};
	}
}

export function trackEvent(
	event: string,
	props?: Record<string, string | number | boolean>,
): void {
	if (typeof window === "undefined") return;
	window.rybbit?.event(event, props);
}

// Paths that carry a credential. Rybbit replaces a matching path with the
// pattern itself and drops its query string, so neither the confirm/unsubscribe
// token nor the `?manage=` token ever reaches analytics. Referrers are cut to
// the origin by the `referrer` meta tag in __root.tsx.
export const ANALYTICS_MASK_PATTERNS = [
	"/confirm/*",
	"/unsubscribe/*",
	"/subscriptions",
	"/subscriptions/",
];
