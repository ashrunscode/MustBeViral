import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_COMMENTS_MAX_BYTES,
  COLLABORATION_COMMENTS_MAX_BYTES_PER_ACTOR,
  COLLABORATION_LEASES_MAX_BYTES_PER_ACTOR,
  COLLABORATION_TEXT_DRAFTS_MAX_BYTES_PER_ACTOR,
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
  type TestSocket,
} from './helpers';

/** A character JSON escapes to six bytes, the worst case for every byte budget. */
const CONTROL = String.fromCharCode(1);
const openSockets: TestSocket[] = [];

afterEach(() => {
  vi.restoreAllMocks();
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

function member(index: number): CollaborationActor {
  return { actor_id: `member-${String(index)}`, display_name: `Member ${String(index)}` };
}

function limitOf(run: () => unknown): CanvasLimitError['limit'] | null {
  try {
    run();
    return null;
  } catch (error) {
    if (error instanceof CanvasLimitError) return error.limit;
    throw error;
  }
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

async function commentResult(socket: TestSocket, body: string): Promise<'created' | string> {
  const before = socket.frames.length;
  socket.send({ type: 'comment.create', payload: { body } });
  const frame = await socket.waitFor(
    (candidate) =>
      socket.frames.indexOf(candidate) >= before &&
      (candidate.type === 'comment.result' || candidate.type === 'error'),
  );
  return frame.type === 'comment.result' ? 'created' : (frame.payload as { code: string }).code;
}

describe('one member cannot deny comments or drafts to the others', () => {
  it('keeps B able to comment after A posts 47 comments of 4,000 characters', async () => {
    const canvasId = 'canvas-fair-comments-ascii';
    const refusals = await withStore(canvasId, (store) => {
      const limits: CanvasLimitError['limit'][] = [];
      for (let index = 0; index < 47; index += 1) {
        const limit = limitOf(() =>
          store.createComment(canvasId, actorA, { body: 'x'.repeat(4_000) }),
        );
        if (limit !== null) limits.push(limit);
      }
      const ownBytes = utf8Bytes(
        JSON.stringify(
          store
            .getSnapshot(canvasId)
            .comments.filter((comment) => comment.author.actor_id === actorA.actor_id),
        ),
      );
      expect(ownBytes).toBeLessThanOrEqual(COLLABORATION_COMMENTS_MAX_BYTES_PER_ACTOR + 64);
      return limits;
    });
    expect(refusals[0]).toEqual({
      resource: 'comments',
      scope: 'actor',
      unit: 'bytes',
      limit: COLLABORATION_COMMENTS_MAX_BYTES_PER_ACTOR,
    });

    const b = await open(canvasId, actorB);
    expect(await commentResult(b, 'ok')).toBe('created');
  });

  it('keeps B able to comment after A sends escape-heavy comments', async () => {
    const canvasId = 'canvas-fair-comments-escaped';
    const a = await open(canvasId);
    for (let index = 0; index < 9; index += 1) {
      a.send({ type: 'comment.create', payload: { body: CONTROL.repeat(4_000) } });
    }
    await a.waitFor(
      () =>
        a.frames.filter((frame) => frame.type === 'comment.result').length +
          errorFrames(a).length >=
        9,
    );
    expect(errorFrames(a, 'CANVAS_LIMIT_REACHED')[0]?.details).toEqual({
      resource: 'comments',
      scope: 'actor',
      unit: 'bytes',
      limit: COLLABORATION_COMMENTS_MAX_BYTES_PER_ACTOR,
    });

    const b = await open(canvasId, actorB);
    expect(await commentResult(b, 'ok')).toBe('created');
  });

  it("refuses an edit that would take A's comments over A's own budget", async () => {
    const canvasId = 'canvas-fair-comment-update';
    await withStore(canvasId, (store) => {
      // Two escape-heavy comments leave about 650 bytes of A's 48 KiB; a short third one fits.
      store.createComment(canvasId, actorA, { body: CONTROL.repeat(4_000) });
      store.createComment(canvasId, actorA, { body: CONTROL.repeat(4_000) });
      const third = store.createComment(canvasId, actorA, { body: 'x' });
      expect(
        limitOf(() =>
          store.updateComment(canvasId, actorA, {
            comment_id: third.comment_id,
            body: CONTROL.repeat(100),
          }),
        ),
      ).toEqual({
        resource: 'comments',
        scope: 'actor',
        unit: 'bytes',
        limit: COLLABORATION_COMMENTS_MAX_BYTES_PER_ACTOR,
      });
    });
  });

  it('keeps B able to draft after A fills fields on a node A leases', async () => {
    const canvasId = 'canvas-fair-drafts';
    const a = await open(canvasId);
    a.send({ type: 'lease.acquire', payload: { node_id: 'node-a', ttl_seconds: 900 } });
    for (let index = 0; index < 9; index += 1) {
      const field = `parameters.field${String(index)}`;
      a.send({
        type: 'text.draft.upsert',
        payload: {
          draft_id: textDraftKey('node-a', field),
          node_id: 'node-a',
          field_path: field,
          body: CONTROL.repeat(4_000),
        },
      });
    }
    await a.waitFor(
      () => a.frames.filter((frame) => frame.type === 'text.draft.result').length === 9,
    );
    const refused = a.frames
      .filter((frame) => frame.type === 'text.draft.result')
      .map((frame) => frame.payload as { accepted: boolean; reason?: string })
      .filter((result) => !result.accepted);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((result) => result.reason === 'limit_reached')).toBe(true);
    expect(errorFrames(a, 'CANVAS_LIMIT_REACHED')[0]?.details).toEqual({
      resource: 'text_drafts',
      scope: 'actor',
      unit: 'bytes',
      limit: COLLABORATION_TEXT_DRAFTS_MAX_BYTES_PER_ACTOR,
    });

    const b = await open(canvasId, actorB);
    // B cannot clear A's drafts while A holds the lease, which is why A's share must be bounded.
    const leased = (await freshSnapshot(b)).text_drafts.map((draft) => draft.draft_id);
    b.send({ type: 'text.draft.clear', payload: { draft_ids: leased, revision_id: 'revision-b' } });
    const cleared = await b.waitFor((frame) => frame.type === 'text.draft.clear.result');
    expect((cleared.payload as { cleared_draft_ids: string[] }).cleared_draft_ids).toEqual([]);

    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey('node-b', 'parameters.prompt'),
        node_id: 'node-b',
        field_path: 'parameters.prompt',
        body: 'Draft from B',
      },
    });
    const result = await b.waitFor((frame) => frame.type === 'text.draft.result');
    expect(result.payload).toMatchObject({ accepted: true, reason: 'ok' });
  });

  it("bounds one member's lease bytes so leases stay available to the others", async () => {
    const canvasId = 'canvas-fair-leases';
    await withStore(canvasId, (store) => {
      const node = (index: number) => `${CONTROL.repeat(125)}${String(index).padStart(3, '0')}`;
      // Escape-heavy node ids and display name: each lease row is close to 3 KiB.
      const holder = { ...member(1), display_name: CONTROL.repeat(128), color: CONTROL.repeat(32) };
      const results = [0, 1, 2, 3].map((index) =>
        store.acquireLease(canvasId, holder, { node_id: node(index), ttl_seconds: 900 }),
      );
      const accepted = results.filter((result) => result.accepted).length;
      // Refused before the four-lease row cap, by the member's byte budget.
      expect(accepted).toBeGreaterThan(0);
      expect(accepted).toBeLessThan(4);
      expect(results[accepted]).toMatchObject({
        reason: 'limit_reached',
        limit: {
          resource: 'leases',
          scope: 'actor',
          unit: 'bytes',
          limit: COLLABORATION_LEASES_MAX_BYTES_PER_ACTOR,
        },
      });
      expect(
        store.acquireLease(canvasId, member(2), { node_id: node(9), ttl_seconds: 900 }).accepted,
      ).toBe(true);
    });
  });
});

describe('fair and one-time trimming of stored rows', () => {
  /** Writes legacy comment rows, oldest first, then loads them through the one-time trim. */
  async function trimLegacyComments(
    canvasId: string,
    rows: readonly (readonly [CollaborationActor, number])[],
  ) {
    return withStore(canvasId, (_store, state) => {
      const sql = state.storage.sql;
      sql.exec('DELETE FROM meta WHERE key = ?', 'schema_version');
      sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'canvas_id', canvasId);
      let clock = Date.UTC(2026, 8, 1);
      for (const [author, count] of rows) {
        for (let index = 0; index < count; index += 1) {
          clock += 1_000;
          const id = `legacy-${String(clock)}`;
          const at = new Date(clock).toISOString();
          sql.exec(
            'INSERT INTO comments (comment_id, payload) VALUES (?, ?)',
            id,
            JSON.stringify({
              comment_id: id,
              author,
              body: 'x'.repeat(4_000),
              created_at: at,
              updated_at: at,
            }),
          );
        }
      }
      const comments = new CoordinationStore(sql).getSnapshot(canvasId).comments;
      return (actorId: string) => comments.filter((comment) => comment.author.actor_id === actorId);
    });
  }

  it("never lets one member's newer rows evict another member's older rows", async () => {
    // The reviewer's case: B's five comments are older than A's 47 near-limit comments.
    const rowsOf = await trimLegacyComments('canvas-fair-purge', [
      [actorB, 5],
      [actorA, 47],
    ]);
    expect(rowsOf(actorB.actor_id)).toHaveLength(5);
    expect(utf8Bytes(JSON.stringify(rowsOf(actorA.actor_id)))).toBeLessThanOrEqual(
      COLLABORATION_COMMENTS_MAX_BYTES_PER_ACTOR,
    );
  });

  it('applies the canvas budget round-robin, so members within their own budgets keep a share', async () => {
    // Five members each within their own 48 KiB are newer than B and together exceed the canvas.
    const heavy = [1, 2, 3, 4, 5].map((index) => [member(index), 11] as const);
    const rowsOf = await trimLegacyComments('canvas-fair-purge-canvas', [[actorB, 5], ...heavy]);
    expect(rowsOf(actorB.actor_id)).toHaveLength(5);
    const kept = [actorB.actor_id, ...heavy.map(([actor]) => actor.actor_id)].flatMap((actorId) =>
      rowsOf(actorId),
    );
    expect(utf8Bytes(JSON.stringify(kept))).toBeLessThanOrEqual(COLLABORATION_COMMENTS_MAX_BYTES);
    expect(kept.length).toBeLessThan(5 + 55);
  });

  it('keeps leases and valid rows when an object is evicted and wakes again', async () => {
    const canvasId = 'canvas-purge-once';
    const a = await open(canvasId);
    a.send({ type: 'lease.acquire', payload: { node_id: 'node-kept', ttl_seconds: 900 } });
    a.send({ type: 'comment.create', payload: { body: 'Survives eviction' } });
    a.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey('node-kept', 'parameters.prompt'),
        node_id: 'node-kept',
        field_path: 'parameters.prompt',
        body: 'Draft that survives',
      },
    });
    const before = await freshSnapshot(a);
    expect(before.leases).toHaveLength(1);

    await evictDurableObject(coordinationStub(canvasId), { webSockets: 'hibernate' });
    const after = await freshSnapshot(await open(canvasId, actorB));

    expect(after.leases.map((lease) => lease.node_id)).toEqual(['node-kept']);
    expect(after.comments.map((comment) => comment.body)).toEqual(['Survives eviction']);
    expect(after.text_drafts.map((draft) => draft.body)).toEqual(['Draft that survives']);
  });

  it('quarantines rows an older Worker wrote after a rollback instead of breaking the canvas', async () => {
    const canvasId = 'canvas-rollback-rows';
    const warn = vi.spyOn(console, 'warn');
    await withStore(canvasId, (store, state) => {
      store.ensureCanvasId(canvasId);
      const sql = state.storage.sql;
      const at = '2026-09-16T00:00:00.000Z';
      // Written by the old code while rolled back, after this object already ran the new schema.
      sql.exec(
        'INSERT INTO comments (comment_id, payload) VALUES (?, ?)',
        'rolled-back-long',
        JSON.stringify({
          comment_id: 'rolled-back-long',
          author: actorA,
          body: 'SECRET-CONTENT '.repeat(400),
          created_at: at,
          updated_at: at,
        }),
      );
      store.createComment(canvasId, actorA, { body: 'Valid comment' });
      sql.exec('INSERT INTO comments (comment_id, payload) VALUES (?, ?)', 'not-json', '{');
      const draftKey = textDraftKey('node-q', 'parameters.prompt');
      sql.exec(
        'INSERT INTO text_drafts (draft_id, payload) VALUES (?, ?)',
        draftKey,
        JSON.stringify({
          draft_id: draftKey,
          node_id: 'node-q',
          field_path: 'parameters.prompt',
          body: 'z'.repeat(6_000),
          author: actorA,
          updated_at: at,
        }),
      );
    });

    const b = await open(canvasId, actorB);
    const snapshot = await freshSnapshot(b);
    expect(snapshot.comments.map((comment) => comment.body)).toEqual(['Valid comment']);
    expect(snapshot.text_drafts).toEqual([]);

    // The quarantined draft does not block its field.
    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey('node-q', 'parameters.prompt'),
        node_id: 'node-q',
        field_path: 'parameters.prompt',
        body: 'Fresh draft',
      },
    });
    const result = await b.waitFor((frame) => frame.type === 'text.draft.result');
    expect(result.payload).toMatchObject({ accepted: true });
    await delay(150);
    expect((await freshSnapshot(b)).text_drafts.map((draft) => draft.body)).toEqual([
      'Fresh draft',
    ]);

    const logged = warn.mock.calls.map((call) => String(call[0]));
    const quarantine = logged
      .filter((line) => line.includes('collaboration.rows_quarantined'))
      .map((line) => JSON.parse(line) as { section: string; count: number });
    expect(quarantine).toEqual(
      expect.arrayContaining([
        { level: 'warn', event: 'collaboration.rows_quarantined', section: 'comments', count: 2 },
      ]),
    );
    expect(logged.join('\n')).not.toContain('SECRET-CONTENT');
    expect(logged.join('\n')).not.toContain('rolled-back-long');
  });
});

describe('oversized and invalid frames are not free', () => {
  it('closes a socket that sends one oversized frame a second', async () => {
    const socket = await open('canvas-oversized-trickle');
    const oversized = JSON.stringify({ type: 'snapshot.request', padding: 'x'.repeat(40_000) });
    for (let index = 0; index < 8 && socket.closed === null; index += 1) {
      socket.sendRaw(oversized);
      await delay(1_000);
    }
    expect(socket.closed).toMatchObject({ code: COLLABORATION_CLOSE_CODES.POLICY_VIOLATION });
    expect(errorFrames(socket, 'PAYLOAD_TOO_LARGE').length).toBeLessThanOrEqual(5);
  }, 20_000);

  it('makes oversized and invalid frames spend the message budget', async () => {
    const canvasId = 'canvas-weighted-frames';
    const oversizedSender = await open(canvasId);
    const oversized = JSON.stringify({ type: 'snapshot.request', padding: 'x'.repeat(40_000) });
    for (let index = 0; index < 3; index += 1) oversizedSender.sendRaw(oversized);
    oversizedSender.send({ type: 'lease.acquire', payload: { node_id: 'n1', ttl_seconds: 120 } });
    await oversizedSender.waitFor(
      () =>
        errorFrames(oversizedSender, 'RATE_LIMITED').length +
          oversizedSender.frames.filter((frame) => frame.type === 'lease.result').length >
        0,
    );
    expect(errorFrames(oversizedSender, 'RATE_LIMITED')).toHaveLength(1);

    const invalidSender = await open(canvasId, actorB);
    for (let index = 0; index < 6; index += 1) invalidSender.sendRaw('{not json');
    invalidSender.send({ type: 'lease.acquire', payload: { node_id: 'n2', ttl_seconds: 120 } });
    await invalidSender.waitFor(
      () =>
        errorFrames(invalidSender, 'RATE_LIMITED').length +
          invalidSender.frames.filter((frame) => frame.type === 'lease.result').length >
        0,
    );
    expect(errorFrames(invalidSender, 'VALIDATION_FAILED')).toHaveLength(6);
    expect(errorFrames(invalidSender, 'RATE_LIMITED')).toHaveLength(1);
  });

  it('closes a socket that keeps sending invalid frames within the message rate', async () => {
    const socket = await open('canvas-invalid-trickle');
    // Two a second spends exactly the refill, so no frame is refused for rate: only the strikes
    // for invalid frames can close the socket.
    for (let index = 0; index < 16 && socket.closed === null; index += 1) {
      socket.sendRaw('{not json');
      await delay(500);
    }
    expect(errorFrames(socket, 'RATE_LIMITED')).toEqual([]);
    expect(socket.closed).toMatchObject({ code: COLLABORATION_CLOSE_CODES.POLICY_VIOLATION });
  }, 20_000);
});
