import { describe, expect, it } from 'vitest';

import {
  compareTextDrafts,
  evaluateTextDraftUpsert,
  leaseAcquireVerdict,
  leaseForNode,
  textDraftKey,
} from './conflict-resolution';
import type { EditLease, TextDraft } from './protocol';

const actorA = { actor_id: 'actor-a', display_name: 'A' };
const actorB = { actor_id: 'actor-b', display_name: 'B' };

function draft(author: typeof actorA, updatedAt: string, body = 'draft'): TextDraft {
  return {
    draft_id: textDraftKey('node-1', 'parameters.prompt'),
    node_id: 'node-1',
    field_path: 'parameters.prompt',
    body,
    author,
    updated_at: updatedAt,
  };
}

function lease(holder: typeof actorA, expiresAt: string): EditLease {
  return {
    lease_id: 'lease-1',
    node_id: 'node-1',
    holder,
    acquired_at: '2026-01-01T00:00:00.000Z',
    expires_at: expiresAt,
  };
}

describe('collaboration conflict resolution', () => {
  it('ignores expired leases when resolving active holders', () => {
    const active = leaseForNode(
      [lease(actorA, '2099-01-01T00:00:00.000Z'), lease(actorB, '2020-01-01T00:00:00.000Z')],
      'node-1',
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
    expect(active?.holder.actor_id).toBe('actor-a');
  });

  it('breaks draft ties deterministically by author id', () => {
    const older = draft(actorA, '2026-01-01T00:00:00.000Z');
    const newer = draft(actorB, '2026-01-01T00:00:00.000Z');
    expect(compareTextDrafts(newer, older)).toBeGreaterThan(0);
    expect(
      evaluateTextDraftUpsert({
        incoming: newer,
        existing: older,
        lease: undefined,
        actorId: actorB.actor_id,
      }),
    ).toBe('accepted');
    expect(
      evaluateTextDraftUpsert({
        incoming: older,
        existing: newer,
        lease: undefined,
        actorId: actorA.actor_id,
      }),
    ).toBe('rejected_stale');
  });

  it('rejects draft writes while another collaborator holds the lease', () => {
    const verdict = evaluateTextDraftUpsert({
      incoming: draft(actorB, '2026-01-02T00:00:00.000Z'),
      existing: undefined,
      lease: lease(actorA, '2099-01-01T00:00:00.000Z'),
      actorId: actorB.actor_id,
    });
    expect(verdict).toBe('rejected_lease');
  });

  it('marks lease acquisition as contested when another holder is active', () => {
    expect(
      leaseAcquireVerdict({
        existing: lease(actorA, '2099-01-01T00:00:00.000Z'),
        holder: actorB,
      }),
    ).toBe('contested');
    expect(
      leaseAcquireVerdict({
        existing: lease(actorA, '2099-01-01T00:00:00.000Z'),
        holder: actorA,
      }),
    ).toBe('accepted');
  });
});
