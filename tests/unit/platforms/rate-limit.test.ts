import { describe, expect, it } from "vitest";

import {
	checkAndConsume,
	getRateLimitState,
} from "../../../src/server/services/platforms/rate-limit";
import type {
	PlatformEnv,
	PlatformKvNamespace,
} from "../../../src/server/services/platforms/types";

function makeMemoryKv(): PlatformKvNamespace & { entries: Map<string, string> } {
	const entries = new Map<string, string>();
	return {
		entries,
		get(key, options): Promise<string | null> {
			void options;
			return Promise.resolve(entries.get(key) ?? null);
		},
		put(key, value): Promise<void> {
			entries.set(
				key,
				typeof value === "string" ? value : new TextDecoder().decode(value as ArrayBuffer),
			);
			return Promise.resolve();
		},
		delete(key): Promise<void> {
			entries.delete(key);
			return Promise.resolve();
		},
	};
}

function envWithKv(): PlatformEnv {
	return { CACHE: makeMemoryKv() };
}

describe("checkAndConsume", () => {
	it("permits the first N requests within the window", async () => {
		const env = envWithKv();
		const now = 1_700_000_000;
		for (let i = 0; i < 5; i += 1) {
			const result = await checkAndConsume(env, {
				platform: "linkedin",
				accountId: "acc1",
				max: 5,
				windowSeconds: 60,
				nowSeconds: now + i,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.remaining).toBe(5 - (i + 1));
			}
		}
	});

	it("denies the (N+1)th request with retryAfter > 0", async () => {
		const env = envWithKv();
		const now = 1_700_000_000;
		for (let i = 0; i < 3; i += 1) {
			await checkAndConsume(env, {
				platform: "x",
				accountId: "acc",
				max: 3,
				windowSeconds: 60,
				nowSeconds: now,
			});
		}
		const denied = await checkAndConsume(env, {
			platform: "x",
			accountId: "acc",
			max: 3,
			windowSeconds: 60,
			nowSeconds: now,
		});
		expect(denied.ok).toBe(false);
		if (!denied.ok) {
			expect(denied.retryAfter).toBeGreaterThan(0);
			expect(denied.remaining).toBe(0);
		}
	});

	it("resets the counter when the window rolls over", async () => {
		const env = envWithKv();
		const window = 60;
		const firstWindowNow = 1_700_000_000;
		for (let i = 0; i < 3; i += 1) {
			await checkAndConsume(env, {
				platform: "meta",
				accountId: "page1",
				max: 3,
				windowSeconds: window,
				nowSeconds: firstWindowNow,
			});
		}
		// First window now full.
		const denied = await checkAndConsume(env, {
			platform: "meta",
			accountId: "page1",
			max: 3,
			windowSeconds: window,
			nowSeconds: firstWindowNow,
		});
		expect(denied.ok).toBe(false);
		// Next window: 60s later, counter resets.
		const allowed = await checkAndConsume(env, {
			platform: "meta",
			accountId: "page1",
			max: 3,
			windowSeconds: window,
			nowSeconds: firstWindowNow + window,
		});
		expect(allowed.ok).toBe(true);
		if (allowed.ok) {
			expect(allowed.remaining).toBe(2);
		}
	});

	it("scopes counters per-account so one account's load doesn't starve another", async () => {
		const env = envWithKv();
		const now = 1_700_000_000;
		for (let i = 0; i < 5; i += 1) {
			await checkAndConsume(env, {
				platform: "tiktok",
				accountId: "acc_a",
				max: 5,
				windowSeconds: 60,
				nowSeconds: now,
			});
		}
		const accAFull = await checkAndConsume(env, {
			platform: "tiktok",
			accountId: "acc_a",
			max: 5,
			windowSeconds: 60,
			nowSeconds: now,
		});
		expect(accAFull.ok).toBe(false);
		const accBFresh = await checkAndConsume(env, {
			platform: "tiktok",
			accountId: "acc_b",
			max: 5,
			windowSeconds: 60,
			nowSeconds: now,
		});
		expect(accBFresh.ok).toBe(true);
	});

	it("respects an explicit cost > 1", async () => {
		const env = envWithKv();
		const now = 1_700_000_000;
		const first = await checkAndConsume(env, {
			platform: "linkedin",
			accountId: "acc",
			max: 10,
			windowSeconds: 60,
			cost: 4,
			nowSeconds: now,
		});
		expect(first.ok).toBe(true);
		if (first.ok) expect(first.remaining).toBe(6);
		const second = await checkAndConsume(env, {
			platform: "linkedin",
			accountId: "acc",
			max: 10,
			windowSeconds: 60,
			cost: 7,
			nowSeconds: now,
		});
		expect(second.ok).toBe(false);
	});

	it("fails open when CACHE is missing (returns ok=true with full remaining)", async () => {
		const env = {} as PlatformEnv;
		const result = await checkAndConsume(env, {
			platform: "x",
			accountId: "acc",
			max: 5,
			windowSeconds: 60,
			nowSeconds: 1_700_000_000,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.remaining).toBe(5);
		}
	});
});

describe("getRateLimitState", () => {
	it("reports remaining without consuming a slot", async () => {
		const env = envWithKv();
		const now = 1_700_000_000;
		await checkAndConsume(env, {
			platform: "linkedin",
			accountId: "acc",
			max: 10,
			windowSeconds: 60,
			nowSeconds: now,
		});
		const state1 = await getRateLimitState(env, "linkedin", "acc", 60, 10, now);
		const state2 = await getRateLimitState(env, "linkedin", "acc", 60, 10, now);
		expect(state1.remaining).toBe(9);
		expect(state2.remaining).toBe(9); // read-only — still 9, not 8
	});

	it("reports max remaining when CACHE missing", async () => {
		const env = {} as PlatformEnv;
		const state = await getRateLimitState(env, "x", "acc", 60, 5, 1_700_000_000);
		expect(state.remaining).toBe(5);
	});
});
