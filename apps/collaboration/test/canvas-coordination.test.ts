import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

function canvasStub(canvasId: string) {
  const namespace = env.CANVAS_COORDINATION;
  if (!namespace) throw new Error('CANVAS_COORDINATION binding is not configured');
  return namespace.get(namespace.idFromName(canvasId));
}

describe('CanvasCoordination durable object', () => {
  it('stores recoverable comment drafts without mutating revision authority', async () => {
    const stub = canvasStub('canvas-comments');
    await runInDurableObject(stub, async (instance) => {
      const snapshot = await instance.upsertComment('canvas-comments', {
        comment_id: 'comment-1',
        author: { actor_id: 'actor-1', display_name: 'Reviewer' },
        body: 'Tighten the hook on frame two.',
        anchor_node_id: 'node-hook',
      });
      expect(snapshot.canvas_id).toBe('canvas-comments');
      expect(snapshot.comments).toHaveLength(1);
      expect(snapshot.comments[0]?.body).toContain('frame two');
      expect(snapshot).not.toHaveProperty('revision_id');
      expect(snapshot).not.toHaveProperty('ledger');
    });
  });

  it('tracks presence joins per actor and surface', async () => {
    const stub = canvasStub('canvas-presence');
    await runInDurableObject(stub, async (instance) => {
      const snapshot = await instance.joinPresence('canvas-presence', {
        actor: { actor_id: 'actor-1', display_name: 'A' },
        surface: 'review',
      });
      expect(snapshot.presence).toHaveLength(1);
      expect(snapshot.presence[0]?.surface).toBe('review');
    });
  });

  it('rejects conflicting edit leases until the holder releases', async () => {
    const stub = canvasStub('canvas-leases');
    await runInDurableObject(stub, async (instance) => {
      const first = await instance.acquireLease('canvas-leases', {
        lease_id: 'lease-1',
        node_id: 'node-copy',
        holder: { actor_id: 'actor-1', display_name: 'A' },
        ttl_seconds: 120,
      });
      expect(first.accepted).toBe(true);
      const second = await instance.acquireLease('canvas-leases', {
        lease_id: 'lease-2',
        node_id: 'node-copy',
        holder: { actor_id: 'actor-2', display_name: 'B' },
        ttl_seconds: 120,
      });
      expect(second.accepted).toBe(false);
      await instance.releaseLease('canvas-leases', 'lease-1', 'actor-1');
      const third = await instance.acquireLease('canvas-leases', {
        lease_id: 'lease-3',
        node_id: 'node-copy',
        holder: { actor_id: 'actor-2', display_name: 'B' },
        ttl_seconds: 120,
      });
      expect(third.accepted).toBe(true);
    });
  });

  it('syncs recoverable text drafts with lease gating and stale rejection', async () => {
    const stub = canvasStub('canvas-text');
    await runInDurableObject(stub, async (instance) => {
      await instance.acquireLease('canvas-text', {
        lease_id: 'lease-node-7',
        node_id: 'node-7',
        holder: { actor_id: 'actor-1', display_name: 'A' },
        ttl_seconds: 120,
      });
      const accepted = await instance.upsertTextDraft('canvas-text', {
        draft_id: 'node-7::parameters.prompt',
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Macro ceramic texture',
        author: { actor_id: 'actor-1', display_name: 'A' },
      });
      expect(accepted.accepted).toBe(true);
      expect(accepted.snapshot.text_drafts).toHaveLength(1);
      const blocked = await instance.upsertTextDraft('canvas-text', {
        draft_id: 'node-7::parameters.prompt',
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Competing draft',
        author: { actor_id: 'actor-2', display_name: 'B' },
      });
      expect(blocked.accepted).toBe(false);
      expect(blocked.reason).toBe('lease_held');
      expect(blocked.snapshot.text_drafts[0]?.body).toContain('Macro ceramic');
    });
  });

  it('clears checkpointed drafts only after a successful revision checkpoint', async () => {
    const stub = canvasStub('canvas-checkpoint');
    await runInDurableObject(stub, async (instance) => {
      await instance.upsertTextDraft('canvas-checkpoint', {
        draft_id: 'node-7::parameters.prompt',
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Draft to checkpoint',
        author: { actor_id: 'actor-1', display_name: 'A' },
      });
      const cleared = await instance.clearCheckpointedDrafts('canvas-checkpoint', {
        draft_ids: ['node-7::parameters.prompt'],
        actor_id: 'actor-1',
        revision_id: 'revision-2',
      });
      expect(cleared.cleared_draft_ids).toEqual(['node-7::parameters.prompt']);
      expect(cleared.snapshot.text_drafts).toHaveLength(0);
      expect(cleared.snapshot).not.toHaveProperty('revision_id');
    });
  });
});
