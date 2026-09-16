import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_PRESENCE_MAX_PER_CANVAS,
  COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS,
  COLLABORATION_TICKET_AUDIENCE,
  COLLABORATION_TICKET_VERSION,
  PresenceEntrySchema,
  collaborationActorColor,
  type CollaborationActor,
  type PresenceEntry,
} from '@mustbeviral/collaboration';

import { CoordinationStore, PRESENCE_LAST_SEEN_REFRESH_MS } from '../src/coordination-store';
import {
  actorA,
  actorB,
  coordinationStub,
  delay,
  errorFrames,
  freshSnapshot,
  nowSeconds,
  openSocket,
  settle,
  signRawTicket,
  type ServerFrame,
  type TestSocket,
} from './helpers';

/**
 * Presence regression: before this fix, the only thing that wrote a presence row's `last_seen_at` was
 * a `presence.join`, which the client sends once per socket, and every snapshot deleted rows older
 * than 60 seconds. A member who stayed connected, and quiet, vanished for everyone a minute after
 * joining. Presence is now bound to the member's open, identity-bound sockets.
 */
const OLD_PRESENCE_TTL_MS = 60_000;
const LIFETIME_MS = COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000;
const realNow = Date.now.bind(Date);
const openSockets: TestSocket[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const socket of openSockets.splice(0)) socket.close();
});

/** Moves the clock the Worker and its objects read to `ms` after real time. Calls do not stack. */
function clockAhead(ms: number): void {
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ms);
}

type Actor = Readonly<{ actor_id: string; display_name: string; color: string }>;

function member(index: number): Actor {
  const actorId = `presence-member-${String(index)}`;
  return {
    actor_id: actorId,
    display_name: `Member ${String(index)}`,
    color: collaborationActorColor(actorId),
  };
}

async function open(canvasId: string, actor: Actor, ticket?: string): Promise<TestSocket> {
  const socket = await openSocket(canvasId, actor, {}, ticket);
  openSockets.push(socket);
  await socket.waitFor((frame) => frame.type === 'snapshot');
  return socket;
}

function join(surface: 'canvas' | 'review'): unknown {
  return { type: 'presence.join', payload: { surface } };
}

async function presence(socket: TestSocket): Promise<PresenceEntry[]> {
  const snapshot = await freshSnapshot(socket);
  return snapshot.presence.map((entry) => PresenceEntrySchema.parse(entry));
}

async function presentIds(socket: TestSocket): Promise<string[]> {
  return (await presence(socket)).map((entry) => entry.actor.actor_id).sort();
}

function snapshotPresence(frame: ServerFrame): string[] {
  return (frame.payload as { presence: { actor: { actor_id: string } }[] }).presence
    .map((entry) => entry.actor.actor_id)
    .sort();
}

/** A correctly signed ticket issued `ageSeconds` ago, still inside its signed lifetime. */
async function ticketIssuedAgo(canvasId: string, actor: Actor, ageSeconds: number) {
  const iat = nowSeconds() - ageSeconds;
  return signRawTicket({
    v: COLLABORATION_TICKET_VERSION,
    aud: COLLABORATION_TICKET_AUDIENCE,
    canvas_id: canvasId,
    sub: actor.actor_id,
    name: actor.display_name,
    color: actor.color,
    iat,
    exp: iat + 120,
  });
}

const bothIds = [actorA.actor_id, actorB.actor_id].sort();

describe('presence bound to open, identity-bound sockets', () => {
  it('keeps a quiet connected member present past the old 60-second sweep and across hibernation', async () => {
    const canvasId = 'canvas-presence-persists';
    const a = await open(canvasId, actorA);
    const b = await open(canvasId, actorB);
    a.send(join('canvas'));
    b.send(join('review'));
    await freshSnapshot(a);
    const joined = await presence(b);
    expect(joined.map((entry) => entry.actor.actor_id).sort()).toEqual(bothIds);
    const joinedAtA = joined.find((entry) => entry.actor.actor_id === actorA.actor_id)!.joined_at;

    // A sends nothing more: no heartbeat, so no rate-limit tokens. Five minutes pass (well inside
    // the 600-second socket lifetime) and the object hibernates, losing all in-memory state.
    clockAhead(5 * OLD_PRESENCE_TTL_MS);
    await evictDurableObject(coordinationStub(canvasId), { webSockets: 'hibernate' });

    const later = await presence(b);
    expect(later.map((entry) => entry.actor.actor_id).sort()).toEqual(bothIds);
    const entryA = later.find((entry) => entry.actor.actor_id === actorA.actor_id)!;
    expect(entryA.surface).toBe('canvas');
    expect(entryA.joined_at).toBe(joinedAtA);
    // A served row's last_seen_at stays recent, as it was when rows older than 60 s were dropped.
    expect(Date.now() - Date.parse(entryA.last_seen_at)).toBeLessThanOrEqual(
      PRESENCE_LAST_SEEN_REFRESH_MS,
    );
    expect(a.closed).toBeNull();
  });

  it('removes a member and broadcasts it as soon as their last socket closes', async () => {
    const canvasId = 'canvas-presence-last-close';
    const a = await open(canvasId, actorA);
    const b = await open(canvasId, actorB);
    a.send(join('canvas'));
    b.send(join('canvas'));
    await freshSnapshot(a);
    await freshSnapshot(b);

    clockAhead(2 * OLD_PRESENCE_TTL_MS);
    expect(await presentIds(b)).toEqual(bothIds);

    const before = b.frames.length;
    a.close();
    // B asks for nothing: the close itself is broadcast.
    const broadcast = await b.waitFor(
      (frame) =>
        b.frames.indexOf(frame) >= before &&
        frame.type === 'snapshot' &&
        !snapshotPresence(frame).includes(actorA.actor_id),
      1_000,
    );
    expect(snapshotPresence(broadcast)).toEqual([actorB.actor_id]);
  });

  it('keeps a member with two sockets present until both are gone', async () => {
    const canvasId = 'canvas-presence-two-sockets';
    const a1 = await open(canvasId, actorA);
    const a2 = await open(canvasId, actorA);
    const b = await open(canvasId, actorB);
    a1.send(join('canvas'));
    a2.send(join('canvas'));
    b.send(join('canvas'));
    await freshSnapshot(a1);
    await freshSnapshot(a2);
    await freshSnapshot(b);

    clockAhead(2 * OLD_PRESENCE_TTL_MS);
    expect(await presentIds(b)).toEqual(bothIds);

    a1.close();
    await settle(150);
    expect(await presentIds(b)).toEqual(bothIds);

    clockAhead(4 * OLD_PRESENCE_TTL_MS);
    await evictDurableObject(coordinationStub(canvasId), { webSockets: 'hibernate' });
    expect(await presentIds(b)).toEqual(bothIds);

    a2.close();
    await settle(150);
    expect(await presentIds(b)).toEqual([actorB.actor_id]);
  });

  it('drops a member whose socket passed its lifetime, before and after the 4401 close', async () => {
    const canvasId = 'canvas-presence-expiry';
    const a = await open(canvasId, actorA, await ticketIssuedAgo(canvasId, actorA, 100));
    const b = await open(canvasId, actorB);
    a.send(join('canvas'));
    b.send(join('canvas'));
    await freshSnapshot(a);
    expect(await presentIds(b)).toEqual(bothIds);

    // A's socket is past its lifetime; B's is not. The alarm has not run yet.
    clockAhead(LIFETIME_MS - 100_000 + 1_000);
    expect(await presentIds(b)).toEqual([actorB.actor_id]);
    expect(a.closed).toBeNull();

    await evictDurableObject(coordinationStub(canvasId), { webSockets: 'hibernate' });
    expect(await runDurableObjectAlarm(coordinationStub(canvasId))).toBe(true);
    expect(await a.waitForClose()).toMatchObject({
      code: COLLABORATION_CLOSE_CODES.SESSION_EXPIRED,
    });
    await delay(150);
    expect(b.closed).toBeNull();
    expect(await presentIds(b)).toEqual([actorB.actor_id]);
  });

  it('never lets an open socket alone make a member present past the member cap', async () => {
    const canvasId = 'canvas-presence-cap';
    const members: TestSocket[] = [];
    for (let index = 0; index < COLLABORATION_PRESENCE_MAX_PER_CANVAS; index += 1) {
      const socket = await open(canvasId, member(index));
      socket.send(join('canvas'));
      await freshSnapshot(socket);
      members.push(socket);
    }
    const observer = members[0]!;
    expect(await presentIds(observer)).toHaveLength(COLLABORATION_PRESENCE_MAX_PER_CANVAS);

    const a = await open(canvasId, actorA);
    a.send(join('canvas'));
    await a.waitFor((frame) => frame.type === 'error');
    expect(errorFrames(a, 'CANVAS_LIMIT_REACHED')[0]?.details).toMatchObject({
      resource: 'presence',
      scope: 'canvas',
    });

    clockAhead(2 * OLD_PRESENCE_TTL_MS);
    const full = await presentIds(observer);
    expect(full).toHaveLength(COLLABORATION_PRESENCE_MAX_PER_CANVAS);
    expect(full).not.toContain(actorA.actor_id);

    // A slot frees up. A's open socket does not claim it; only A's own join does.
    members[1]!.close();
    await settle(150);
    const freed = await presentIds(observer);
    expect(freed).toHaveLength(COLLABORATION_PRESENCE_MAX_PER_CANVAS - 1);
    expect(freed).not.toContain(actorA.actor_id);

    a.send(join('canvas'));
    await freshSnapshot(a);
    expect(await presentIds(observer)).toContain(actorA.actor_id);
  });

  it("does not let another member's messages keep a departed member present", async () => {
    const canvasId = 'canvas-presence-spoof';
    const a = await open(canvasId, actorA);
    const b = await open(canvasId, actorB);
    a.send(join('canvas'));
    b.send(join('review'));
    await freshSnapshot(a);
    await freshSnapshot(b);

    clockAhead(2 * OLD_PRESENCE_TTL_MS);
    expect(await presentIds(b)).toEqual(bothIds);

    a.close();
    await settle(150);
    // B claims to be A, as a forged heartbeat would. The object acts only as the bound actor B.
    for (let index = 0; index < 3; index += 1) {
      b.send({ type: 'presence.join', payload: { actor: actorA, surface: 'canvas' } });
    }
    const entries = await presence(b);
    expect(entries.map((entry) => entry.actor.actor_id)).toEqual([actorB.actor_id]);
    expect(entries[0]?.actor.display_name).toBe(actorB.display_name);
  });

  it('drops rows left by an earlier object instance, before serving them or counting the cap', async () => {
    const canvasId = 'canvas-presence-orphans';
    const a = await open(canvasId, actorA);
    const b = await open(canvasId, actorB);
    b.send(join('canvas'));
    await freshSnapshot(b);

    // Rows whose sockets are gone, as after a restart that ran no close handler. With B's row they
    // fill the canvas to its member cap.
    const leaveOrphans = (includeA: boolean) =>
      runInDurableObject(coordinationStub(canvasId), (_instance, state) => {
        const store = new CoordinationStore(state.storage.sql);
        if (includeA) store.joinPresence(canvasId, actorA, 'review');
        const count = COLLABORATION_PRESENCE_MAX_PER_CANVAS - (includeA ? 2 : 1);
        for (let index = 0; index < count; index += 1) {
          store.joinPresence(canvasId, member(index), 'canvas');
        }
      });
    // One orphan is for A, whose socket is open but has not joined.
    await leaveOrphans(true);
    expect(await presentIds(b)).toEqual([actorB.actor_id]);

    // At the cap again when A joins: the orphans must not count against it.
    await leaveOrphans(false);
    a.send(join('canvas'));
    await freshSnapshot(a);
    expect(errorFrames(a, 'CANVAS_LIMIT_REACHED')).toHaveLength(0);
    expect(await presentIds(b)).toEqual(bothIds);
  });
});

describe('CoordinationStore.reconcilePresence', () => {
  async function withStore<T>(
    canvasId: string,
    run: (store: CoordinationStore, state: DurableObjectState) => T | Promise<T>,
  ): Promise<T> {
    return runInDurableObject(coordinationStub(canvasId), (_instance, state) =>
      run(new CoordinationStore(state.storage.sql), state),
    );
  }

  const actor1: CollaborationActor = { actor_id: 'store-actor-1', display_name: 'One' };
  const actor2: CollaborationActor = { actor_id: 'store-actor-2', display_name: 'Two' };
  const actor3: CollaborationActor = { actor_id: 'store-actor-3', display_name: 'Three' };

  it('keeps live members, refreshes a stale last_seen_at at most once per interval and never inserts', async () => {
    const canvasId = 'canvas-reconcile-store';
    await withStore(canvasId, (store) => {
      store.joinPresence(canvasId, actor1, 'canvas');
      store.joinPresence(canvasId, actor2, 'review');
      const joinedAt = store.getSnapshot(canvasId).presence[0]!.joined_at;

      const refreshAtMs = Date.parse(joinedAt) + 2 * OLD_PRESENCE_TTL_MS;
      const live = new Set([actor1.actor_id, actor3.actor_id]);
      store.reconcilePresence(canvasId, live, refreshAtMs);
      const refreshed = store.getSnapshot(canvasId).presence;
      expect(refreshed.map((entry) => entry.actor.actor_id)).toEqual([actor1.actor_id]);
      expect(refreshed[0]).toMatchObject({
        joined_at: joinedAt,
        last_seen_at: new Date(refreshAtMs).toISOString(),
        surface: 'canvas',
      });

      store.reconcilePresence(canvasId, live, refreshAtMs + PRESENCE_LAST_SEEN_REFRESH_MS - 1);
      expect(store.getSnapshot(canvasId).presence[0]?.last_seen_at).toBe(
        new Date(refreshAtMs).toISOString(),
      );
    });
  });

  it('does not refresh rows in a section that is already past its cap', async () => {
    const canvasId = 'canvas-reconcile-over-cap';
    await withStore(canvasId, (store, state) => {
      store.ensureCanvasId(canvasId);
      const stale = new Date(Date.now() - 2 * OLD_PRESENCE_TTL_MS).toISOString();
      const live = new Set<string>();
      for (let index = 0; index <= COLLABORATION_PRESENCE_MAX_PER_CANVAS; index += 1) {
        const actor = member(index);
        live.add(actor.actor_id);
        const entry = { actor, joined_at: stale, last_seen_at: stale, surface: 'canvas' };
        state.storage.sql.exec(
          'INSERT INTO presence (actor_id, payload) VALUES (?, ?)',
          actor.actor_id,
          JSON.stringify(entry),
        );
      }
      store.reconcilePresence(canvasId, live, Date.now());
      const rows = store.getSnapshot(canvasId).presence;
      expect(rows).toHaveLength(COLLABORATION_PRESENCE_MAX_PER_CANVAS + 1);
      expect(rows.every((entry) => entry.last_seen_at === stale)).toBe(true);
    });
  });
});
