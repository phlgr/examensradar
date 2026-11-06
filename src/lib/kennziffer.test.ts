import { describe, expect, test } from "bun:test";
import { normalizeKennziffer } from "./kennziffer.ts";

describe("normalizeKennziffer", () => {
	test.each([
		["6334/26", "6334/26"],
		[" 6334 / 26 ", "6334/26"],
		["6334-26", "6334/26"],
		["0997/24", "997/24"],
		["9/24", "9/24"],
	])("reads %p as %p", (input, expected) => {
		expect(normalizeKennziffer(input)).toBe(expected);
	});

	test.each([
		"",
		"6334",
		"6334/",
		"/26",
		"abc/26",
		"6334/2026",
		"12345/26",
		"0/26",
		"63 34/26",
	])("rejects %p", (input) => {
		expect(normalizeKennziffer(input)).toBeNull();
	});
});
