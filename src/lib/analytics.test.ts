import { expect, test } from "bun:test";
import { maskAnalyticsUrl } from "./analytics";

const BASE = "https://examensradar.de";

test("redacts the token from credential-bearing paths", () => {
	for (const route of ["confirm", "unsubscribe"]) {
		expect(maskAnalyticsUrl(`${BASE}/${route}/s3cr3t-t0ken-value`)).toBe(
			`${BASE}/${route}/REDACTED`,
		);
	}
});

test("redacts the manage token from the query", () => {
	expect(
		maskAnalyticsUrl(`${BASE}/subscriptions?manage=s3cr3t-t0ken-value`),
	).toBe(`${BASE}/subscriptions?manage=REDACTED`);
});

test("leaves ordinary URLs untouched", () => {
	expect(maskAnalyticsUrl(`${BASE}/history`)).toBe(`${BASE}/history`);
	expect(maskAnalyticsUrl(`${BASE}/`)).toBe(`${BASE}/`);
	expect(maskAnalyticsUrl(`${BASE}/subscriptions?foo=bar`)).toBe(
		`${BASE}/subscriptions?foo=bar`,
	);
});

test("does not redact the route index pages themselves", () => {
	expect(maskAnalyticsUrl(`${BASE}/confirm`)).toBe(`${BASE}/confirm`);
});

test("keeps other query parameters while redacting manage", () => {
	const masked = maskAnalyticsUrl(`${BASE}/subscriptions?manage=abc&ref=r`);
	expect(masked).toContain("manage=REDACTED");
	expect(masked).toContain("ref=r");
});

test("drops a URL it cannot parse rather than forwarding it", () => {
	expect(maskAnalyticsUrl("not a url")).toBe("REDACTED");
});
