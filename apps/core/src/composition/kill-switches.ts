import type { PlatformKillSwitchSnapshot } from '@mustbeviral/billing';

import type { CoreBindings } from '../bindings';

type KillSwitchBindings = Pick<
  CoreBindings,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'
>;

export class KillSwitchUnavailableError extends Error {
  override readonly name = 'KillSwitchUnavailableError';
}

const DEFAULT_KILL_SWITCHES: PlatformKillSwitchSnapshot = Object.freeze({
  signupsEnabled: false,
  generationEnabled: true,
  providerRoutesEnabled: true,
  chargingEnabled: false,
});

function isKillSwitchSnapshot(value: unknown): value is Readonly<{
  signups_enabled: boolean;
  generation_enabled: boolean;
  provider_routes_enabled: boolean;
  charging_enabled: boolean;
}> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Readonly<Record<string, unknown>>).generation_enabled === 'boolean' &&
    typeof (value as Readonly<Record<string, unknown>>).charging_enabled === 'boolean'
  );
}

export function createKillSwitchPort(
  bindings: KillSwitchBindings,
  fetchImplementation?: typeof fetch,
): Readonly<{ get(): Promise<PlatformKillSwitchSnapshot> }> {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const boundFetch = fetchImplementation ?? ((input, init) => fetch(input, init));

  return Object.freeze({
    async get() {
      if (!baseUrl || !privilegedKey) {
        return DEFAULT_KILL_SWITCHES;
      }

      let response: Response;
      try {
        response = await boundFetch(`${baseUrl}/rest/v1/rpc/get_platform_kill_switches`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            apikey: privilegedKey,
            authorization: `Bearer ${privilegedKey}`,
            'content-type': 'application/json',
          },
          body: '{}',
        });
      } catch {
        return DEFAULT_KILL_SWITCHES;
      }

      if (!response.ok) {
        return DEFAULT_KILL_SWITCHES;
      }

      try {
        const body = (await response.json()) as unknown;
        if (!isKillSwitchSnapshot(body)) return DEFAULT_KILL_SWITCHES;
        return Object.freeze({
          signupsEnabled: body.signups_enabled,
          generationEnabled: body.generation_enabled,
          providerRoutesEnabled: body.provider_routes_enabled,
          chargingEnabled: body.charging_enabled,
        });
      } catch {
        return DEFAULT_KILL_SWITCHES;
      }
    },
  });
}
