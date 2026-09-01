/**
 * Subscriber "session": an httpOnly cookie carrying the manage token.
 *
 * The token itself is the credential (an opaque DB row, revocable). Mail links
 * carry it as `/subscriptions?manage=<token>`; the page trades it for this
 * httpOnly cookie via the `email.signIn` mutation and scrubs the URL, so it
 * stays out of browser history, server logs and referrers from then on.
 */

const COOKIE_NAME = "examensradar_manage";

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

/**
 * Deliberately a session cookie (no Max-Age): closing the browser is the
 * sign-out, which is what actually happens on shared machines — and any mail
 * footer signs the next visit back in with one click. This is why there is no
 * explicit sign-out anywhere.
 */
export function buildManageCookie(token: string): string {
	const options = [
		`${COOKIE_NAME}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
	];

	if (process.env.NODE_ENV === "production") {
		options.push("Secure");
	}

	return options.join("; ");
}
