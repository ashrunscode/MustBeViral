import { describe, expect, it } from 'vitest';

import { advanceCursor, retreatCursor } from './brand-findings';

describe('paginated findings navigation', () => {
  it('advances to the next cursor without duplicating the current page', () => {
    const first = advanceCursor([undefined], 'cursor-2');
    expect(first).toEqual([undefined, 'cursor-2']);
    expect(advanceCursor(first, 'cursor-2')).toEqual([undefined, 'cursor-2']);
  });
  it('retreats to the previous cursor and keeps the first page', () => {
    const pages = advanceCursor([undefined], 'cursor-2');
    expect(retreatCursor(pages)).toEqual([undefined]);
    expect(retreatCursor([undefined])).toEqual([undefined]);
  });
});
