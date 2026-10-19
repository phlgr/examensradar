import { createHash, timingSafeEqual } from "node:crypto";
import {
	createAdminSession,
	deleteAdminSession,
	getAdminSessionByToken,
} from "@/db";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_S = 7 * 24 * 60 * 60;

export function verifyAdminPassword(password: string): boolean {
	const adminPassword = process.env.ADMIN_PASSWORD;
	if (!adminPassword) {
		console.error("ADMIN_PASSWORD environment variable is not set");
		return false;
	}
	// Hashing first gives timingSafeEqual equal-length inputs, so the
	// comparison leaks neither content nor length.
	return timingSafeEqual(sha256(password), sha256(adminPassword));
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export async function createAdminToken(): Promise<string> {
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_S * 1000);
	await createAdminSession(token, expiresAt);
	return token;
}

export async function verifyAdminToken(token: string): Promise<boolean> {
	const session = await getAdminSessionByToken(token);
	if (!session) {
		return false;
	}
	if (session.expiresAt < new Date()) {
		await deleteAdminSession(token);
		return false;
	}
	return true;
}

export function getAdminTokenFromRequest(request: Request): string | null {
	return new Bun.CookieMap(request.headers.get("cookie") ?? "").get(
		COOKIE_NAME,
	);
}

export const buildAdminCookie = (token: string, maxAge = SESSION_DURATION_S) =>
	new Bun.Cookie(COOKIE_NAME, token, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge,
	}).serialize();
