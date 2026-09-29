import { describe, expect, it } from 'vitest';
import { expiryReached } from './knowledge-changes';

describe('freshness display', () => {
  it('compares equivalent offsets and preserves sub-millisecond expiry precision', () => {
    expect(expiryReached('2026-09-29T01:00:00.000002-05:00', '2026-09-29T06:00:00.000001Z')).toBe(
      false,
    );
    expect(expiryReached('2026-09-29T01:00:00.000002-05:00', '2026-09-29T06:00:00.000002Z')).toBe(
      true,
    );
    expect(expiryReached('2026-09-29T07:00:00+02:00', '2026-09-29T06:00:00Z')).toBe(true);
    expect(expiryReached(null, '2026-09-29T06:00:00Z')).toBe(false);
  });
});
