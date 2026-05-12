/**
 * Platform feature flag check. Reads `ENABLE_<PLATFORM>_<CAPABILITY>` from
 * the worker env. Default = OFF: anything other than the literal string
 * `"true"` is treated as disabled, including `undefined`, `"1"`, `"yes"`, etc.
 *
 * Production flag flips are per-platform launch decisions and must be made
 * explicitly via `wrangler secret put ENABLE_<X>_<Y> --env production` with
 * the value `"true"`. The build-time defaults in `wrangler.jsonc` keep every
 * flag at `"false"`.
 */

import type {
	PlatformCapability,
	PlatformEnv,
	PlatformId,
} from "./types";
import { PLATFORM_CAPABILITIES, PLATFORM_IDS } from "./types";

export interface FlagState {
	platform: PlatformId;
	capability: PlatformCapability;
	enabled: boolean;
	envKey: FeatureFlagKey;
}

export type FeatureFlagKey =
	| `ENABLE_${Uppercase<PlatformId>}_${Uppercase<PlatformCapability>}`;

export function featureFlagKey(
	platform: PlatformId,
	capability: PlatformCapability,
): FeatureFlagKey {
	return `ENABLE_${platform.toUpperCase() as Uppercase<PlatformId>}_${capability.toUpperCase() as Uppercase<PlatformCapability>}`;
}

export function isPlatformEnabled(
	env: PlatformEnv,
	platform: PlatformId,
	capability: PlatformCapability,
): boolean {
	const key = featureFlagKey(platform, capability);
	const raw = env[key];
	return raw === "true";
}

export function describeAllFlags(env: PlatformEnv): FlagState[] {
	const states: FlagState[] = [];
	for (const platform of PLATFORM_IDS) {
		for (const capability of PLATFORM_CAPABILITIES) {
			const envKey = featureFlagKey(platform, capability);
			states.push({
				platform,
				capability,
				enabled: env[envKey] === "true",
				envKey,
			});
		}
	}
	return states;
}

/**
 * Convenience predicate for the cron handler: returns true if NO platform
 * has either capability enabled. Used to short-circuit the scheduled
 * handler entirely when the post-build production state is all-OFF.
 */
export function allPlatformsDisabled(env: PlatformEnv): boolean {
	return describeAllFlags(env).every((flag) => !flag.enabled);
}
