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
