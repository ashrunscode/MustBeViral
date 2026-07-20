import { describe, expect, it } from 'vitest';

import { InMemoryReviewPort } from './review-port';

describe('InMemoryReviewPort', () => {
  it('persists approve and reject transitions', () => {
    const port = new InMemoryReviewPort();
    const approved = port.decideVariant({
      variantId: 'hero-b',
      decision: 'approved',
      expectedRevisionId: '7f3a',
    });
    expect(approved.type).toBe('ok');
    expect(port.read()[0]!.variants.find((variant) => variant.id === 'hero-b')?.decision).toBe(
      'approved',
    );

    const rejected = port.decideVariant({
      variantId: 'story-a',
      decision: 'rejected',
      reason: 'Missing required disclaimer',
      expectedRevisionId: '7f3a',
    });
    expect(rejected.type).toBe('ok');
    expect(port.read()[0]!.variants.find((variant) => variant.id === 'story-a')).toMatchObject({
      decision: 'rejected',
      rejectionReason: 'Missing required disclaimer',
    });
  });

  it('requires a rejection reason', () => {
    expect(
      new InMemoryReviewPort().decideVariant({
        variantId: 'story-a',
        decision: 'rejected',
        expectedRevisionId: '7f3a',
      }),
    ).toEqual({ type: 'reason_required', variant_id: 'story-a' });
  });

  it('persists named group approval', () => {
    const port = new InMemoryReviewPort();
    const result = port.approveGroup({
      groupId: 'visuals',
      reviewer: 'Maya Chen',
      expectedRevisionId: '7f3a',
    });
    expect(result.type).toBe('ok');
    expect(port.read()[0]).toMatchObject({ decision: 'approved', reviewer: 'Maya Chen' });
  });

  it('returns conflict and not-found branches', () => {
    expect(
      new InMemoryReviewPort('conflict').approveGroup({
        groupId: 'visuals',
        reviewer: 'Maya Chen',
        expectedRevisionId: '7f3a',
      }),
    ).toEqual({ type: 'conflict', actual_revision_id: '81c2' });
    expect(
      new InMemoryReviewPort().approveGroup({
        groupId: 'missing',
        reviewer: 'Maya Chen',
        expectedRevisionId: '7f3a',
      }),
    ).toEqual({ type: 'not_found', artifact_id: 'missing' });
  });
});
