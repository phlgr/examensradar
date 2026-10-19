const COOKIE_NAME = "examensradar_manage";

export function getManageTokenFromRequest(request: Request): string | null {
	return new Bun.CookieMap(request.headers.get("cookie") ?? "").get(
		COOKIE_NAME,
	);
}

const cookie = (value: string, maxAge?: number) =>
	new Bun.Cookie(COOKIE_NAME, value, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge,
	}).serialize();

export const buildManageSessionCookie = (token: string) => cookie(token);

export const buildClearManageCookie = () => cookie("", 0);
