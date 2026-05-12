/**
 * KV-backed per-platform rate limiter.
 *
 * Fixed-window rolling counter keyed by `rate:<platform>:<accountId>:<windowStart>`.
 * Stores a small integer with `expirationTtl = windowSeconds + 60` so KV
 * cleans up old windows automatically.
 *
 * Each adapter call invokes `checkAndConsume` before issuing the platform API
 * call; on `{ok: false, retryAfter}` the workflow step.do backoff handles the
 * wait. This is best-effort (KV is eventually consistent across regions) but
 * sufficient as a first-line guard before the platform's own 429 response.
 */

import type { PlatformEnv, PlatformId } from "./types";

export interface RateLimitOk {
	ok: true;
	remaining: number;
	reset: number; // unix seconds
}

export interface RateLimitDenied {
	ok: false;
	retryAfter: number; // seconds
	remaining: 0;
	reset: number;
}

export type RateLimitResult = RateLimitOk | RateLimitDenied;

export interface CheckAndConsumeOptions {
	platform: PlatformId;
	accountId: string;
	/** Max requests permitted in the window. */
	max: number;
	/** Window size in seconds. */
	windowSeconds: number;
	/** Optional cost per call. Defaults to 1. */
	cost?: number;
	/** Override "now" for tests; unix seconds. */
	nowSeconds?: number;
}

export async function checkAndConsume(
	env: PlatformEnv,
	options: CheckAndConsumeOptions,
): Promise<RateLimitResult> {
	if (!env.CACHE) {
		// Fail-open if KV is missing; the platform's own 429 will catch abuse.
		// Tests assert this branch separately.
		return {
			ok: true,
			remaining: options.max,
			reset: (options.nowSeconds ?? Math.floor(Date.now() / 1000)) + options.windowSeconds,
		};
	}
	const cost = options.cost ?? 1;
	const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
	const windowStart = now - (now % options.windowSeconds);
	const reset = windowStart + options.windowSeconds;
	const key = buildKey(options.platform, options.accountId, windowStart);
	const existing = await env.CACHE.get(key, { type: "text" });
	const current = typeof existing === "string" ? Number.parseInt(existing, 10) : 0;
	const next = (Number.isFinite(current) ? current : 0) + cost;
	if (next > options.max) {
		const retryAfter = Math.max(1, reset - now);
		return { ok: false, retryAfter, remaining: 0, reset };
	}
	await env.CACHE.put(key, String(next), {
		expirationTtl: options.windowSeconds + 60,
	});
	return {
		ok: true,
		remaining: Math.max(0, options.max - next),
		reset,
	};
}

/**
 * Read-only state inspection. Used by adapters to report rate-limit state
 * to the dashboard without consuming a slot.
 */
export async function getRateLimitState(
	env: PlatformEnv,
	platform: PlatformId,
	accountId: string,
	windowSeconds: number,
	max: number,
	nowSeconds?: number,
): Promise<{ remaining: number; reset: number }> {
	const now = nowSeconds ?? Math.floor(Date.now() / 1000);
	const windowStart = now - (now % windowSeconds);
	const reset = windowStart + windowSeconds;
	if (!env.CACHE) {
		return { remaining: max, reset };
	}
	const key = buildKey(platform, accountId, windowStart);
	const existing = await env.CACHE.get(key, { type: "text" });
	const current = typeof existing === "string" ? Number.parseInt(existing, 10) : 0;
	return {
		remaining: Math.max(0, max - (Number.isFinite(current) ? current : 0)),
		reset,
	};
}

function buildKey(platform: PlatformId, accountId: string, windowStart: number): string {
	return `rate:${platform}:${accountId}:${windowStart}`;
}
