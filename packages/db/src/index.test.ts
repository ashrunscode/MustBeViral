import { describe, expect, it } from 'vitest';

import { isAllowedUserDatabasePath } from './index';

describe('database access boundary', () => {
  it('does not treat service or Hyperdrive paths as default user authority', () => {
    expect(isAllowedUserDatabasePath('supabase-data-api-rpc')).toBe(true);
    expect(isAllowedUserDatabasePath('service-role')).toBe(false);
    expect(isAllowedUserDatabasePath('hyperdrive')).toBe(false);
  });
});
