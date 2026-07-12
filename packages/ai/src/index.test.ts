import { describe, expect, it } from 'vitest';

import { planningAgentBoundary } from './index';

describe('planning-agent boundary', () => {
  it('cannot directly reach durable or execution systems', () => {
    expect(planningAgentBoundary()).toMatchObject({
      canAccessDatabase: false,
      canCallProviders: false,
      canAccessBilling: false,
    });
  });
});
