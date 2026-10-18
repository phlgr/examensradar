export function getCookie(request: Request, name: string): string | null {
	const header = request.headers.get("cookie");
	if (!header) return null;

	for (const cookie of header.split(";")) {
		const [key, value] = cookie.trim().split("=");
		if (key === name && value) return value;
	}
	return null;
}
