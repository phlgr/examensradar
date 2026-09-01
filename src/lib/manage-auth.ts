/**
 * Subscriber "session": an httpOnly cookie carrying the manage token.
 *
 * The token itself is the credential (an opaque DB row, revocable). Mail links
 * carry it as `/subscriptions?manage=<token>`; the page trades it for this
 * httpOnly cookie via /api/email/session and scrubs the URL, so it stays out
 * of browser history, server logs and referrers from then on.
 */

const COOKIE_NAME = "examensradar_manage";

/**
 * Outlives a subscriber's ~3-month lifecycle, so the cookie never expires
 * before the subscription becomes irrelevant on its own.
 */
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function getManageTokenFromRequest(request: Request): string | null {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) {
		return null;
	}

	const cookies = cookieHeader.split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		const [name, value] = cookie.split("=");
		if (name === COOKIE_NAME && value) {
			return value;
		}
	}
	return null;
}

function serialize(value: string, maxAge: number): string {
	const options = [
		`${COOKIE_NAME}=${value}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${maxAge}`,
	];

	if (process.env.NODE_ENV === "production") {
		options.push("Secure");
	}

	return options.join("; ");
}

export function buildManageCookie(token: string): string {
	return serialize(token, MAX_AGE_SECONDS);
}

export function buildClearManageCookie(): string {
	return serialize("", 0);
}
