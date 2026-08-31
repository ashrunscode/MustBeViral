import { describe, expect, it } from 'vitest';

import { DEFAULT_PLATFORM_KILL_SWITCHES, fetchPlatformKillSwitches } from './kill-switches';

describe('fetchPlatformKillSwitches', () => {
  it('returns closed defaults when the RPC fails', async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: new Error('rpc unavailable') }),
    };
    await expect(fetchPlatformKillSwitches(supabase as never)).resolves.toEqual(
      DEFAULT_PLATFORM_KILL_SWITCHES,
    );
  });

  it('maps authenticated RPC rows into Studio kill-switch labels', async () => {
    const supabase = {
      rpc: async () => ({
        data: {
          signups_enabled: false,
          generation_enabled: true,
          provider_routes_enabled: false,
          charging_enabled: true,
        },
        error: null,
      }),
    };
    await expect(fetchPlatformKillSwitches(supabase as never)).resolves.toEqual({
      signupsEnabled: false,
      generationEnabled: true,
      providerRoutesEnabled: false,
      chargingEnabled: true,
    });
  });
});
