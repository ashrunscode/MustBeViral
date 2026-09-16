import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import {
  COLLABORATION_TICKET_AUDIENCE,
  COLLABORATION_TICKET_VERSION,
  COLLABORATION_WEBSOCKET_PROTOCOL,
} from '@mustbeviral/collaboration';

import worker from '../src/index';
import {
  actorA,
  actorB,
  freshSnapshot,
  nowSeconds,
  openSocket,
  protocolHeader,
  signRawTicket,
  snapshotRequest,
  socketRequest,
  ticketFor,
  type TestSocket,
} from './helpers';

const INTERNAL_IDENTITY_HEADER = 'x-mbv-collaboration-identity';

const openSockets: TestSocket[] = [];

afterEach(() => {
  for (const socket of openSockets.splice(0)) socket.close();
});

async function expectRejected(response: Response, status: number): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.webSocket).toBeNull();
  const body = (await response.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBeTypeOf('string');
}

function forgedIdentityHeader(canvasId: string): string {
  const json = JSON.stringify({ canvas_id: canvasId, actor: actorA });
  return btoa(json).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

describe('collaboration ticket boundary', () => {
  it('keeps /health open without a ticket', async () => {
    const response = await SELF.fetch('https://collaboration.test/health');
    expect(response.status).toBe(200);
  });

  it('rejects a snapshot read without a ticket', async () => {
    await expectRejected(await SELF.fetch(snapshotRequest('canvas-no-ticket')), 401);
  });

  it('rejects a WebSocket upgrade without a ticket', async () => {
    await expectRejected(await SELF.fetch(socketRequest('canvas-no-ticket')), 401);
  });

  it('does not accept a ticket from the query string', async () => {
    const ticket = await ticketFor('canvas-query-ticket', actorA);
    await expectRejected(
      await SELF.fetch(socketRequest('canvas-query-ticket', {}, `?ticket=${ticket}`)),
      401,
    );
    await expectRejected(
      await SELF.fetch(
        new Request(
          `https://collaboration.test/canvases/canvas-query-ticket/snapshot?ticket=${ticket}`,
        ),
      ),
      401,
    );
  });

  it('rejects the ticket as a bare subprotocol without the protocol name', async () => {
    const ticket = await ticketFor('canvas-bare-protocol', actorA);
    await expectRejected(
      await SELF.fetch(socketRequest('canvas-bare-protocol', { 'Sec-WebSocket-Protocol': ticket })),
      401,
    );
  });

  it('accepts a valid ticket, echoes only the protocol name, and serves the bound canvas', async () => {
    const ticket = await ticketFor('canvas-valid', actorA);
    const snapshot = await SELF.fetch(
      snapshotRequest('canvas-valid', { Authorization: `Bearer ${ticket}` }),
    );
    expect(snapshot.status).toBe(200);
    const body = (await snapshot.json()) as { data: { canvas_id: string } };
    expect(body.data.canvas_id).toBe('canvas-valid');

    const socket = await openSocket('canvas-valid', actorA);
    openSockets.push(socket);
    expect(socket.response.headers.get('Sec-WebSocket-Protocol')).toBe(
      COLLABORATION_WEBSOCKET_PROTOCOL,
    );
    await socket.waitFor((frame) => frame.type === 'snapshot');
  });

  it('routes each canvas to an isolated coordination object via authenticated snapshot reads', async () => {
    const first = await SELF.fetch(
      snapshotRequest('canvas-a', {
        Authorization: `Bearer ${await ticketFor('canvas-a', actorA)}`,
      }),
    );
    const second = await SELF.fetch(
      snapshotRequest('canvas-b', {
        Authorization: `Bearer ${await ticketFor('canvas-b', actorA)}`,
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(((await first.json()) as { data: { canvas_id: string } }).data.canvas_id).toBe(
      'canvas-a',
    );
    expect(((await second.json()) as { data: { canvas_id: string } }).data.canvas_id).toBe(
      'canvas-b',
    );
  });

  it('never turns an authenticated snapshot read into a socket upgrade', async () => {
    const ticket = await ticketFor('canvas-snapshot-upgrade', actorA);
    const response = await SELF.fetch(
      new Request('https://collaboration.test/canvases/canvas-snapshot-upgrade/snapshot', {
        headers: { Authorization: `Bearer ${ticket}`, Upgrade: 'websocket' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.webSocket).toBeNull();
  });

  it('rejects a ticket with a bad signature', async () => {
    const ticket = await ticketFor('canvas-bad-signature', actorA);
    const [payload, signature] = ticket.split('.') as [string, string];
    const flipped = `${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    const otherSecret = await ticketFor('canvas-bad-signature', actorA, {
      secret: 'a-different-secret-that-is-at-least-32-bytes',
    });
    for (const forged of [flipped, otherSecret, `${payload}.`, payload]) {
      await expectRejected(
        await SELF.fetch(
          snapshotRequest('canvas-bad-signature', { Authorization: `Bearer ${forged}` }),
        ),
        401,
      );
      await expectRejected(
        await SELF.fetch(socketRequest('canvas-bad-signature', protocolHeader(forged))),
        401,
      );
    }
  });

  it('rejects an expired ticket', async () => {
    const issued = nowSeconds() - 600;
    const ticket = await ticketFor('canvas-expired', actorA, { nowEpochSeconds: issued });
    await expectRejected(
      await SELF.fetch(snapshotRequest('canvas-expired', { Authorization: `Bearer ${ticket}` })),
      401,
    );
    await expectRejected(
      await SELF.fetch(socketRequest('canvas-expired', protocolHeader(ticket))),
      401,
    );
  });

  it('rejects a correctly signed ticket with the wrong audience, version or lifetime', async () => {
    const iat = nowSeconds();
    const base = {
      v: COLLABORATION_TICKET_VERSION,
      aud: COLLABORATION_TICKET_AUDIENCE,
      canvas_id: 'canvas-claims',
      sub: actorA.actor_id,
      name: actorA.display_name,
      color: actorA.color,
      iat,
      exp: iat + 60,
    };
    const forgedTickets = [
      await signRawTicket({ ...base, aud: 'core' }),
      await signRawTicket({ ...base, v: 2 }),
      await signRawTicket({ ...base, exp: iat + 3_600 }),
    ];
    for (const forged of forgedTickets) {
      await expectRejected(
        await SELF.fetch(snapshotRequest('canvas-claims', { Authorization: `Bearer ${forged}` })),
        401,
      );
      await expectRejected(
        await SELF.fetch(socketRequest('canvas-claims', protocolHeader(forged))),
        401,
      );
    }
    // Control: the same signer with correct claims is accepted, so the rejections above are the
    // claim checks and not a signing mismatch in this test.
    const control = await signRawTicket(base);
    const accepted = await SELF.fetch(
      snapshotRequest('canvas-claims', { Authorization: `Bearer ${control}` }),
    );
    expect(accepted.status).toBe(200);
  });

  it('rejects a ticket minted for another canvas', async () => {
    const ticket = await ticketFor('canvas-other', actorA);
    await expectRejected(
      await SELF.fetch(snapshotRequest('canvas-target', { Authorization: `Bearer ${ticket}` })),
      401,
    );
    await expectRejected(
      await SELF.fetch(socketRequest('canvas-target', protocolHeader(ticket))),
      401,
    );
  });

  it('fails closed when the ticket secret is missing or empty', async () => {
    const ticket = await ticketFor('canvas-unconfigured', actorA);
    for (const secret of [undefined, '']) {
      const unconfigured = { ...env, COLLABORATION_TICKET_SECRET: secret } as CollaborationBindings;
      const snapshot = await worker.fetch(
        snapshotRequest('canvas-unconfigured', { Authorization: `Bearer ${ticket}` }),
        unconfigured,
      );
      await expectRejected(snapshot, 503);
      const socket = await worker.fetch(
        socketRequest('canvas-unconfigured', protocolHeader(ticket)),
        unconfigured,
      );
      await expectRejected(socket, 503);
      const unsigned = await worker.fetch(snapshotRequest('canvas-unconfigured'), unconfigured);
      await expectRejected(unsigned, 503);
      const health = await worker.fetch(
        new Request('https://collaboration.test/health'),
        unconfigured,
      );
      expect(health.status).toBe(200);
    }
  });

  it('ignores a client-sent internal identity header', async () => {
    const canvasId = 'canvas-forged-header';
    await expectRejected(
      await SELF.fetch(
        snapshotRequest(canvasId, { [INTERNAL_IDENTITY_HEADER]: forgedIdentityHeader(canvasId) }),
      ),
      401,
    );
    await expectRejected(
      await SELF.fetch(
        socketRequest(canvasId, { [INTERNAL_IDENTITY_HEADER]: forgedIdentityHeader(canvasId) }),
      ),
      401,
    );

    const socket = await openSocket(canvasId, actorB, {
      [INTERNAL_IDENTITY_HEADER]: forgedIdentityHeader(canvasId),
    });
    openSockets.push(socket);
    socket.send({ type: 'presence.join', payload: { actor: actorA, surface: 'canvas' } });
    const snapshot = await freshSnapshot(socket);
    expect(snapshot.presence.map((entry) => entry.actor.actor_id)).toEqual([actorB.actor_id]);
    expect(snapshot.presence[0]?.actor.display_name).toBe(actorB.display_name);
  });
});
