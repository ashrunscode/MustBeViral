import { describe, expect, it } from 'vitest';

import { mayImplementProductionUi } from './index';

describe('production UI gate', () => {
  it('remains closed without an approved design artifact', () => {
    expect(mayImplementProductionUi()).toBe(false);
    expect(mayImplementProductionUi('  ')).toBe(false);
    expect(mayImplementProductionUi('precision-studio-v1')).toBe(true);
  });
});
