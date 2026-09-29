import { SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import {
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_SOCKETS_MAX_PER_ACTOR,
} from '@mustbeviral/collaboration';

import {
  ABUSE_STRIKE_LIMIT,
  ACTOR_MESSAGE_BUCKET,
  CanvasRateLimiter,
  SNAPSHOT_TOKEN_COST,
  SOCKET_MESSAGE_BUCKET,
} from '../src/rate-limit';
import {
  actorA,
  actorB,
  delay,
  errorFrames,
  freshSnapshot,
  openSocket,
  protocolHeader,
  snapshotRequest,
  socketRequest,
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

function leaseResults(socket: TestSocket): number {
  return socket.frames.filter((frame) => frame.type === 'lease.result').length;
}

function acquire(socket: TestSocket, count: number, node = 'node-rate'): void {
  for (let index = 0; index < count; index += 1) {
    socket.send({ type: 'lease.acquire', payload: { node_id: node, ttl_seconds: 120 } });
  }
}

/** Waits until that many lease acquisitions were answered, by a result or a refusal. */
async function settleResponses(socket: TestSocket, expected: number): Promise<void> {
  const answered = () => leaseResults(socket) + errorFrames(socket, 'RATE_LIMITED').length;
  const deadline = Date.now() + 3_000;
  while (answered() < expected && socket.closed === null && Date.now() < deadline) {
    await delay(10);
  }
  await delay(50);
}

describe('CanvasRateLimiter', () => {
  it('spends from socket and actor buckets, refills over time and flags sustained abuse', () => {
    let now = 1_000_000;
    const limiter = new CanvasRateLimiter(() => now);
    for (let index = 0; index < SOCKET_MESSAGE_BUCKET.capacity; index += 1) {
      expect(limiter.consume('socket-1', 'actor-1').allowed).toBe(true);
    }
    const refused = limiter.consume('socket-1', 'actor-1');
    expect(refused).toMatchObject({ allowed: false, scope: 'socket', abusive: false });
    expect(refused.allowed ? 0 : refused.retryAfterMs).toBe(100);

    now += 1_000;
    for (let index = 0; index < SOCKET_MESSAGE_BUCKET.refillPerSecond; index += 1) {
      expect(limiter.consume('socket-1', 'actor-1').allowed).toBe(true);
    }
    expect(limiter.consume('socket-1', 'actor-1').allowed).toBe(false);

    // The actor bucket is shared by the actor's sockets.
    let actorRefusal: ReturnType<CanvasRateLimiter['consume']> | undefined;
    for (let socket = 2; socket <= 4 && actorRefusal === undefined; socket += 1) {
      for (let index = 0; index < SOCKET_MESSAGE_BUCKET.capacity; index += 1) {
        const decision = limiter.consume(`socket-${String(socket)}`, 'actor-1');
        if (!decision.allowed) {
          actorRefusal = decision;
          break;
        }
      }
    }
    expect(actorRefusal).toMatchObject({ allowed: false, scope: 'actor' });
    expect(limiter.consume('socket-9', 'actor-2').allowed).toBe(true);

    // Refusals accumulate strikes faster than they drain; the limit flags the socket.
    now += 60_000;
    const flood = new CanvasRateLimiter(() => now);
    let abusiveAfter = 0;
    for (let index = 0; index < 200; index += 1) {
      const decision = flood.consume('flood', 'flooder');
      if (!decision.allowed && decision.abusive) {
        abusiveAfter = index + 1;
        break;
      }
    }
    expect(abusiveAfter).toBe(SOCKET_MESSAGE_BUCKET.capacity + ABUSE_STRIKE_LIMIT + 1);
    // Strikes drain: a client that backs off is not closed for old refusals.
    const polite = new CanvasRateLimiter(() => now);
    for (let index = 0; index < SOCKET_MESSAGE_BUCKET.capacity + ABUSE_STRIKE_LIMIT; index += 1) {
      polite.consume('polite', 'polite-actor');
    }
    now += 30_000;
    const later = polite.consume('polite', 'polite-actor');
    expect(later.allowed).toBe(true);
    expect(ACTOR_MESSAGE_BUCKET.capacity).toBeGreaterThan(SOCKET_MESSAGE_BUCKET.capacity);
  });
});

describe('collaboration message rate limits', () => {
  it('refuses messages past the socket budget with RATE_LIMITED and recovers', async () => {
    const socket = await open('canvas-rate-socket');
    acquire(socket, 40);
    await settleResponses(socket, 40);

    const limited = errorFrames(socket, 'RATE_LIMITED');
    expect(limited.length).toBeGreaterThanOrEqual(5);
    expect(limited[0]?.details).toMatchObject({ scope: 'socket' });
    expect(Number(limited[0]?.details?.retry_after_ms)).toBeGreaterThan(0);
    expect(leaseResults(socket)).toBeLessThanOrEqual(35);
    expect(socket.closed).toBeNull();

    await delay(1_500);
    const errorsBefore = errorFrames(socket, 'RATE_LIMITED').length;
    const resultsBefore = leaseResults(socket);
    acquire(socket, 5);
    await settleResponses(socket, resultsBefore + errorsBefore + 5);
    expect(leaseResults(socket)).toBe(resultsBefore + 5);
    expect(errorFrames(socket, 'RATE_LIMITED')).toHaveLength(errorsBefore);
  });

  it("limits an actor's messages across all of its sockets", async () => {
    const canvasId = 'canvas-rate-actor';
    const sockets = [await open(canvasId), await open(canvasId), await open(canvasId)];
    // Interleaved, so refusals spread across the sockets instead of piling onto the last one.
    for (let index = 0; index < 25; index += 1) {
      for (const socket of sockets) acquire(socket, 1);
    }
    for (const socket of sockets) await settleResponses(socket, 25);

    const actorScoped = sockets.flatMap((socket) =>
      errorFrames(socket, 'RATE_LIMITED').filter((error) => error.details?.scope === 'actor'),
    );
    expect(actorScoped.length).toBeGreaterThan(0);
    // No single socket exceeded its own budget, so every refusal was the shared actor budget.
    expect(
      sockets.flatMap((socket) =>
        errorFrames(socket, 'RATE_LIMITED').filter((error) => error.details?.scope === 'socket'),
      ),
    ).toEqual([]);
    // Another actor on the same canvas is unaffected.
    const other = await open(canvasId, actorB);
    acquire(other, 3, 'node-other');
    await settleResponses(other, 3);
    expect(errorFrames(other, 'RATE_LIMITED')).toEqual([]);
  });

  it('closes a socket that keeps sending after refusals, and only that socket', async () => {
    const canvasId = 'canvas-rate-abuse';
    const abusive = await open(canvasId);
    const bystander = await open(canvasId, actorB);
    acquire(abusive, 150);
    expect(await abusive.waitForClose()).toMatchObject({
      code: COLLABORATION_CLOSE_CODES.POLICY_VIOLATION,
    });
    const processed = leaseResults(abusive);
    expect(processed).toBeLessThanOrEqual(SOCKET_MESSAGE_BUCKET.capacity + 5);
    expect(errorFrames(abusive, 'RATE_LIMITED').length).toBeLessThanOrEqual(ABUSE_STRIKE_LIMIT);

    await delay(100);
    expect(bystander.closed).toBeNull();
    const snapshot = await freshSnapshot(bystander);
    expect(snapshot.canvas_id).toBe(canvasId);
  });

  it('bounds open sockets per actor and snapshot reads per actor', async () => {
    const canvasId = 'canvas-rate-sockets';
    for (let index = 0; index < COLLABORATION_SOCKETS_MAX_PER_ACTOR; index += 1) {
      await open(canvasId);
    }
    const refused = await SELF.fetch(
      socketRequest(canvasId, protocolHeader(await ticketFor(canvasId, actorA))),
    );
    expect(refused.status).toBe(429);
    expect(refused.webSocket).toBeNull();
    expect(await refused.json()).toMatchObject({
      error: {
        code: 'CANVAS_LIMIT_REACHED',
        details: {
          resource: 'sockets',
          scope: 'actor',
          limit: COLLABORATION_SOCKETS_MAX_PER_ACTOR,
        },
      },
    });
    // Another member can still connect.
    await open(canvasId, actorB);

    const readsCanvas = 'canvas-rate-snapshot-reads';
    const ticket = await ticketFor(readsCanvas, actorA);
    const statuses: number[] = [];
    const reads = Math.floor(ACTOR_MESSAGE_BUCKET.capacity / SNAPSHOT_TOKEN_COST) + 4;
    for (let index = 0; index < reads; index += 1) {
      const response = await SELF.fetch(
        snapshotRequest(readsCanvas, { Authorization: `Bearer ${ticket}` }),
      );
      statuses.push(response.status);
      if (response.status === 429) {
        expect(response.headers.get('Retry-After')).toMatch(/^\d+$/u);
        expect(await response.json()).toMatchObject({
          error: { code: 'RATE_LIMITED', details: { scope: 'actor' } },
        });
      } else {
        await response.body?.cancel();
      }
    }
    expect(statuses.slice(0, ACTOR_MESSAGE_BUCKET.capacity / SNAPSHOT_TOKEN_COST)).toEqual(
      Array.from({ length: ACTOR_MESSAGE_BUCKET.capacity / SNAPSHOT_TOKEN_COST }, () => 200),
    );
    expect(statuses).toContain(429);
  });

  it('coalesces snapshot broadcasts under a burst of changes', async () => {
    const canvasId = 'canvas-rate-broadcast';
    const sender = await open(canvasId);
    const observer = await open(canvasId, actorB);
    const before = observer.frames.filter((frame) => frame.type === 'snapshot').length;
    for (let index = 0; index < 20; index += 1) {
      sender.send({
        type: 'presence.join',
        payload: { surface: index % 2 === 0 ? 'canvas' : 'review' },
      });
    }
    await delay(600);
    const broadcasts = observer.frames.filter((frame) => frame.type === 'snapshot').length - before;
    expect(broadcasts).toBeGreaterThan(0);
    expect(broadcasts).toBeLessThan(10);
    const latest = observer.frames.filter((frame) => frame.type === 'snapshot').at(-1)?.payload as {
      presence: { actor: { actor_id: string }; surface: string }[];
    };
    expect(latest.presence.find((entry) => entry.actor.actor_id === actorA.actor_id)?.surface).toBe(
      'review',
    );
  });
});
