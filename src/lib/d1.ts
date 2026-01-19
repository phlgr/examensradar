import type { PlatformProxy } from "wrangler";

let devProxy: PlatformProxy<{ DB: D1Database }> | null = null;

export async function getD1(context: unknown): Promise<D1Database | null> {
	// Try production context paths
	const ctx = context as Record<string, unknown>;

	const env =
		(ctx.cloudflare as { env?: { DB?: D1Database } })?.env ??
		(ctx.cf as { env?: { DB?: D1Database } })?.env ??
		(ctx as { env?: { DB?: D1Database } }).env;

	if (env?.DB) return env.DB;

	// Development: use wrangler proxy
	if (!devProxy) {
		const { getPlatformProxy } = await import("wrangler");
		devProxy = await getPlatformProxy<{ DB: D1Database }>({
			configPath: "./wrangler.toml",
		});
	}

	return devProxy.env.DB;
}
