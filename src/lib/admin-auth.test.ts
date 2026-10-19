import { afterEach, expect, test } from "bun:test";
import { verifyAdminPassword } from "./admin-auth";

const original = process.env.ADMIN_PASSWORD;

afterEach(() => {
	if (original === undefined) delete process.env.ADMIN_PASSWORD;
	else process.env.ADMIN_PASSWORD = original;
});

test("accepts only the exact admin password", () => {
	process.env.ADMIN_PASSWORD = "correct horse";
	expect(verifyAdminPassword("correct horse")).toBe(true);
	expect(verifyAdminPassword("correct hors")).toBe(false);
	expect(verifyAdminPassword("correct horse battery")).toBe(false);
	expect(verifyAdminPassword("")).toBe(false);
});

test("rejects everything when ADMIN_PASSWORD is unset", () => {
	delete process.env.ADMIN_PASSWORD;
	expect(verifyAdminPassword("")).toBe(false);
	expect(verifyAdminPassword("anything")).toBe(false);
});
