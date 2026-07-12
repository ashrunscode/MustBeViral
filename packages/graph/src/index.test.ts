import { describe, expect, it } from 'vitest';

import { isGraphNodeKind } from './index';

describe('P0 graph node boundary', () => {
  it('accepts approved DAG node kinds and rejects deferred audio', () => {
    expect(isGraphNodeKind('image_generation')).toBe(true);
    expect(isGraphNodeKind('audio_generation')).toBe(false);
  });
});
