import { describe, expect, it } from 'vitest';

import {
  compareTextDrafts,
  evaluateTextDraftUpsert,
  leaseAcquireVerdict,
  leaseForNode,
  leaseIdForActor,
  legacyLeaseIdForActor,
  textDraftKey,
} from './conflict-resolution';
import {
  COLLABORATION_LEASE_ID_MAX_LENGTH,
  COLLABORATION_TEXT_DRAFT_ID_MAX_LENGTH,
} from './limits';
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
  it('keys drafts injectively on the node and field pair', () => {
    expect(textDraftKey('n', '1::parameters.prompt')).not.toBe(
      textDraftKey('n::1', 'parameters.prompt'),
    );
    expect(textDraftKey('a:', ':b')).not.toBe(textDraftKey('a', '::b'));
    expect(JSON.parse(textDraftKey('n::1', 'parameters.prompt'))).toEqual([
      'n::1',
      'parameters.prompt',
    ]);
  });

  it('keys leases injectively on the node and holder pair', () => {
    // The legacy joined ids collide; the injective ids do not.
    expect(legacyLeaseIdForActor('x', 'a-b')).toBe(legacyLeaseIdForActor('x-a', 'b'));
    expect(leaseIdForActor('x', 'a-b')).not.toBe(leaseIdForActor('x-a', 'b'));
    expect(leaseIdForActor('a","b', 'c')).not.toBe(leaseIdForActor('a', 'b","c'));
    expect(JSON.parse(leaseIdForActor('x-a', 'b'))).toEqual(['lease', 'x-a', 'b']);
    const pairs = [
      ['n', 'a'],
      ['n-a', ''],
      ['', 'n-a'],
      ['n', 'a-'],
      ['n-', 'a'],
    ];
    expect(new Set(pairs.map(([node, actor]) => leaseIdForActor(node!, actor!))).size).toBe(
      pairs.length,
    );
  });

  it('bounds derived ids by the id limits, whatever characters the ids use', () => {
    const control = String.fromCharCode(1);
    expect(textDraftKey(control.repeat(128), control.repeat(128))).toHaveLength(
      COLLABORATION_TEXT_DRAFT_ID_MAX_LENGTH,
    );
    expect(leaseIdForActor(control.repeat(128), control.repeat(128))).toHaveLength(
      COLLABORATION_LEASE_ID_MAX_LENGTH,
    );
  });

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
