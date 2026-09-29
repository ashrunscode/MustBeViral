import { describe, expect, it, vi } from 'vitest';

import { createKillSwitchPort } from '../../src/composition/kill-switches';

describe('Core production kill-switch defaults', () => {
  const closed = {
    signupsEnabled: false,
    generationEnabled: false,
    providerRoutesEnabled: false,
    chargingEnabled: false,
  } as const;

  it('fails closed when privileged database bindings are absent', async () => {
    await expect(createKillSwitchPort({}).get()).resolves.toEqual(closed);
  });

  it('fails closed when the database is unavailable or returns an incomplete payload', async () => {
    const unavailable = vi.fn<typeof fetch>().mockRejectedValue(new Error('unavailable'));
    await expect(
      createKillSwitchPort(
        { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret' },
        unavailable,
      ).get(),
    ).resolves.toEqual(closed);

    const incomplete = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ generation_enabled: true, charging_enabled: false }));
    await expect(
      createKillSwitchPort(
        { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret' },
        incomplete,
      ).get(),
    ).resolves.toEqual(closed);
  });
});
