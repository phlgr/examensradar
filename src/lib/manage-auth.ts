import { getCookie } from "@/lib/cookies";

const COOKIE_NAME = "examensradar_manage";

export function getManageTokenFromRequest(request: Request): string | null {
	return getCookie(request, COOKIE_NAME);
}

function serialize(parts: string[]): string {
	const options = [...parts, "Path=/", "HttpOnly", "SameSite=Lax"];

	if (process.env.NODE_ENV === "production") {
		options.push("Secure");
	}

	return options.join("; ");
}

export function buildManageSessionCookie(token: string): string {
	return serialize([`${COOKIE_NAME}=${token}`]);
}

export function buildClearManageCookie(): string {
	return serialize([`${COOKIE_NAME}=`, "Max-Age=0"]);
}
