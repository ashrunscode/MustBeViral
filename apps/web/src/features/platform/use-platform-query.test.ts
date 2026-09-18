import { describe, expect, it } from 'vitest';

import { visiblePlatformQuery } from './use-platform-query';

describe('visible platform query', () => {
  it('hides WashBodega data the moment UnPile becomes the selected scope', () => {
    const washbodega = {
      key: 'washbodega',
      data: { name: 'WashBodega' },
    };
    expect(visiblePlatformQuery(true, washbodega, 'unpile')).toEqual({
      data: undefined,
      error: undefined,
      loading: true,
    });
  });

  it('does not let a stale success clear a newer access denial', () => {
    const denied = {
      key: 'unpile',
      error: { code: 'NOT_FOUND' },
    };
    expect(visiblePlatformQuery(true, denied, 'unpile')).toEqual({
      data: undefined,
      error: denied.error,
      loading: false,
    });
    expect(
      visiblePlatformQuery(true, { key: 'washbodega', data: { name: 'WashBodega' } }, 'unpile')
        .data,
    ).toBeUndefined();
  });

  it('clears private data when the query is disabled after sign-out', () => {
    expect(
      visiblePlatformQuery(
        false,
        { key: 'washbodega', data: { name: 'WashBodega' } },
        'washbodega',
      ),
    ).toEqual({ data: undefined, error: undefined, loading: false });
  });
});
