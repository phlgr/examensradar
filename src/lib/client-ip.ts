/**
 * The client IP, as far as it can be trusted.
 *
 * Dokploy fronts the app with Traefik, which sets `X-Real-Ip` to a single
 * value — the peer it actually accepted the connection from — and *appends* to
 * `X-Forwarded-For`. That ordering matters: a client can send its own
 * `X-Forwarded-For`, and Traefik adds the real address to the end of it, so the
 * leftmost entry is attacker-controlled and the rightmost is not. Reading the
 * left is the usual way this is got wrong.
 *
 * There is no CDN in front (DNS is at Hetzner), so the peer Traefik sees is the
 * visitor. If a CDN is ever added, its own header has to be preferred here.
 *
 * Used for the Einwilligungsnachweis behind double opt-in, so a wrong value is
 * worse than none: it would look like proof while recording the proxy.
 */
export function getClientIp(request: Request): string | null {
	const realIp = request.headers.get("X-Real-IP")?.trim();
	if (realIp) return realIp;

	const forwarded = request.headers.get("X-Forwarded-For");
	if (!forwarded) return null;

	const hops = forwarded
		.split(",")
		.map((hop) => hop.trim())
		.filter(Boolean);

	return hops.at(-1) ?? null;
}
