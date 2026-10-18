import { expect, test } from "bun:test";
import { allowMailTo } from "./mail-throttle";

test("case and whitespace variants share one address's mail budget", () => {
	expect(allowMailTo("Throttle@Example.DE", null)).toBe(true);
	expect(allowMailTo(" throttle@example.de", null)).toBe(true);
	expect(allowMailTo("THROTTLE@EXAMPLE.DE ", null)).toBe(true);
	expect(allowMailTo("throttle@example.de", null)).toBe(false);
});
