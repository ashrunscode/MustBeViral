import { describe, expect, it } from 'vitest';

import { normalizeRequestId } from '../../src/http/request-id';

describe('request ID normalization', () => {
  it('keeps a bounded safe caller correlation ID', () => {
    expect(normalizeRequestId('caller.request-123')).toBe('caller.request-123');
  });

  it('replaces unsafe and oversized values', () => {
    expect(normalizeRequestId('bad id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId('a'.repeat(129))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
