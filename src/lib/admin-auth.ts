import {
	createAdminSession,
	deleteAdminSession,
	getAdminSessionByToken,
} from "@/db";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Verify the admin password against the environment variable
 */
export function verifyAdminPassword(password: string): boolean {
	const adminPassword = process.env.ADMIN_PASSWORD;
	if (!adminPassword) {
		console.error("ADMIN_PASSWORD environment variable is not set");
		return false;
	}
	return password === adminPassword;
}

/**
 * Create a new admin session and return the token
 */
export async function createAdminToken(): Promise<string> {
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	await createAdminSession(token, expiresAt);
	return token;
}

/**
 * Verify an admin session token
 */
export async function verifyAdminToken(token: string): Promise<boolean> {
	const session = await getAdminSessionByToken(token);
	if (!session) {
		return false;
	}
	// Check if session is expired
	if (session.expiresAt < new Date()) {
		await deleteAdminSession(token);
		return false;
	}
	return true;
}

/**
 * Invalidate an admin session
 */
export async function invalidateAdminToken(token: string): Promise<void> {
	await deleteAdminSession(token);
}

/**
 * Get the admin session cookie name
 */
export function getAdminCookieName(): string {
	return COOKIE_NAME;
}

/**
 * Extract admin token from request headers (cookie)
 */
export function getAdminTokenFromRequest(request: Request): string | null {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) {
		return null;
	}

	const cookies = cookieHeader.split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		const [name, value] = cookie.split("=");
		if (name === COOKIE_NAME) {
			return value;
		}
	}
	return null;
}
