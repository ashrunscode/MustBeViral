import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlatformKillSwitchSnapshot {
  readonly signupsEnabled: boolean;
  readonly generationEnabled: boolean;
  readonly providerRoutesEnabled: boolean;
  readonly chargingEnabled: boolean;
}

export const DEFAULT_PLATFORM_KILL_SWITCHES: PlatformKillSwitchSnapshot = Object.freeze({
  signupsEnabled: false,
  generationEnabled: false,
  providerRoutesEnabled: false,
  chargingEnabled: false,
});

function parseKillSwitchPayload(value: unknown): PlatformKillSwitchSnapshot {
  if (typeof value !== 'object' || value === null) return DEFAULT_PLATFORM_KILL_SWITCHES;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.freeze({
    signupsEnabled: record.signups_enabled === true,
    generationEnabled: record.generation_enabled === true,
    providerRoutesEnabled: record.provider_routes_enabled === true,
    chargingEnabled: record.charging_enabled === true,
  });
}

export async function fetchPlatformKillSwitches(
  supabase: SupabaseClient,
): Promise<PlatformKillSwitchSnapshot> {
  const { data, error } = await supabase.rpc('get_platform_kill_switches');
  if (error !== null) return DEFAULT_PLATFORM_KILL_SWITCHES;
  return parseKillSwitchPayload(data);
}
