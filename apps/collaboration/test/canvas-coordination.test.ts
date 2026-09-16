import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { leaseIdForActor, textDraftKey } from '@mustbeviral/collaboration';

import { CoordinationStore, OwnershipError } from '../src/coordination-store';
import { INTERNAL_IDENTITY_HEADER, encodeVerifiedIdentity } from '../src/identity';

const actor1 = { actor_id: 'actor-1', display_name: 'A', color: '#3182d4' };
const actor2 = { actor_id: 'actor-2', display_name: 'B', color: '#1f9d63' };

function canvasStub(canvasId: string) {
  const namespace = env.CANVAS_COORDINATION;
  if (!namespace) throw new Error('CANVAS_COORDINATION binding is not configured');
  return namespace.get(namespace.idFromName(canvasId));
}

/** Runs against the object's real SQLite storage without going through any public object method. */
async function withStore<T>(
  canvasId: string,
  run: (store: CoordinationStore, state: DurableObjectState) => T | Promise<T>,
): Promise<T> {
  return runInDurableObject(canvasStub(canvasId), (_instance, state) =>
    run(new CoordinationStore(state.storage.sql), state),
  );
}

describe('CanvasCoordination durable object', () => {
  it('stores recoverable comment drafts without mutating revision authority', async () => {
    await withStore('canvas-comments', (store) => {
      store.upsertComment('canvas-comments', actor1, {
        comment_id: 'comment-1',
        body: 'Tighten the hook on frame two.',
        anchor_node_id: 'node-hook',
      });
      const snapshot = store.getSnapshot('canvas-comments');
      expect(snapshot.canvas_id).toBe('canvas-comments');
      expect(snapshot.comments).toHaveLength(1);
      expect(snapshot.comments[0]?.body).toContain('frame two');
      expect(snapshot.comments[0]?.author).toEqual(actor1);
      expect(snapshot).not.toHaveProperty('revision_id');
      expect(snapshot).not.toHaveProperty('ledger');
      expect(() =>
        store.upsertComment('canvas-comments', actor2, {
          comment_id: 'comment-1',
          body: 'Rewritten by someone else',
        }),
      ).toThrow('Only the author');
    });
  });

  it('tracks presence joins per actor and surface', async () => {
    await withStore('canvas-presence', (store) => {
      store.joinPresence('canvas-presence', actor1, 'review');
      const snapshot = store.getSnapshot('canvas-presence');
      expect(snapshot.presence).toHaveLength(1);
      expect(snapshot.presence[0]?.surface).toBe('review');
    });
  });

  it('rejects conflicting edit leases until the holder releases', async () => {
    await withStore('canvas-leases', (store) => {
      const canvasId = 'canvas-leases';
      expect(
        store.acquireLease(canvasId, actor1, {
          lease_id: leaseIdForActor('node-copy', actor1.actor_id),
          node_id: 'node-copy',
          ttl_seconds: 120,
        }),
      ).toBe(true);
      expect(
        store.acquireLease(canvasId, actor2, {
          lease_id: leaseIdForActor('node-copy', actor2.actor_id),
          node_id: 'node-copy',
          ttl_seconds: 120,
        }),
      ).toBe(false);
      store.releaseLease(canvasId, actor2, leaseIdForActor('node-copy', actor1.actor_id));
      expect(store.getSnapshot(canvasId).leases).toHaveLength(1);
      store.releaseLease(canvasId, actor1, leaseIdForActor('node-copy', actor1.actor_id));
      expect(
        store.acquireLease(canvasId, actor2, {
          lease_id: leaseIdForActor('node-copy', actor2.actor_id),
          node_id: 'node-copy',
          ttl_seconds: 120,
        }),
      ).toBe(true);
    });
  });

  it('refuses a lease id that is not derived from the node and the bound holder', async () => {
    await withStore('canvas-lease-ids', (store) => {
      expect(
        store.acquireLease('canvas-lease-ids', actor2, {
          lease_id: leaseIdForActor('node-copy', actor1.actor_id),
          node_id: 'node-copy',
          ttl_seconds: 120,
        }),
      ).toBe(false);
      expect(store.getSnapshot('canvas-lease-ids').leases).toHaveLength(0);
    });
  });

  it('syncs recoverable text drafts with lease gating and stale rejection', async () => {
    await withStore('canvas-text', (store) => {
      const canvasId = 'canvas-text';
      store.acquireLease(canvasId, actor1, {
        lease_id: leaseIdForActor('node-7', actor1.actor_id),
        node_id: 'node-7',
        ttl_seconds: 120,
      });
      const accepted = store.upsertTextDraft(canvasId, actor1, {
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Macro ceramic texture',
      });
      expect(accepted.accepted).toBe(true);
      expect(store.getSnapshot(canvasId).text_drafts).toHaveLength(1);
      const blocked = store.upsertTextDraft(canvasId, actor2, {
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Competing draft',
      });
      expect(blocked).toEqual({ accepted: false, reason: 'lease_held' });
      expect(store.getSnapshot(canvasId).text_drafts[0]?.body).toContain('Macro ceramic');
      expect(() =>
        store.upsertTextDraft(canvasId, actor2, {
          draft_id: textDraftKey('node-7', 'parameters.prompt'),
          node_id: 'node-8',
          field_path: 'parameters.prompt',
          body: 'Reusing another field id',
        }),
      ).toThrow('draft_id');
    });
  });

  it('clears checkpointed drafts only for the bound actor or unleased nodes', async () => {
    await withStore('canvas-checkpoint', (store) => {
      const canvasId = 'canvas-checkpoint';
      store.upsertTextDraft(canvasId, actor1, {
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        node_id: 'node-7',
        field_path: 'parameters.prompt',
        body: 'Draft to checkpoint',
      });
      store.acquireLease(canvasId, actor1, {
        lease_id: leaseIdForActor('node-8', actor1.actor_id),
        node_id: 'node-8',
        ttl_seconds: 120,
      });
      store.upsertTextDraft(canvasId, actor1, {
        draft_id: textDraftKey('node-8', 'parameters.prompt'),
        node_id: 'node-8',
        field_path: 'parameters.prompt',
        body: 'Leased draft',
      });
      const byOther = store.clearCheckpointedDrafts(canvasId, actor2, {
        draft_ids: [
          textDraftKey('node-7', 'parameters.prompt'),
          textDraftKey('node-8', 'parameters.prompt'),
        ],
        revision_id: 'revision-2',
      });
      expect(byOther).toEqual([textDraftKey('node-7', 'parameters.prompt')]);
      expect(store.getSnapshot(canvasId).text_drafts.map((draft) => draft.node_id)).toEqual([
        'node-8',
      ]);
      expect(store.getSnapshot(canvasId)).not.toHaveProperty('revision_id');
      const byOwner = store.clearCheckpointedDrafts(canvasId, actor1, {
        draft_ids: [textDraftKey('node-8', 'parameters.prompt')],
        revision_id: 'revision-3',
      });
      expect(byOwner).toEqual([textDraftKey('node-8', 'parameters.prompt')]);
      expect(store.getSnapshot(canvasId).text_drafts).toHaveLength(0);
    });
  });

  it('handles drafts stored under the earlier joined-string key without collisions', async () => {
    await withStore('canvas-legacy-drafts', (store, state) => {
      const canvasId = 'canvas-legacy-drafts';
      store.ensureCanvasId(canvasId);
      const legacyRow = (nodeId: string, draftId: string, body: string) =>
        state.storage.sql.exec(
          'INSERT INTO text_drafts (draft_id, payload) VALUES (?, ?)',
          draftId,
          JSON.stringify({
            draft_id: draftId,
            node_id: nodeId,
            field_path: 'parameters.prompt',
            body,
            author: actor1,
            updated_at: '2026-09-01T00:00:00.000Z',
          }),
        );

      // A legacy row for the same field is replaced, not duplicated.
      legacyRow('node-7', 'node-7::parameters.prompt', 'Legacy');
      expect(
        store.upsertTextDraft(canvasId, actor1, {
          draft_id: textDraftKey('node-7', 'parameters.prompt'),
          node_id: 'node-7',
          field_path: 'parameters.prompt',
          body: 'Current',
        }).accepted,
      ).toBe(true);
      const drafts = store.getSnapshot(canvasId).text_drafts;
      expect(drafts).toHaveLength(1);
      expect(drafts[0]).toMatchObject({
        draft_id: textDraftKey('node-7', 'parameters.prompt'),
        body: 'Current',
      });

      // A legacy row can still be cleared by the id the snapshot shows for it.
      legacyRow('node-8', 'node-8::parameters.prompt', 'Legacy to clear');
      expect(
        store.clearCheckpointedDrafts(canvasId, actor1, {
          draft_ids: ['node-8::parameters.prompt'],
          revision_id: 'revision-legacy',
        }),
      ).toEqual(['node-8::parameters.prompt']);

      // A stored row whose id names a different node field is never replaced through that id.
      legacyRow('node-other', textDraftKey('node-9', 'parameters.prompt'), 'Protected');
      expect(() =>
        store.upsertTextDraft(canvasId, actor2, {
          draft_id: textDraftKey('node-9', 'parameters.prompt'),
          node_id: 'node-9',
          field_path: 'parameters.prompt',
          body: 'Replacement attempt',
        }),
      ).toThrow(OwnershipError);
      expect(
        store.getSnapshot(canvasId).text_drafts.find((draft) => draft.node_id === 'node-other')
          ?.body,
      ).toBe('Protected');
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

  it('does not expose state-changing or reading methods over RPC', async () => {
    const canvasId = 'canvas-rpc-surface';
    const stub = canvasStub(canvasId);
    // @ts-expect-error upsertComment must not be part of the object's RPC surface.
    void stub.upsertComment;
    const untyped = stub as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const draftId = textDraftKey('node-1', 'parameters.prompt');
    const calls: [string, unknown[]][] = [
      ['getSnapshot', [canvasId]],
      ['joinPresence', [canvasId, actor1, 'canvas']],
      ['leavePresence', [canvasId, actor1]],
      [
        'upsertComment',
        [canvasId, actor1, { comment_id: 'rpc-comment', body: 'Written over RPC' }],
      ],
      [
        'upsertTextDraft',
        [
          canvasId,
          actor1,
          { draft_id: draftId, node_id: 'node-1', field_path: 'parameters.prompt', body: 'RPC' },
        ],
      ],
      [
        'acquireLease',
        [
          canvasId,
          actor1,
          {
            lease_id: leaseIdForActor('node-1', actor1.actor_id),
            node_id: 'node-1',
            ttl_seconds: 120,
          },
        ],
      ],
      ['releaseLease', [canvasId, actor1, leaseIdForActor('node-1', actor1.actor_id)]],
      [
        'clearCheckpointedDrafts',
        [canvasId, actor1, { draft_ids: [draftId], revision_id: 'revision-rpc' }],
      ],
    ];
    for (const [method, args] of calls) {
      await expect(
        Promise.resolve().then(() => untyped[method]!(...args)),
        method,
      ).rejects.toThrow();
    }
    const snapshot = await stub.fetch(
      new Request(`https://coordination.internal/snapshot?canvas_id=${canvasId}`, {
        headers: {
          [INTERNAL_IDENTITY_HEADER]: encodeVerifiedIdentity({
            canvas_id: canvasId,
            actor: actor1,
          }),
        },
      }),
    );
    const body = (await snapshot.json()) as {
      data: { comments: unknown[]; text_drafts: unknown[]; leases: unknown[]; presence: unknown[] };
    };
    expect(body.data.comments).toHaveLength(0);
    expect(body.data.text_drafts).toHaveLength(0);
    expect(body.data.leases).toHaveLength(0);
    expect(body.data.presence).toHaveLength(0);
  });

  it('broadcasts only to sockets with a bound identity and closes the others', async () => {
    const canvasId = 'canvas-unbound-sockets';
    const stub = canvasStub(canvasId);
    await runInDurableObject(stub, async (instance, state) => {
      const delay = (ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        });
      const listen = (socket: WebSocket) => {
        const record = { messages: [] as string[], closed: false };
        socket.accept();
        socket.addEventListener('message', (event) => {
          record.messages.push(String(event.data));
        });
        socket.addEventListener('close', () => {
          record.closed = true;
        });
        return record;
      };

      const unbound = new WebSocketPair();
      state.acceptWebSocket(unbound[1]);
      const unboundClient = listen(unbound[0]);

      const malformed = new WebSocketPair();
      state.acceptWebSocket(malformed[1]);
      malformed[1].serializeAttachment({ canvas_id: canvasId, actor: { actor_id: '' } });
      const malformedClient = listen(malformed[0]);

      const bound = new WebSocketPair();
      state.acceptWebSocket(bound[1]);
      bound[1].serializeAttachment({
        v: 1,
        socket_id: 'bound-socket',
        canvas_id: canvasId,
        actor: actor1,
        surface: null,
      });
      const boundClient = listen(bound[0]);

      await instance.webSocketMessage(
        bound[1],
        JSON.stringify({
          type: 'comment.upsert',
          payload: { comment_id: 'broadcast-comment', body: 'Only bound sockets see this.' },
        }),
      );
      await delay(100);

      expect(boundClient.messages.some((message) => message.includes('broadcast-comment'))).toBe(
        true,
      );
      expect(unboundClient.messages).toEqual([]);
      expect(malformedClient.messages).toEqual([]);
      expect(unboundClient.closed).toBe(true);
      expect(malformedClient.closed).toBe(true);
      for (const socket of state.getWebSockets()) {
        try {
          socket.close(1000, 'test complete');
        } catch {
          // Already closed.
        }
      }
    });
  });
});
