import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS,
  COLLABORATION_TICKET_AUDIENCE,
  COLLABORATION_TICKET_VERSION,
} from '@mustbeviral/collaboration';

import {
  actorA,
  actorB,
  coordinationStub,
  delay,
  freshSnapshot,
  nowSeconds,
  openSocket,
  signRawTicket,
  type TestSocket,
} from './helpers';

const LIFETIME_MS = COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000;
const openSockets: TestSocket[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const socket of openSockets.splice(0)) socket.close();
});

/** A correctly signed ticket issued `ageSeconds` ago that is still inside its signed lifetime. */
async function ticketIssuedAgo(
  canvasId: string,
  actor: typeof actorA | typeof actorB,
  ageSeconds: number,
): Promise<{ ticket: string; iat: number }> {
  const iat = nowSeconds() - ageSeconds;
  const ticket = await signRawTicket({
    v: COLLABORATION_TICKET_VERSION,
    aud: COLLABORATION_TICKET_AUDIENCE,
    canvas_id: canvasId,
    sub: actor.actor_id,
    name: actor.display_name,
    color: actor.color,
    iat,
    exp: iat + 120,
  });
  return { ticket, iat };
}

interface StoredAttachment {
  readonly actor: { actor_id: string };
  readonly ticket_issued_at: number;
  readonly expires_at_ms: number;
}

async function attachments(canvasId: string): Promise<StoredAttachment[]> {
  return runInDurableObject(coordinationStub(canvasId), (_instance, state) =>
    state.getWebSockets().map((socket) => socket.deserializeAttachment() as StoredAttachment),
  );
}

async function scheduledAlarm(canvasId: string): Promise<number | null> {
  return runInDurableObject(coordinationStub(canvasId), (_instance, state) =>
    state.storage.getAlarm(),
  );
}

/** Moves the clock the Worker and its objects read forward, as if `ms` had passed. */
function advanceClock(ms: number): void {
  const realNow = Date.now.bind(Date);
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ms);
}

describe('collaboration socket lifetime', () => {
  it('binds each socket to an expiry derived from its ticket and schedules an alarm for it', async () => {
    const canvasId = 'canvas-lifetime-bound';
    const { ticket, iat } = await ticketIssuedAgo(canvasId, actorA, 100);
    const beforeOpen = Date.now();
    const socket = await openSocket(canvasId, actorA, {}, ticket);
    openSockets.push(socket);
    await socket.waitFor((frame) => frame.type === 'snapshot');

    const [attachment] = await attachments(canvasId);
    expect(attachment?.ticket_issued_at).toBe(iat);
    // Bound to the ticket's issue time, not to when the socket opened.
    expect(attachment?.expires_at_ms).toBe(iat * 1_000 + LIFETIME_MS);
    expect(attachment?.expires_at_ms).toBeLessThan(beforeOpen + LIFETIME_MS - 90_000);
    expect(await scheduledAlarm(canvasId)).toBe(attachment?.expires_at_ms);
  });

  it('closes a socket at its maximum lifetime after hibernation and keeps later sockets open', async () => {
    const canvasId = 'canvas-lifetime-alarm';
    const older = await ticketIssuedAgo(canvasId, actorA, 100);
    const a = await openSocket(canvasId, actorA, {}, older.ticket);
    const b = await openSocket(canvasId, actorB);
    openSockets.push(a, b);
    a.send({ type: 'presence.join', payload: { surface: 'canvas' } });
    b.send({ type: 'presence.join', payload: { surface: 'canvas' } });
    await freshSnapshot(a);
    const joined = await freshSnapshot(b);
    expect(joined.presence).toHaveLength(2);
    const expiryA = (await attachments(canvasId)).find(
      (candidate) => candidate.actor.actor_id === actorA.actor_id,
    )!.expires_at_ms;
    const expiryB = (await attachments(canvasId)).find(
      (candidate) => candidate.actor.actor_id === actorB.actor_id,
    )!.expires_at_ms;
    expect(expiryA).toBeLessThan(expiryB);
    expect(await scheduledAlarm(canvasId)).toBe(expiryA);

    await evictDurableObject(coordinationStub(canvasId), { webSockets: 'hibernate' });
    advanceClock(expiryA - Date.now() + 1_000);
    expect(await runDurableObjectAlarm(coordinationStub(canvasId))).toBe(true);

    expect(await a.waitForClose()).toMatchObject({
      code: COLLABORATION_CLOSE_CODES.SESSION_EXPIRED,
    });
    await delay(150);
    expect(b.closed).toBeNull();
    const afterExpiry = await freshSnapshot(b);
    expect(afterExpiry.presence.some((entry) => entry.actor.actor_id === actorA.actor_id)).toBe(
      false,
    );
    // The next alarm ends the remaining socket.
    expect(await scheduledAlarm(canvasId)).toBe(expiryB);
  });

  it('closes an expired socket on its next message without acting on it', async () => {
    const canvasId = 'canvas-lifetime-message';
    const a = await openSocket(canvasId, actorA);
    openSockets.push(a);
    await a.waitFor((frame) => frame.type === 'snapshot');

    advanceClock(LIFETIME_MS + 1_000);
    a.send({ type: 'comment.create', payload: { body: 'Sent after the lifetime ended' } });
    expect(await a.waitForClose()).toMatchObject({
      code: COLLABORATION_CLOSE_CODES.SESSION_EXPIRED,
    });
    vi.restoreAllMocks();

    const comments = await runInDurableObject(coordinationStub(canvasId), (_instance, state) =>
      state.storage.sql.exec<{ payload: string }>('SELECT payload FROM comments').toArray(),
    );
    expect(comments).toHaveLength(0);
    expect(a.frames.some((frame) => frame.type === 'comment.result')).toBe(false);
  });
});
