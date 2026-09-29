import { describe, expect, it } from 'vitest';

import { proposeBrandKnowledge } from './knowledge-proposals';
import type { RepresentativeAssertion } from './representative-extract';

function offering(index: number, value = `Service ${index}`): RepresentativeAssertion {
  return {
    kind: 'offering',
    field_key: `service-${index}`,
    value_text: value,
    status: 'observed',
    excerpt: 'Captured offering',
    locator: `section:${index}`,
    method: 'data_attribute',
    ends_at: null,
    reusable: false,
  };
}

describe('proposal evidence boundaries', () => {
  it('retains every distinct evidence key for nine offerings', () => {
    const assertions = Array.from({ length: 9 }, (_, index) => offering(index));
    const proposal = proposeBrandKnowledge(assertions).find((item) => item.kind === 'positioning');
    expect(proposal?.evidence_field_keys).toEqual(assertions.map((item) => item.field_key));
    expect(proposal?.value_text).toContain('Service 8');
  });

  it('deduplicates evidence keys without losing distinct observations', () => {
    const proposal = proposeBrandKnowledge([offering(1, 'Pickup'), offering(1, 'Drop-off')])[2];
    expect(proposal?.evidence_field_keys).toEqual(['service-1']);
    expect(proposal?.value_text).toBe('Pickup; Drop-off');
  });

  it.each(['a'.repeat(4000), '😀'.repeat(2000)])(
    'does not truncate an oversized factual summary',
    (value) => {
      const proposal = proposeBrandKnowledge([offering(1, value), offering(2, value)])[2];
      expect(proposal).toMatchObject({ status: 'unknown', value_text: null, confidence: null });
      expect(proposal?.evidence_field_keys).toEqual(['service-1', 'service-2']);
      expect(proposal?.excerpt).toMatch(/summary/iu);
    },
  );
});
