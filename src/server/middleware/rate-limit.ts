import { createMiddleware } from "hono/factory";

import { errorEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";

const encoder = new TextEncoder();

export interface RateLimitOptions {
	scope: string;
	max: number;
	windowSeconds: number;
}

/**
 * IP-scoped rate limit backed by the CACHE KV namespace. Counter resolution
 * is one fixed window (`windowSeconds`); KV has no atomic increment so a tiny
 * race window can let a couple of extra requests through. That's acceptable
 * for credential-stuffing / signup-spam mitigation.
 *
 * Falls open if `c.env.CACHE` is missing (dev) or if the IP cannot be derived,
 * so legitimate traffic is never blocked by the middleware itself.
 */
export function ipRateLimit(options: RateLimitOptions) {
	return createMiddleware<AppHonoContext>(async (c, next) => {
		const requestId = c.get("requestId");
		const cache = c.env.CACHE;
		if (!cache) {
			await next();
			return;
		}

		const ip =
			c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim();
		if (!ip) {
			await next();
			return;
		}

		const ipHash = await sha256Hex(ip);
		const key = `ratelimit:${options.scope}:${ipHash}`;
		const current = Number((await cache.get(key)) ?? "0");
		if (current >= options.max) {
			return c.json(
				errorEnvelope("RATE_LIMITED", "Too many requests. Try again shortly.", requestId, {
					scope: options.scope,
					retryAfterSeconds: options.windowSeconds,
				}),
				429,
			);
		}

		await cache.put(key, String(current + 1), { expirationTtl: options.windowSeconds });
		await next();
	});
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	const bytes = new Uint8Array(digest);
	let out = "";
	for (const byte of bytes) {
		out += byte.toString(16).padStart(2, "0");
	}
	return out;
}
