import { describe, expect, it } from "vitest";

import {
	allPlatformsDisabled,
	describeAllFlags,
	featureFlagKey,
	isPlatformEnabled,
} from "../../../src/server/services/platforms/feature-flags";
import type { PlatformEnv } from "../../../src/server/services/platforms/types";

// Accepts arbitrary keys so tests can pass deliberately-invalid flag values
// (e.g. "1", "yes") to verify isPlatformEnabled rejects anything that isn't
// the literal string "true". Two-step cast (through unknown) because
// PlatformEnv has narrow string-literal types on the flags.
function envWith(overrides: Record<string, unknown>): PlatformEnv {
	const env: unknown = overrides;
	return env as PlatformEnv;
}

describe("featureFlagKey", () => {
	it("constructs uppercase ENABLE_<PLATFORM>_<CAPABILITY> keys", () => {
		expect(featureFlagKey("linkedin", "publish")).toBe("ENABLE_LINKEDIN_PUBLISH");
		expect(featureFlagKey("x", "ingest")).toBe("ENABLE_X_INGEST");
		expect(featureFlagKey("meta", "publish")).toBe("ENABLE_META_PUBLISH");
		expect(featureFlagKey("tiktok", "ingest")).toBe("ENABLE_TIKTOK_INGEST");
	});
});

describe("isPlatformEnabled", () => {
	it("returns true only when the env value is the literal string 'true'", () => {
		expect(isPlatformEnabled(envWith({ ENABLE_LINKEDIN_PUBLISH: "true" }), "linkedin", "publish")).toBe(true);
	});

	it("returns false when the env value is 'false'", () => {
		expect(isPlatformEnabled(envWith({ ENABLE_LINKEDIN_PUBLISH: "false" }), "linkedin", "publish")).toBe(false);
	});

	it("returns false when the env key is missing entirely (post-build default)", () => {
		expect(isPlatformEnabled(envWith({}), "x", "publish")).toBe(false);
	});

	it("rejects truthy-but-not-literal-'true' values (defense in depth)", () => {
		expect(isPlatformEnabled(envWith({ ENABLE_X_PUBLISH: "1" }), "x", "publish")).toBe(false);
		expect(isPlatformEnabled(envWith({ ENABLE_X_PUBLISH: "yes" }), "x", "publish")).toBe(false);
		expect(isPlatformEnabled(envWith({ ENABLE_X_PUBLISH: "TRUE" }), "x", "publish")).toBe(false);
		expect(isPlatformEnabled(envWith({ ENABLE_X_PUBLISH: true }), "x", "publish")).toBe(false);
	});

	it("scopes the check to the requested platform + capability", () => {
		const env = envWith({
			ENABLE_LINKEDIN_PUBLISH: "true",
			ENABLE_LINKEDIN_INGEST: "false",
			ENABLE_X_PUBLISH: "false",
		});
		expect(isPlatformEnabled(env, "linkedin", "publish")).toBe(true);
		expect(isPlatformEnabled(env, "linkedin", "ingest")).toBe(false);
		expect(isPlatformEnabled(env, "x", "publish")).toBe(false);
	});
});

describe("describeAllFlags", () => {
	it("returns 8 rows: 4 platforms x 2 capabilities", () => {
		const all = describeAllFlags(envWith({}));
		expect(all).toHaveLength(8);
		expect(all.map((f) => f.envKey).sort()).toEqual(
			[
				"ENABLE_LINKEDIN_PUBLISH",
				"ENABLE_LINKEDIN_INGEST",
				"ENABLE_X_PUBLISH",
				"ENABLE_X_INGEST",
				"ENABLE_META_PUBLISH",
				"ENABLE_META_INGEST",
				"ENABLE_TIKTOK_PUBLISH",
				"ENABLE_TIKTOK_INGEST",
			].sort(),
		);
	});

	it("reflects per-flag enabled state from env", () => {
		const env = envWith({
			ENABLE_LINKEDIN_PUBLISH: "true",
			ENABLE_TIKTOK_INGEST: "true",
		});
		const enabled = describeAllFlags(env).filter((f) => f.enabled);
		expect(enabled.map((f) => f.envKey).sort()).toEqual([
			"ENABLE_LINKEDIN_PUBLISH",
			"ENABLE_TIKTOK_INGEST",
		]);
	});
});

describe("allPlatformsDisabled", () => {
	it("returns true when every flag is missing or 'false'", () => {
		expect(allPlatformsDisabled(envWith({}))).toBe(true);
		expect(
			allPlatformsDisabled(
				envWith({
					ENABLE_LINKEDIN_PUBLISH: "false",
					ENABLE_X_INGEST: "false",
				}),
			),
		).toBe(true);
	});

	it("returns false when at least one flag is 'true'", () => {
		expect(allPlatformsDisabled(envWith({ ENABLE_META_PUBLISH: "true" }))).toBe(false);
	});
});
