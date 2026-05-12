/**
 * Adapter registry.
 *
 * Phase A ships an empty registry — the foundation compiles and runs without
 * any platform-specific code. Subsequent phases register their adapter at
 * import time:
 *
 *   // Phase B addition in `src/server/services/platforms/linkedin.ts`:
 *   import { registerAdapter } from "./registry";
 *   import { linkedInAdapter } from "./linkedin-adapter-impl";
 *   registerAdapter(linkedInAdapter);
 *
 * The workflow layer treats a null adapter lookup as "platform not yet
 * implemented" and records `status: 'waiting_manual'` so the operator sees
 * the case in the UI.
 */

import type { PlatformAdapter, PlatformId } from "./types";

const adapters: Map<PlatformId, PlatformAdapter> = new Map();

export function registerAdapter(adapter: PlatformAdapter): void {
	adapters.set(adapter.id, adapter);
}

export function getAdapter(platform: PlatformId): PlatformAdapter | null {
	return adapters.get(platform) ?? null;
}

export function isAdapterRegistered(platform: PlatformId): boolean {
	return adapters.has(platform);
}

/** Test helper. Not used at runtime. */
export function _clearAdaptersForTest(): void {
	adapters.clear();
}
