import { describe, expect, it } from "vitest";

import { planLimitsForTesting } from "../../src/server/services/entitlements";

describe("Plan limit caps", () => {
	const limits = planLimitsForTesting();

	it("starter is the strictest plan", () => {
		expect(limits.starter.brands).toBe(1);
		expect(limits.starter.content_posts_per_month).toBe(50);
		expect(limits.starter.ai_requests_per_month).toBe(100);
	});

	it("growth is at least 5x starter", () => {
		expect(limits.growth.brands).toBeGreaterThanOrEqual(limits.starter.brands * 5);
		expect(limits.growth.content_posts_per_month).toBeGreaterThanOrEqual(
			limits.starter.content_posts_per_month * 5,
		);
		expect(limits.growth.ai_requests_per_month).toBeGreaterThanOrEqual(
			limits.starter.ai_requests_per_month * 5,
		);
	});

	it("agency is strictly larger than growth", () => {
		expect(limits.agency.brands).toBeGreaterThan(limits.growth.brands);
		expect(limits.agency.content_posts_per_month).toBeGreaterThan(
			limits.growth.content_posts_per_month,
		);
		expect(limits.agency.ai_requests_per_month).toBeGreaterThan(
			limits.growth.ai_requests_per_month,
		);
	});

	it("managed is unlimited (Number.POSITIVE_INFINITY)", () => {
		expect(limits.managed.brands).toBe(Number.POSITIVE_INFINITY);
		expect(limits.managed.content_posts_per_month).toBe(Number.POSITIVE_INFINITY);
		expect(limits.managed.ai_requests_per_month).toBe(Number.POSITIVE_INFINITY);
	});

	it("locks the plan tier set", () => {
		const tiers = Object.keys(limits).sort();
		expect(tiers).toEqual(["agency", "growth", "managed", "starter"]);
	});
});
