import { describe, expect, it } from 'vitest';

import { createMutationIdempotencyKey } from './idempotency';

describe('createMutationIdempotencyKey', () => {
  it('creates bounded, scoped keys suitable for the REST mutation header', () => {
    const first = createMutationIdempotencyKey('canvas patch');
    const second = createMutationIdempotencyKey('canvas patch');
    expect(first).toMatch(/^web-canvas-patch-/u);
    expect(first.length).toBeLessThanOrEqual(200);
    expect(second).not.toBe(first);
  });
});
