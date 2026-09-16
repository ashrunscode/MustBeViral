import { SELF, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import {
  COLLABORATION_CLIENT_MESSAGE_MAX_BYTES,
  COLLABORATION_COMMENTS_MAX_BYTES,
  COLLABORATION_COMMENTS_MAX_PER_ACTOR,
  COLLABORATION_COMMENTS_MAX_PER_CANVAS,
  COLLABORATION_LEASES_MAX_PER_ACTOR,
  COLLABORATION_LEASES_MAX_PER_CANVAS,
  COLLABORATION_PRESENCE_MAX_PER_CANVAS,
  COLLABORATION_SNAPSHOT_MAX_BYTES,
  COLLABORATION_TEXT_DRAFTS_MAX_BYTES,
  COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR,
  COLLABORATION_TEXT_DRAFTS_MAX_PER_CANVAS,
  textDraftKey,
  type CollaborationActor,
} from '@mustbeviral/collaboration';

import { CanvasLimitError, CoordinationStore } from '../src/coordination-store';
import {
  actorA,
  actorB,
  coordinationStub,
  delay,
  errorFrames,
  freshSnapshot,
  openSocket,
  snapshotRequest,
  ticketFor,
  type TestSocket,
} from './helpers';

const openSockets: TestSocket[] = [];

afterEach(() => {
  for (const socket of openSockets.splice(0)) socket.close();
});

async function open(
  canvasId: string,
  actor: Readonly<{ actor_id: string; display_name: string; color: string }> = actorA,
): Promise<TestSocket> {
  const socket = await openSocket(canvasId, actor);
  openSockets.push(socket);
  await socket.waitFor((frame) => frame.type === 'snapshot');
  return socket;
}

async function withStore<T>(
  canvasId: string,
  run: (store: CoordinationStore, state: DurableObjectState) => T | Promise<T>,
): Promise<T> {
  return runInDurableObject(coordinationStub(canvasId), (_instance, state) =>
    run(new CoordinationStore(state.storage.sql), state),
  );
}

function filler(index: number, name = 'Filler'): CollaborationActor {
  return { actor_id: `filler-${String(index)}`, display_name: `${name} ${String(index)}` };
}

/** An actor whose every field is at its limit and escapes to six JSON bytes per character. */
function worstCaseActor(index: number): CollaborationActor {
  const suffix = String(index).padStart(4, '0');
  return {
    actor_id: `${'\u0001'.repeat(124)}${suffix}`,
    display_name: '\u0001'.repeat(128),
    color: '\u0001'.repeat(32),
  };
}

function limitError(error: unknown): CanvasLimitError['limit'] | null {
  return error instanceof CanvasLimitError ? error.limit : null;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

describe('collaboration field and message size limits', () => {
  it('rejects over-limit fields with FIELD_TOO_LARGE and stores nothing', async () => {
    const socket = await open('canvas-limits-fields');
    const cases: [unknown, string, number, string][] = [
      [
        { type: 'comment.upsert', payload: { comment_id: 'c-1', body: 'x'.repeat(4_001) } },
        'payload.body',
        4_000,
        'characters',
      ],
      [
        { type: 'comment.create', payload: { body: 'ok', anchor_node_id: 'n'.repeat(129) } },
        'payload.anchor_node_id',
        128,
        'characters',
      ],
      [
        { type: 'comment.update', payload: { comment_id: 'c'.repeat(129), body: 'ok' } },
        'payload.comment_id',
        128,
        'characters',
      ],
      [
        {
          type: 'text.draft.upsert',
          payload: {
            draft_id: textDraftKey('node-1', 'parameters.prompt'),
            node_id: 'node-1',
            field_path: 'parameters.prompt',
            body: 'x'.repeat(4_001),
          },
        },
        'payload.body',
        4_000,
        'characters',
      ],
      [
        {
          type: 'text.draft.upsert',
          payload: {
            draft_id: textDraftKey('node-1', 'f'.repeat(129)),
            node_id: 'node-1',
            field_path: 'f'.repeat(129),
            body: 'ok',
          },
        },
        'payload.field_path',
        128,
        'characters',
      ],
      [
        { type: 'lease.acquire', payload: { node_id: 'n'.repeat(129), ttl_seconds: 120 } },
        'payload.node_id',
        128,
        'characters',
      ],
      [
        {
          type: 'text.draft.clear',
          payload: {
            draft_ids: Array.from({ length: 65 }, (_, index) =>
              textDraftKey(`node-${String(index)}`, 'parameters.prompt'),
            ),
            revision_id: 'revision-1',
          },
        },
        'payload.draft_ids',
        64,
        'items',
      ],
    ];
    for (const [message] of cases) socket.send(message);
    const snapshot = await freshSnapshot(socket);

    const errors = errorFrames(socket, 'FIELD_TOO_LARGE');
    expect(errors.map((error) => error.details)).toEqual(
      cases.map(([, field, limit, unit]) => ({ field, limit, unit })),
    );
    expect(snapshot.comments).toEqual([]);
    expect(snapshot.text_drafts).toEqual([]);
    expect(snapshot.leases).toEqual([]);
  });

  it('refuses frames over the message size limit before parsing them', async () => {
    const socket = await open('canvas-limits-message');
    const limit = COLLABORATION_CLIENT_MESSAGE_MAX_BYTES;
    // Well-formed JSON over the byte limit, in ASCII and in three-byte characters whose UTF-16
    // length alone would pass.
    socket.sendRaw(JSON.stringify({ type: 'snapshot.request', padding: 'x'.repeat(limit) }));
    const euros = '\u20ac'.repeat(Math.ceil(limit / 3) + 10);
    expect(euros.length).toBeLessThan(limit);
    socket.sendRaw(JSON.stringify({ type: 'comment.create', payload: { body: 'ok', pad: euros } }));
    socket.socket.send(new TextEncoder().encode(' '.repeat(limit + 1)).buffer as ArrayBuffer);
    // Control: the largest comment body in three-byte characters is accepted.
    socket.send({ type: 'comment.create', payload: { body: '\u20ac'.repeat(4_000) } });
    await socket.waitFor((frame) => frame.type === 'comment.result');
    const snapshot = await freshSnapshot(socket);

    const tooLarge = errorFrames(socket, 'PAYLOAD_TOO_LARGE');
    expect(tooLarge).toHaveLength(3);
    expect(tooLarge[0]?.details).toEqual({ resource: 'message', unit: 'bytes', limit });
    expect(snapshot.comments).toHaveLength(1);
    // Only the requested snapshots were sent; the oversized snapshot.request was never parsed.
    expect(socket.frames.filter((frame) => frame.type === 'snapshot').length).toBeLessThanOrEqual(
      3,
    );
  });
});

describe('collaboration row caps and snapshot ceiling', () => {
  it('caps comments per actor and per canvas and lets a member recover by deleting', async () => {
    const canvasId = 'canvas-limits-comments';
    await withStore(canvasId, (store) => {
      for (let index = 0; index < COLLABORATION_COMMENTS_MAX_PER_ACTOR; index += 1) {
        store.createComment(canvasId, actorA, { body: `A ${String(index)}` });
      }
    });
    const socket = await open(canvasId);
    socket.send({ type: 'comment.create', payload: { body: 'One too many' } });
    await freshSnapshot(socket);
    expect(errorFrames(socket, 'CANVAS_LIMIT_REACHED')[0]).toMatchObject({
      request_type: 'comment.create',
      details: {
        resource: 'comments',
        scope: 'actor',
        unit: 'rows',
        limit: COLLABORATION_COMMENTS_MAX_PER_ACTOR,
      },
    });

    // Deleting one of A's own comments frees A's quota.
    const own = (await freshSnapshot(socket)).comments[0]!;
    socket.send({ type: 'comment.delete', payload: { comment_id: own.comment_id } });
    socket.send({ type: 'comment.create', payload: { body: 'Fits after deleting' } });
    await socket.waitFor(
      (frame) =>
        frame.type === 'comment.result' &&
        (frame.payload as { operation: string }).operation === 'create',
    );

    await withStore(canvasId, (store) => {
      for (let actor = 1; actor <= 3; actor += 1) {
        for (let index = 0; index < COLLABORATION_COMMENTS_MAX_PER_ACTOR; index += 1) {
          store.createComment(canvasId, filler(actor), { body: `Filler ${String(index)}` });
        }
      }
      expect(store.getSnapshot(canvasId).comments).toHaveLength(
        COLLABORATION_COMMENTS_MAX_PER_CANVAS,
      );
      let refused: unknown;
      try {
        store.createComment(canvasId, actorB, { body: 'Canvas is full' });
      } catch (error) {
        refused = error;
      }
      expect(limitError(refused)).toEqual({
        resource: 'comments',
        scope: 'canvas',
        unit: 'rows',
        limit: COLLABORATION_COMMENTS_MAX_PER_CANVAS,
      });
    });
  });

  it('caps text drafts, leases and presence per canvas and per actor', async () => {
    const canvasId = 'canvas-limits-rows';
    await withStore(canvasId, (store) => {
      const draft = (actor: CollaborationActor, node: string) =>
        store.upsertTextDraft(canvasId, actor, {
          draft_id: textDraftKey(node, 'parameters.prompt'),
          node_id: node,
          field_path: 'parameters.prompt',
          body: 'Draft',
        });
      for (let index = 0; index < COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR; index += 1) {
        expect(draft(filler(1), `a-${String(index)}`).accepted).toBe(true);
      }
      expect(draft(filler(1), 'a-extra')).toMatchObject({
        accepted: false,
        reason: 'limit_reached',
        limit: { resource: 'text_drafts', scope: 'actor', limit: 32 },
      });
      // Replacing an existing field does not count as a new row.
      expect(draft(filler(1), 'a-0').accepted).toBe(true);
      for (let index = 0; index < COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR; index += 1) {
        expect(draft(filler(2), `b-${String(index)}`).accepted).toBe(true);
      }
      expect(draft(filler(3), 'c-0')).toMatchObject({
        accepted: false,
        reason: 'limit_reached',
        limit: { resource: 'text_drafts', scope: 'canvas', limit: 64 },
      });
      expect(store.getSnapshot(canvasId).text_drafts).toHaveLength(
        COLLABORATION_TEXT_DRAFTS_MAX_PER_CANVAS,
      );

      const lease = (actor: CollaborationActor, node: string) =>
        store.acquireLease(canvasId, actor, { node_id: node, ttl_seconds: 120 });
      for (let index = 0; index < COLLABORATION_LEASES_MAX_PER_ACTOR; index += 1) {
        expect(lease(filler(1), `lease-a-${String(index)}`).accepted).toBe(true);
      }
      expect(lease(filler(1), 'lease-a-extra')).toMatchObject({
        accepted: false,
        reason: 'limit_reached',
        limit: { resource: 'leases', scope: 'actor', limit: 4 },
      });
      for (let actor = 2; actor <= COLLABORATION_LEASES_MAX_PER_CANVAS / 4; actor += 1) {
        for (let index = 0; index < COLLABORATION_LEASES_MAX_PER_ACTOR; index += 1) {
          expect(lease(filler(actor), `lease-${String(actor)}-${String(index)}`).accepted).toBe(
            true,
          );
        }
      }
      expect(lease(filler(99), 'lease-over')).toMatchObject({
        accepted: false,
        reason: 'limit_reached',
        limit: { resource: 'leases', scope: 'canvas', limit: 32 },
      });

      for (let index = 0; index < COLLABORATION_PRESENCE_MAX_PER_CANVAS; index += 1) {
        store.joinPresence(canvasId, filler(index), 'canvas');
      }
      let refused: unknown;
      try {
        store.joinPresence(canvasId, filler(500), 'canvas');
      } catch (error) {
        refused = error;
      }
      expect(limitError(refused)).toMatchObject({ resource: 'presence', scope: 'canvas' });
      // An actor already present can still change surface.
      store.joinPresence(canvasId, filler(0), 'review');
      expect(store.getSnapshot(canvasId).presence).toHaveLength(32);
    });
  });

  it('keeps the snapshot under its ceiling with every section filled with worst-case content', async () => {
    const canvasId = 'canvas-limits-worst-case';
    const sizes = [4_000, 1_000, 200, 20, 1];
    const sectionBytes = await withStore(canvasId, (store) => {
      let actorIndex = 0;
      let commentRows = 0;
      for (const size of sizes) {
        for (;;) {
          try {
            store.createComment(canvasId, worstCaseActor(actorIndex), {
              body: '\u0001'.repeat(size),
              anchor_node_id: '\u0001'.repeat(128),
            });
            commentRows += 1;
            if (commentRows % COLLABORATION_COMMENTS_MAX_PER_ACTOR === 0) actorIndex += 1;
          } catch (error) {
            if (limitError(error) === null) throw error;
            break;
          }
        }
      }
      let draftIndex = 0;
      for (const size of sizes) {
        for (;;) {
          const node = `${'\u0001'.repeat(124)}${String(draftIndex).padStart(4, '0')}`;
          const field = '\u0001'.repeat(128);
          const result = store.upsertTextDraft(canvasId, worstCaseActor(1_000 + draftIndex), {
            draft_id: textDraftKey(node, field),
            node_id: node,
            field_path: field,
            body: '\u0001'.repeat(size),
          });
          if (!result.accepted) break;
          draftIndex += 1;
        }
      }
      for (let index = 0; ; index += 1) {
        const node = `${'\u0001'.repeat(124)}${String(index).padStart(4, '0')}`;
        const result = store.acquireLease(canvasId, worstCaseActor(2_000 + index), {
          node_id: node,
          ttl_seconds: 900,
        });
        if (!result.accepted) break;
      }
      for (let index = 0; ; index += 1) {
        try {
          store.joinPresence(canvasId, worstCaseActor(3_000 + index), 'review');
        } catch (error) {
          if (limitError(error) === null) throw error;
          break;
        }
      }
      const snapshot = store.getSnapshot(canvasId);
      return {
        comments: utf8Bytes(JSON.stringify(snapshot.comments)),
        text_drafts: utf8Bytes(JSON.stringify(snapshot.text_drafts)),
        leases: utf8Bytes(JSON.stringify(snapshot.leases)),
        presence: utf8Bytes(JSON.stringify(snapshot.presence)),
      };
    });
    // Each free-text section really is filled close to its budget.
    expect(sectionBytes.comments).toBeGreaterThan(COLLABORATION_COMMENTS_MAX_BYTES - 4_096);
    expect(sectionBytes.text_drafts).toBeGreaterThan(COLLABORATION_TEXT_DRAFTS_MAX_BYTES - 8_192);

    const socket = await open(canvasId, actorB);
    expect(socket.frames[0]?.type).toBe('snapshot');
    expect(socket.frameBytes[0]).toBeLessThanOrEqual(COLLABORATION_SNAPSHOT_MAX_BYTES);
    const response = await SELF.fetch(
      snapshotRequest(canvasId, { Authorization: `Bearer ${await ticketFor(canvasId, actorB)}` }),
    );
    expect(response.status).toBe(200);
    expect(utf8Bytes(await response.text())).toBeLessThanOrEqual(COLLABORATION_SNAPSHOT_MAX_BYTES);
  });

  it("refuses the reviewer's 40 oversized drafts, so the snapshot stays small", async () => {
    const canvasId = 'canvas-limits-reviewer-repro';
    const socket = await open(canvasId);
    for (let batch = 0; batch < 2; batch += 1) {
      for (let index = 0; index < 20; index += 1) {
        const node = `node-${String(batch)}-${String(index)}`;
        socket.send({
          type: 'text.draft.upsert',
          payload: {
            draft_id: textDraftKey(node, 'parameters.prompt'),
            node_id: node,
            field_path: 'parameters.prompt',
            body: 'x'.repeat(32_000),
          },
        });
      }
      await delay(2_100);
    }
    const snapshot = await freshSnapshot(socket);
    expect(snapshot.text_drafts).toEqual([]);
    expect(errorFrames(socket, 'FIELD_TOO_LARGE')).toHaveLength(40);
    expect(Math.max(...socket.frameBytes)).toBeLessThan(COLLABORATION_SNAPSHOT_MAX_BYTES);
  });

  it('never sends a snapshot above the ceiling, even for rows written around the store', async () => {
    const canvasId = 'canvas-limits-ceiling-guard';
    const socket = await open(canvasId);
    await runInDurableObject(coordinationStub(canvasId), (_instance, state) => {
      for (let index = 0; index < 20; index += 1) {
        state.storage.sql.exec(
          'INSERT INTO comments (comment_id, payload) VALUES (?, ?)',
          `raw-${String(index)}`,
          JSON.stringify({
            comment_id: `raw-${String(index)}`,
            author: actorA,
            body: '\u20ac'.repeat(4_000),
            created_at: '2026-09-16T00:00:00.000Z',
            updated_at: '2026-09-16T00:00:00.000Z',
          }),
        );
      }
      for (let index = 0; index < 60; index += 1) {
        const node = `raw-node-${String(index)}`;
        state.storage.sql.exec(
          'INSERT INTO text_drafts (draft_id, payload) VALUES (?, ?)',
          textDraftKey(node, 'parameters.prompt'),
          JSON.stringify({
            draft_id: textDraftKey(node, 'parameters.prompt'),
            node_id: node,
            field_path: 'parameters.prompt',
            body: '\u20ac'.repeat(4_000),
            author: actorA,
            updated_at: '2026-09-16T00:00:00.000Z',
          }),
        );
      }
    });
    const framesBefore = socket.frames.length;
    socket.send({ type: 'snapshot.request' });
    await socket.waitFor(
      (frame) =>
        frame.type === 'error' && (frame.payload as { code: string }).code === 'SNAPSHOT_TOO_LARGE',
    );
    expect(socket.frames.slice(framesBefore).some((frame) => frame.type === 'snapshot')).toBe(
      false,
    );
    expect(Math.max(...socket.frameBytes)).toBeLessThanOrEqual(COLLABORATION_SNAPSHOT_MAX_BYTES);
    const response = await SELF.fetch(
      snapshotRequest(canvasId, { Authorization: `Bearer ${await ticketFor(canvasId, actorA)}` }),
    );
    expect(response.status).toBe(503);
  });

  it('drops rows written before the limits when an object first loads the new schema', async () => {
    const canvasId = 'canvas-limits-migration';
    const snapshot = await withStore(canvasId, (_store, state) => {
      const sql = state.storage.sql;
      sql.exec('DELETE FROM meta WHERE key = ?', 'schema_version');
      sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'canvas_id', canvasId);
      sql.exec(
        'INSERT INTO comments (comment_id, payload) VALUES (?, ?)',
        'legacy-long',
        JSON.stringify({
          comment_id: 'legacy-long',
          author: actorA,
          body: 'x'.repeat(8_000),
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
        }),
      );
      sql.exec(
        'INSERT INTO comments (comment_id, payload) VALUES (?, ?)',
        'legacy-ok',
        JSON.stringify({
          comment_id: 'legacy-ok',
          author: actorA,
          body: 'Short',
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
        }),
      );
      for (let index = 0; index < 40; index += 1) {
        const node = `legacy-node-${String(index)}`;
        sql.exec(
          'INSERT INTO text_drafts (draft_id, payload) VALUES (?, ?)',
          `${node}::parameters.prompt`,
          JSON.stringify({
            draft_id: `${node}::parameters.prompt`,
            node_id: node,
            field_path: 'parameters.prompt',
            body: 'x'.repeat(index < 10 ? 32_000 : 3_000),
            author: actorB,
            updated_at: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
          }),
        );
      }
      sql.exec(
        'INSERT INTO leases (lease_id, node_id, payload, expires_at) VALUES (?, ?, ?, ?)',
        'lease-x-a-b',
        'x',
        JSON.stringify({
          lease_id: 'lease-x-a-b',
          node_id: 'x',
          holder: actorA,
          acquired_at: '2026-09-16T00:00:00.000Z',
          expires_at: '2099-01-01T00:00:00.000Z',
        }),
        '2099-01-01T00:00:00.000Z',
      );
      return new CoordinationStore(sql).getSnapshot(canvasId);
    });

    expect(snapshot.comments.map((comment) => comment.comment_id)).toEqual(['legacy-ok']);
    expect(snapshot.leases).toEqual([]);
    // 30 valid drafts of about 3 KiB remain; the 32,000-character ones are gone. Draft rows are
    // also capped per actor, so the newest 32 from the one author would be the most kept.
    expect(snapshot.text_drafts).toHaveLength(30);
    expect(snapshot.text_drafts.every((draft) => draft.body.length === 3_000)).toBe(true);
    expect(utf8Bytes(JSON.stringify(snapshot))).toBeLessThan(COLLABORATION_SNAPSHOT_MAX_BYTES);
  });
});
