export async function getD1(context: unknown): Promise<D1Database> {
	const ctx = context as Record<string, unknown>;

	const env =
		(ctx.cloudflare as { env?: { DB?: D1Database } })?.env ??
		(ctx.cf as { env?: { DB?: D1Database } })?.env ??
		(ctx as { env?: { DB?: D1Database } }).env;

	if (env?.DB) return env.DB;

	// Development only: use wrangler proxy
	if (import.meta.env.DEV) {
		const { getPlatformProxy } = await import("wrangler");
		const proxy = await getPlatformProxy<{ DB: D1Database }>({
			configPath: "./wrangler.toml",
		});
		return proxy.env.DB;
	}

	throw new Error("D1 database not available in context");
}
