import { afterEach, describe, expect, it } from 'vitest';

import {
  actorA,
  actorB,
  errorFrames,
  freshSnapshot,
  openSocket,
  type ServerFrame,
  type TestSocket,
} from './helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const openSockets: TestSocket[] = [];

afterEach(() => {
  for (const socket of openSockets.splice(0)) socket.close();
});

async function pair(canvasId: string): Promise<Readonly<{ a: TestSocket; b: TestSocket }>> {
  const a = await openSocket(canvasId, actorA);
  const b = await openSocket(canvasId, actorB);
  openSockets.push(a, b);
  await a.waitFor((frame) => frame.type === 'snapshot');
  await b.waitFor((frame) => frame.type === 'snapshot');
  return { a, b };
}

function commentResults(socket: TestSocket): { operation: string; comment_id: string }[] {
  return socket.frames
    .filter((frame: ServerFrame) => frame.type === 'comment.result')
    .map((frame) => frame.payload as { operation: string; comment_id: string });
}

describe('server-assigned comment ids', () => {
  it('ignores client-chosen ids on create and returns the id it assigned', async () => {
    const { a, b } = await pair('canvas-comment-ids');
    // The web app used to build ids as `comment-${anchor}-${Date.now()}`. B pre-claims the id A
    // would pick next, through both the legacy upsert and the new create message.
    const predicted = `comment-hero-${String(Date.now() + 5_000)}`;
    b.send({
      type: 'comment.upsert',
      payload: { comment_id: predicted, body: 'Squatting A', anchor_node_id: 'hero' },
    });
    b.send({
      type: 'comment.create',
      payload: { comment_id: predicted, body: 'Squatting A again', anchor_node_id: 'hero' },
    });
    await freshSnapshot(b);

    a.send({
      type: 'comment.create',
      payload: {
        comment_id: predicted,
        body: 'From A',
        anchor_node_id: 'hero',
        client_request_id: 'request-1',
      },
    });
    const created = await a.waitFor((frame) => frame.type === 'comment.result');
    const snapshot = await freshSnapshot(a);

    expect(created.payload).toMatchObject({ operation: 'create', client_request_id: 'request-1' });
    const assigned = (created.payload as { comment_id: string }).comment_id;
    expect(assigned).toMatch(UUID);
    const fromA = snapshot.comments.find((comment) => comment.body === 'From A');
    expect(fromA?.comment_id).toBe(assigned);
    expect(fromA?.author.actor_id).toBe(actorA.actor_id);
    const ids = snapshot.comments.map((comment) => comment.comment_id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain(predicted);
    for (const id of ids) expect(id).toMatch(UUID);
    // Legacy clients receive no comment.result they could not parse.
    expect(commentResults(b).map((result) => result.operation)).toEqual(['create']);
  });

  it("does not let a member update or delete another member's comment", async () => {
    const { a, b } = await pair('canvas-comment-ownership');
    a.send({ type: 'comment.create', payload: { body: 'Original from A' } });
    const created = await a.waitFor((frame) => frame.type === 'comment.result');
    const idA = (created.payload as { comment_id: string }).comment_id;

    b.send({ type: 'comment.update', payload: { comment_id: idA, body: 'Rewritten by B' } });
    b.send({ type: 'comment.delete', payload: { comment_id: idA, client_request_id: 'del-1' } });
    const afterAttack = await freshSnapshot(b);

    expect(afterAttack.comments).toEqual([
      expect.objectContaining({ comment_id: idA, body: 'Original from A' }),
    ]);
    expect(errorFrames(b, 'FORBIDDEN').map((error) => error.request_type)).toEqual([
      'comment.update',
      'comment.delete',
    ]);
    expect(errorFrames(b, 'FORBIDDEN')[1]).toMatchObject({ client_request_id: 'del-1' });
    expect(commentResults(b)).toEqual([]);
  });

  it('lets a member edit and delete their own comments', async () => {
    const { a, b } = await pair('canvas-comment-recovery');
    a.send({ type: 'comment.create', payload: { body: 'Typo in this nite' } });
    const created = await a.waitFor((frame) => frame.type === 'comment.result');
    const idA = (created.payload as { comment_id: string }).comment_id;

    a.send({ type: 'comment.update', payload: { comment_id: idA, body: 'Typo in this note' } });
    const edited = await freshSnapshot(a);
    expect(edited.comments.map((comment) => comment.body)).toEqual(['Typo in this note']);

    a.send({ type: 'comment.delete', payload: { comment_id: idA } });
    const deleted = await freshSnapshot(a);
    expect(deleted.comments).toEqual([]);
    expect(commentResults(a).map((result) => [result.operation, result.comment_id])).toEqual([
      ['create', idA],
      ['update', idA],
      ['delete', idA],
    ]);

    a.send({ type: 'comment.delete', payload: { comment_id: idA } });
    await freshSnapshot(a);
    expect(errorFrames(a, 'NOT_FOUND').map((error) => error.request_type)).toEqual([
      'comment.delete',
    ]);
    // Other members see the deletion.
    const seenByB = await freshSnapshot(b);
    expect(seenByB.comments).toEqual([]);
  });
});
