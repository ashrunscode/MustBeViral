import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { leaseIdForActor, textDraftKey } from '@mustbeviral/collaboration';

import { INTERNAL_IDENTITY_HEADER, encodeVerifiedIdentity } from '../src/identity';

const actor1 = { actor_id: 'actor-1', display_name: 'A', color: '#3182d4' };
const actor2 = { actor_id: 'actor-2', display_name: 'B', color: '#1f9d63' };

function canvasStub(canvasId: string) {
  const namespace = env.CANVAS_COORDINATION;
  if (!namespace) throw new Error('CANVAS_COORDINATION binding is not configured');
  return namespace.get(namespace.idFromName(canvasId));
}

describe('CanvasCoordination durable object', () => {
  it('stores recoverable comment drafts without mutating revision authority', async () => {
    const stub = canvasStub('canvas-comments');
    await runInDurableObject(stub, async (instance) => {
      const snapshot = await instance.upsertComment('canvas-comments', actor1, {
        comment_id: 'comment-1',
        body: 'Tighten the hook on frame two.',
        anchor_node_id: 'node-hook',
      });
      expect(snapshot.canvas_id).toBe('canvas-comments');
      expect(snapshot.comments).toHaveLength(1);
      expect(snapshot.comments[0]?.body).toContain('frame two');
      expect(snapshot.comments[0]?.author).toEqual(actor1);
      expect(snapshot).not.toHaveProperty('revision_id');
      expect(snapshot).not.toHaveProperty('ledger');
      await expect(
        instance.upsertComment('canvas-comments', actor2, {
          comment_id: 'comment-1',
          body: 'Rewritten by someone else',
        }),
      ).rejects.toThrow('Only the author');
    });
  });

  it('tracks presence joins per actor and surface', async () => {
    const stub = canvasStub('canvas-presence');
    await runInDurableObject(stub, async (instance) => {
      const snapshot = await instance.joinPresence('canvas-presence', actor1, 'review');
      expect(snapshot.presence).toHaveLength(1);
      expect(snapshot.presence[0]?.surface).toBe('review');
    });
  });

  it('rejects conflicting edit leases until the holder releases', async () => {
    const stub = canvasStub('canvas-leases');
    await runInDurableObject(stub, async (instance) => {
      const first = await instance.acquireLease('canvas-leases', actor1, {
        lease_id: leaseIdForActor('node-copy', actor1.actor_id),
        node_id: 'node-copy',
        ttl_seconds: 120,
      });
      expect(first.accepted).toBe(true);
      const second = await instance.acquireLease('canvas-leases', actor2, {
        lease_id: leaseIdForActor('node-copy', actor2.actor_id),
        node_id: 'node-copy',
        ttl_seconds: 120,
      });
      expect(second.accepted).toBe(false);
      const notHolder = await instance.releaseLease(
        'canvas-leases',
        actor2,
        leaseIdForActor('node-copy', actor1.actor_id),
      );
      expect(notHolder.leases).toHaveLength(1);
      await instance.releaseLease(
        'canvas-leases',
        actor1,
        leaseIdForActor('node-copy', actor1.actor_id),
      );
      const third = await instance.acquireLease('canvas-leases', actor2, {
        lease_id: leaseIdForActor('node-copy', actor2.actor_id),
        node_id: 'node-copy',
        ttl_seconds: 120,
      });
      expect(third.accepted).toBe(true);
    });
  });

  it('refuses a lease id that is not derived from the node and the bound holder', async () => {
    const stub = canvasStub('canvas-lease-ids');
    await runInDurableObject(stub, async (instance) => {
      const forged = await instance.acquireLease('canvas-lease-ids', actor2, {
        lease_id: leaseIdForActor('node-copy', actor1.actor_id),
        node_id: 'node-copy',
        ttl_seconds: 120,
      });
      expect(forged.accepted).toBe(false);
      expect(forged.snapshot.leases).toHaveLength(0);
    });
  });

  it('syncs recoverable text drafts with lease gating and stale rejection', async () => {
    const stub = canvasStub('canvas-text');
    await runInDurableObject(stub, async (instance) => {
      await instance.acquireLease('canvas-text', actor1, {
        lease_id: leaseIdForActor('node-7', actor1.actor_id),
        node_id: 'node-7',
        ttl_seconds: 120,
      });
      const accepted = await instance.upsertTextDraft('canvas-text', actor1, {
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Macro ceramic texture',
      });
      expect(accepted.accepted).toBe(true);
      expect(accepted.snapshot.text_drafts).toHaveLength(1);
      const blocked = await instance.upsertTextDraft('canvas-text', actor2, {
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Competing draft',
      });
      expect(blocked.accepted).toBe(false);
      expect(blocked.reason).toBe('lease_held');
      expect(blocked.snapshot.text_drafts[0]?.body).toContain('Macro ceramic');
      await expect(
        instance.upsertTextDraft('canvas-text', actor2, {
          draft_id: textDraftKey('node-7', 'parameters.prompt'),
          node_id: 'node-8',
          field_path: 'parameters.prompt',
          body: 'Reusing another field id',
        }),
      ).rejects.toThrow('draft_id');
    });
  });

  it('clears checkpointed drafts only for the bound actor or unleased nodes', async () => {
    const stub = canvasStub('canvas-checkpoint');
    await runInDurableObject(stub, async (instance) => {
      await instance.upsertTextDraft('canvas-checkpoint', actor1, {
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Draft to checkpoint',
      });
      await instance.acquireLease('canvas-checkpoint', actor1, {
        lease_id: leaseIdForActor('node-8', actor1.actor_id),
        node_id: 'node-8',
        ttl_seconds: 120,
      });
      await instance.upsertTextDraft('canvas-checkpoint', actor1, {
        draft_id: textDraftKey('node-8', 'parameters.prompt'),
        node_id: 'node-8',
        field_path: 'parameters.prompt',
        body: 'Leased draft',
      });
      const byOther = await instance.clearCheckpointedDrafts('canvas-checkpoint', actor2, {
        draft_ids: [
          textDraftKey('node-7', 'parameters.prompt'),
          textDraftKey('node-8', 'parameters.prompt'),
        ],
        revision_id: 'revision-2',
      });
      expect(byOther.cleared_draft_ids).toEqual([textDraftKey('node-7', 'parameters.prompt')]);
      expect(byOther.snapshot.text_drafts.map((draft) => draft.node_id)).toEqual(['node-8']);
      expect(byOther.snapshot).not.toHaveProperty('revision_id');
      const byOwner = await instance.clearCheckpointedDrafts('canvas-checkpoint', actor1, {
        draft_ids: [textDraftKey('node-8', 'parameters.prompt')],
        revision_id: 'revision-3',
      });
      expect(byOwner.cleared_draft_ids).toEqual([textDraftKey('node-8', 'parameters.prompt')]);
      expect(byOwner.snapshot.text_drafts).toHaveLength(0);
    });
  });

  it('refuses requests that did not come through ticket verification', async () => {
    const stub = canvasStub('canvas-direct');
    const direct = await stub.fetch(
      'https://coordination.internal/snapshot?canvas_id=canvas-direct',
    );
    expect(direct.status).toBe(401);
    const otherCanvas = await stub.fetch(
      new Request('https://coordination.internal/snapshot?canvas_id=canvas-direct', {
        headers: {
          [INTERNAL_IDENTITY_HEADER]: encodeVerifiedIdentity({
            canvas_id: 'canvas-elsewhere',
            actor: actor1,
          }),
        },
      }),
    );
    expect(otherCanvas.status).toBe(401);
    const garbage = await stub.fetch(
      new Request('https://coordination.internal/snapshot?canvas_id=canvas-direct', {
        headers: { [INTERNAL_IDENTITY_HEADER]: 'not-an-identity' },
      }),
    );
    expect(garbage.status).toBe(401);
  });
});
