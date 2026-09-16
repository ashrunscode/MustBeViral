import { env, evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import { leaseIdForActor, legacyLeaseIdForActor, textDraftKey } from '@mustbeviral/collaboration';

import {
  actorA,
  actorB,
  freshSnapshot,
  openSocket,
  settle,
  type ServerFrame,
  type TestSocket,
} from './helpers';

// Every attack below sends the forged identity fields an attacker would send (claiming actor A).
// The server must ignore them and act only as the ticket-bound actor B.

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

function lastOfType(socket: TestSocket, type: string): ServerFrame | undefined {
  return socket.frames.filter((frame) => frame.type === type).at(-1);
}

function stub(canvasId: string) {
  const namespace = env.CANVAS_COORDINATION;
  if (!namespace) throw new Error('CANVAS_COORDINATION binding is not configured');
  return namespace.get(namespace.idFromName(canvasId));
}

describe('ticket-bound identity in the canvas coordination object', () => {
  it("does not let B remove A's presence or join as A", async () => {
    const { a, b } = await pair('canvas-attack-presence');
    a.send({ type: 'presence.join', payload: { actor: actorA, surface: 'canvas' } });
    await freshSnapshot(a);

    b.send({ type: 'presence.leave', payload: { actor_id: actorA.actor_id } });
    b.send({
      type: 'presence.join',
      payload: { actor: { ...actorA, display_name: 'Impersonated A' }, surface: 'review' },
    });
    const snapshot = await freshSnapshot(b);

    const presenceA = snapshot.presence.find((entry) => entry.actor.actor_id === actorA.actor_id);
    expect(presenceA?.actor.display_name).toBe(actorA.display_name);
    expect(presenceA?.surface).toBe('canvas');
    const presenceB = snapshot.presence.find((entry) => entry.actor.actor_id === actorB.actor_id);
    expect(presenceB?.actor.display_name).toBe(actorB.display_name);
    expect(snapshot.presence).toHaveLength(2);
  });

  it("does not let B release A's lease or replace it through A's lease id", async () => {
    const canvasId = 'canvas-attack-lease';
    const { a, b } = await pair(canvasId);
    const leaseA = leaseIdForActor('node-1', actorA.actor_id);
    a.send({
      type: 'lease.acquire',
      payload: { lease_id: leaseA, node_id: 'node-1', holder: actorA, ttl_seconds: 120 },
    });
    await a.waitFor(
      (frame) =>
        frame.type === 'lease.result' &&
        (frame.payload as { accepted: boolean }).accepted &&
        (frame.payload as { lease_id: string }).lease_id === leaseA,
    );

    b.send({ type: 'lease.release', payload: { lease_id: leaseA, actor_id: actorA.actor_id } });
    b.send({
      type: 'lease.acquire',
      payload: { lease_id: leaseA, node_id: 'node-2', holder: actorA, ttl_seconds: 120 },
    });
    b.send({
      type: 'lease.acquire',
      payload: {
        lease_id: leaseIdForActor('node-3', actorB.actor_id),
        node_id: 'node-3',
        holder: actorA,
        ttl_seconds: 120,
      },
    });
    const snapshot = await freshSnapshot(b);

    const node1 = snapshot.leases.find((lease) => lease.node_id === 'node-1');
    expect(node1?.lease_id).toBe(leaseA);
    expect(node1?.holder.actor_id).toBe(actorA.actor_id);
    expect(snapshot.leases.find((lease) => lease.node_id === 'node-2')).toBeUndefined();
    const node3 = snapshot.leases.find((lease) => lease.node_id === 'node-3');
    expect(node3?.holder.actor_id).toBe(actorB.actor_id);
    expect(node3?.holder.display_name).toBe(actorB.display_name);
  });

  it("does not let B author a comment as A or overwrite A's comment", async () => {
    const { a, b } = await pair('canvas-attack-comment');
    a.send({
      type: 'comment.upsert',
      payload: { comment_id: 'comment-a', author: actorA, body: 'Original from A' },
    });
    const beforeAttack = await freshSnapshot(a);
    const idA = beforeAttack.comments.find(
      (comment) => comment.body === 'Original from A',
    )?.comment_id;
    expect(idA).toBeTypeOf('string');

    // A legacy upsert naming A's id creates B's own comment; an update naming it is refused.
    b.send({
      type: 'comment.upsert',
      payload: { comment_id: idA, author: actorA, body: 'Rewritten by B' },
    });
    b.send({
      type: 'comment.update',
      payload: { comment_id: idA, author: actorA, body: 'Updated by B' },
    });
    b.send({
      type: 'comment.upsert',
      payload: { comment_id: 'comment-b', author: actorA, body: 'Signed as A by B' },
    });
    const snapshot = await freshSnapshot(b);

    const commentA = snapshot.comments.find((comment) => comment.comment_id === idA);
    expect(commentA?.body).toBe('Original from A');
    expect(commentA?.author.actor_id).toBe(actorA.actor_id);
    const commentB = snapshot.comments.find((comment) => comment.body === 'Signed as A by B');
    expect(commentB?.author.actor_id).toBe(actorB.actor_id);
    expect(commentB?.author.display_name).toBe(actorB.display_name);
    expect(commentB?.comment_id).not.toBe('comment-b');
    expect(
      snapshot.comments.find((comment) => comment.body === 'Rewritten by B')?.author.actor_id,
    ).toBe(actorB.actor_id);
    expect(snapshot.comments.some((comment) => comment.body === 'Updated by B')).toBe(false);
    expect(
      b.frames.some(
        (frame) =>
          frame.type === 'error' && (frame.payload as { code: string }).code === 'FORBIDDEN',
      ),
    ).toBe(true);
  });

  it("does not let B draft as A on A's leased node or overwrite A's draft by id", async () => {
    const { a, b } = await pair('canvas-attack-draft');
    const draftA = textDraftKey('node-1', 'parameters.prompt');
    a.send({
      type: 'lease.acquire',
      payload: {
        lease_id: leaseIdForActor('node-1', actorA.actor_id),
        node_id: 'node-1',
        holder: actorA,
        ttl_seconds: 120,
      },
    });
    a.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: draftA,
        node_id: 'node-1',
        field_path: 'parameters.prompt',
        body: 'Draft from A',
        author: actorA,
      },
    });
    await freshSnapshot(a);

    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: draftA,
        node_id: 'node-1',
        field_path: 'parameters.prompt',
        body: 'B claiming to be A',
        author: actorA,
      },
    });
    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: draftA,
        node_id: 'node-9',
        field_path: 'parameters.prompt',
        body: 'B reusing the id of A',
        author: actorA,
      },
    });
    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey('node-2', 'parameters.prompt'),
        node_id: 'node-2',
        field_path: 'parameters.prompt',
        body: 'Draft from B',
        author: actorA,
      },
    });
    const snapshot = await freshSnapshot(b);

    const onNode1 = snapshot.text_drafts.find((draft) => draft.node_id === 'node-1');
    expect(onNode1?.draft_id).toBe(draftA);
    expect(onNode1?.body).toBe('Draft from A');
    expect(onNode1?.author.actor_id).toBe(actorA.actor_id);
    expect(snapshot.text_drafts.find((draft) => draft.node_id === 'node-9')).toBeUndefined();
    const onNode2 = snapshot.text_drafts.find((draft) => draft.node_id === 'node-2');
    expect(onNode2?.author.actor_id).toBe(actorB.actor_id);
    const leaseRejection = b.frames.find(
      (frame) =>
        frame.type === 'text.draft.result' &&
        (frame.payload as { node_id: string }).node_id === 'node-1',
    );
    expect((leaseRejection?.payload as { accepted: boolean } | undefined)?.accepted).toBe(false);
  });

  it("does not let B clear A's leased draft by claiming A's actor id", async () => {
    const { a, b } = await pair('canvas-attack-clear');
    const draftA = textDraftKey('node-1', 'parameters.prompt');
    a.send({
      type: 'lease.acquire',
      payload: {
        lease_id: leaseIdForActor('node-1', actorA.actor_id),
        node_id: 'node-1',
        holder: actorA,
        ttl_seconds: 120,
      },
    });
    a.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: draftA,
        node_id: 'node-1',
        field_path: 'parameters.prompt',
        body: 'Unsaved work from A',
        author: actorA,
      },
    });
    await freshSnapshot(a);

    b.send({
      type: 'text.draft.clear',
      payload: { draft_ids: [draftA], actor_id: actorA.actor_id, revision_id: 'revision-forged' },
    });
    const snapshot = await freshSnapshot(b);

    expect(snapshot.text_drafts.map((draft) => draft.draft_id)).toContain(draftA);
    const result = lastOfType(b, 'text.draft.clear.result');
    expect((result?.payload as { cleared_draft_ids: string[] }).cleared_draft_ids).toEqual([]);

    // The lease holder can still clear its own checkpointed draft.
    a.send({
      type: 'text.draft.clear',
      payload: { draft_ids: [draftA], revision_id: 'revision-2' },
    });
    const afterOwnerClear = await freshSnapshot(a);
    expect(afterOwnerClear.text_drafts).toHaveLength(0);
  });

  it("removes only the closing socket's bound presence", async () => {
    const { a, b } = await pair('canvas-close-presence');
    // Legacy clients also sent their own actor; that field is ignored but still parses.
    a.send({ type: 'presence.join', payload: { actor: actorA, surface: 'canvas' } });
    b.send({ type: 'presence.join', payload: { actor: actorB, surface: 'review' } });
    await freshSnapshot(a);
    await freshSnapshot(b);

    b.close();
    await settle(150);
    const snapshot = await freshSnapshot(a);
    expect(snapshot.presence.map((entry) => entry.actor.actor_id)).toEqual([actorA.actor_id]);
  });

  it("does not let a draft-key separator collision replace A's leased draft", async () => {
    const { a, b } = await pair('canvas-attack-draft-separator');
    const leasedNode = 'n::1';
    a.send({
      type: 'lease.acquire',
      payload: {
        lease_id: leaseIdForActor(leasedNode, actorA.actor_id),
        node_id: leasedNode,
        ttl_seconds: 120,
      },
    });
    a.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey(leasedNode, 'parameters.prompt'),
        node_id: leasedNode,
        field_path: 'parameters.prompt',
        body: 'Leased draft from A',
      },
    });
    const beforeAttack = await freshSnapshot(a);
    expect(beforeAttack.text_drafts.map((draft) => draft.node_id)).toEqual([leasedNode]);

    // The reviewer's reproduction: node "n" plus field "1::parameters.prompt" joined with "::"
    // spells the same string key as node "n::1" plus field "parameters.prompt".
    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: 'n::1::parameters.prompt',
        node_id: 'n',
        field_path: '1::parameters.prompt',
        body: 'B overwriting through a colliding key',
      },
    });
    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey('n', '1::parameters.prompt'),
        node_id: 'n',
        field_path: '1::parameters.prompt',
        body: 'B drafting its own field',
      },
    });
    b.send({
      type: 'text.draft.upsert',
      payload: {
        draft_id: textDraftKey(leasedNode, 'parameters.prompt'),
        node_id: leasedNode,
        field_path: 'parameters.prompt',
        body: 'B writing the leased node directly',
      },
    });
    const snapshot = await freshSnapshot(b);

    const leased = snapshot.text_drafts.find(
      (draft) => draft.node_id === leasedNode && draft.field_path === 'parameters.prompt',
    );
    expect(leased?.body).toBe('Leased draft from A');
    expect(leased?.author.actor_id).toBe(actorA.actor_id);
    expect(leased?.draft_id).toBe(textDraftKey(leasedNode, 'parameters.prompt'));
    expect(textDraftKey('n', '1::parameters.prompt')).not.toBe(
      textDraftKey(leasedNode, 'parameters.prompt'),
    );
    const direct = b.frames.find(
      (frame) =>
        frame.type === 'text.draft.result' &&
        (frame.payload as { node_id: string; reason?: string }).node_id === leasedNode,
    );
    expect((direct?.payload as { reason?: string } | undefined)?.reason).toBe('lease_held');
  });

  it("does not let a lease-id collision replace or release another actor's lease", async () => {
    // Legacy ids "lease-<node>-<actor>" collide as "lease-x-a-b". Actor ids are Supabase UUIDs in
    // practice, but the object must not rely on that.
    const canvasId = 'canvas-attack-lease-collision';
    const holder = { actor_id: 'a-b', display_name: 'Holder', color: '#3182d4' };
    const attacker = { actor_id: 'b', display_name: 'Attacker', color: '#1f9d63' };
    const a = await openSocket(canvasId, holder);
    const b = await openSocket(canvasId, attacker);
    openSockets.push(a, b);
    await a.waitFor((frame) => frame.type === 'snapshot');
    await b.waitFor((frame) => frame.type === 'snapshot');
    const collidingLegacyId = legacyLeaseIdForActor('x', holder.actor_id);
    expect(collidingLegacyId).toBe(legacyLeaseIdForActor('x-a', attacker.actor_id));
    expect(leaseIdForActor('x', holder.actor_id)).not.toBe(
      leaseIdForActor('x-a', attacker.actor_id),
    );

    // The attacker claims the colliding id first, for its own node, then the holder uses it.
    b.send({
      type: 'lease.acquire',
      payload: { lease_id: collidingLegacyId, node_id: 'x-a', ttl_seconds: 120 },
    });
    await freshSnapshot(b);
    a.send({
      type: 'lease.acquire',
      payload: { lease_id: collidingLegacyId, node_id: 'x', ttl_seconds: 120 },
    });
    await freshSnapshot(a);
    // Releasing by either id reaches only the attacker's own lease.
    b.send({ type: 'lease.release', payload: { lease_id: collidingLegacyId } });
    b.send({ type: 'lease.release', payload: { lease_id: leaseIdForActor('x', holder.actor_id) } });
    const snapshot = await freshSnapshot(b);

    const onX = snapshot.leases.find((lease) => lease.node_id === 'x');
    expect(onX?.holder.actor_id).toBe(holder.actor_id);
    expect(onX?.lease_id).toBe(leaseIdForActor('x', holder.actor_id));
    expect(snapshot.leases.find((lease) => lease.node_id === 'x-a')).toBeUndefined();
    const results = [...a.frames, ...b.frames]
      .filter((frame) => frame.type === 'lease.result')
      .map((frame) => frame.payload);
    expect(results).toEqual(
      expect.arrayContaining([
        {
          accepted: true,
          lease_id: leaseIdForActor('x-a', attacker.actor_id),
          node_id: 'x-a',
          reason: 'ok',
        },
        {
          accepted: true,
          lease_id: leaseIdForActor('x', holder.actor_id),
          node_id: 'x',
          reason: 'ok',
        },
      ]),
    );
  });

  it('keeps the bound identity across hibernation', async () => {
    const canvasId = 'canvas-hibernation';
    const b = await openSocket(canvasId, actorB);
    openSockets.push(b);
    await b.waitFor((frame) => frame.type === 'snapshot');

    const attachment = await runInDurableObject(stub(canvasId), (_instance, state) =>
      state.getWebSockets().map((socket) => socket.deserializeAttachment() as unknown),
    );
    expect(attachment).toHaveLength(1);
    expect(attachment[0]).toMatchObject({
      canvas_id: canvasId,
      actor: { actor_id: actorB.actor_id, display_name: actorB.display_name },
    });

    await evictDurableObject(stub(canvasId), { webSockets: 'hibernate' });

    b.send({ type: 'presence.join', payload: { actor: actorA, surface: 'review' } });
    b.send({
      type: 'comment.upsert',
      payload: { comment_id: 'after-wake', author: actorA, body: 'Sent after hibernation' },
    });
    const snapshot = await freshSnapshot(b);
    expect(snapshot.presence.map((entry) => entry.actor.actor_id)).toEqual([actorB.actor_id]);
    expect(
      snapshot.comments.find((comment) => comment.body === 'Sent after hibernation')?.author,
    ).toMatchObject({ actor_id: actorB.actor_id, display_name: actorB.display_name });
  });
});
