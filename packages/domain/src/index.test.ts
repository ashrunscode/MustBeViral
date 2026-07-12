import { describe, expect, it } from 'vitest';

import { isActorType } from './index';

describe('actor boundary', () => {
  it('recognizes user and explicit machine identities only', () => {
    expect(isActorType('user')).toBe(true);
    expect(isActorType('machine')).toBe(true);
    expect(isActorType('service_role')).toBe(false);
  });
});
