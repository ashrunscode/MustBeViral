import { describe, expect, it } from 'vitest';

import {
  COLLABORATION_TICKET_MAX_TTL_SECONDS,
  COLLABORATION_TICKET_TTL_SECONDS,
  COLLABORATION_WEBSOCKET_PROTOCOL,
  CollaborationTicketSigningUnavailableError,
  collaborationActorColor,
  collaborationFallbackDisplayName,
  collaborationTicketFromAuthorization,
  collaborationTicketFromWebSocketProtocols,
  mintCollaborationTicket,
  verifyCollaborationTicket,
} from './ticket';

const SECRET = 'unit-test-collaboration-ticket-secret-000000';
const NOW = 1_800_000_000;
const actor = {
  actor_id: '9f2c1d7e-5b8a-4c3f-9e21-7a6b5c4d3e2f',
  display_name: 'Collaborator 1A2B',
  color: '#3182d4',
};

function base64Url(text: string): string {
  return btoa(text).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

async function sign(payloadText: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadText)),
  );
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return `${base64Url(payloadText)}.${btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')}`;
}

describe('collaboration tickets', () => {
  it('round-trips a minted ticket into the bound actor', async () => {
    const { ticket, claims } = await mintCollaborationTicket(SECRET, {
      canvasId: 'canvas-1',
      actor,
      nowEpochSeconds: NOW,
    });
    expect(claims.exp - claims.iat).toBe(COLLABORATION_TICKET_TTL_SECONDS);
    expect(COLLABORATION_TICKET_TTL_SECONDS).toBeLessThanOrEqual(120);
    const payload = JSON.parse(atob(ticket.split('.')[0]!.replace(/-/gu, '+').replace(/_/gu, '/')));
    expect(Object.keys(payload)).toEqual([
      'v',
      'aud',
      'canvas_id',
      'sub',
      'name',
      'color',
      'iat',
      'exp',
    ]);
    await expect(
      verifyCollaborationTicket(SECRET, ticket, { canvasId: 'canvas-1', nowEpochSeconds: NOW + 5 }),
    ).resolves.toEqual({ valid: true, claims, actor });
  });

  it('fails closed without a usable secret on both sides', async () => {
    for (const secret of [undefined, '', 'too-short']) {
      await expect(
        mintCollaborationTicket(secret, { canvasId: 'canvas-1', actor, nowEpochSeconds: NOW }),
      ).rejects.toBeInstanceOf(CollaborationTicketSigningUnavailableError);
    }
    const { ticket } = await mintCollaborationTicket(SECRET, {
      canvasId: 'canvas-1',
      actor,
      nowEpochSeconds: NOW,
    });
    for (const secret of [undefined, '']) {
      await expect(
        verifyCollaborationTicket(secret, ticket, { canvasId: 'canvas-1', nowEpochSeconds: NOW }),
      ).resolves.toEqual({ valid: false, reason: 'unconfigured' });
    }
  });

  it('rejects tampering, wrong keys, unsigned and malformed tickets', async () => {
    const { ticket } = await mintCollaborationTicket(SECRET, {
      canvasId: 'canvas-1',
      actor,
      nowEpochSeconds: NOW,
    });
    const [payload, signature] = ticket.split('.') as [string, string];
    const forgedPayload = base64Url(
      JSON.stringify({
        ...JSON.parse(atob(payload.replace(/-/gu, '+').replace(/_/gu, '/'))),
        sub: 'someone-else',
      }),
    );
    const expectations: [string, string][] = [
      [`${forgedPayload}.${signature}`, 'signature'],
      [
        await sign(atob(payload.replace(/-/gu, '+').replace(/_/gu, '/')), `${SECRET}-other`),
        'signature',
      ],
      [`${payload}.`, 'malformed'],
      [payload, 'malformed'],
      ['', 'malformed'],
      [`${payload}.${signature}.extra`, 'malformed'],
      [`${payload}.${'A'.repeat(43)}`, 'signature'],
    ];
    for (const [candidate, reason] of expectations) {
      await expect(
        verifyCollaborationTicket(SECRET, candidate, {
          canvasId: 'canvas-1',
          nowEpochSeconds: NOW,
        }),
      ).resolves.toEqual({ valid: false, reason });
    }
  });

  it('checks version, audience, lifetime, expiry with skew, and canvas only after the signature', async () => {
    const claims = {
      v: 1,
      aud: 'collaboration',
      canvas_id: 'canvas-1',
      sub: actor.actor_id,
      name: actor.display_name,
      color: actor.color,
      iat: NOW,
      exp: NOW + 60,
    };
    const verify = async (payload: Record<string, unknown>, now = NOW, canvasId = 'canvas-1') =>
      verifyCollaborationTicket(SECRET, await sign(JSON.stringify(payload)), {
        canvasId,
        nowEpochSeconds: now,
      });

    expect((await verify(claims)).valid).toBe(true);
    expect(await verify({ ...claims, v: 2 })).toEqual({ valid: false, reason: 'version' });
    expect(await verify({ ...claims, aud: 'core' })).toEqual({ valid: false, reason: 'audience' });
    expect(
      await verify({ ...claims, exp: NOW + COLLABORATION_TICKET_MAX_TTL_SECONDS + 1 }),
    ).toEqual({
      valid: false,
      reason: 'lifetime',
    });
    expect(await verify({ ...claims, exp: NOW })).toEqual({ valid: false, reason: 'lifetime' });
    expect(await verify(claims, NOW + 60 + 14)).toMatchObject({ valid: true });
    expect(await verify(claims, NOW + 60 + 15)).toEqual({ valid: false, reason: 'expired' });
    expect(await verify(claims, NOW - 16)).toEqual({ valid: false, reason: 'not_yet_valid' });
    expect(await verify(claims, NOW, 'canvas-2')).toEqual({
      valid: false,
      reason: 'canvas_mismatch',
    });
    expect(await verify({ ...claims, extra: true })).toEqual({ valid: false, reason: 'malformed' });
    const reordered = {
      aud: claims.aud,
      v: claims.v,
      canvas_id: claims.canvas_id,
      sub: claims.sub,
      name: claims.name,
      color: claims.color,
      iat: claims.iat,
      exp: claims.exp,
    };
    expect(await verify(reordered)).toEqual({ valid: false, reason: 'malformed' });
  });

  it('never mints a ticket that outlives the maximum lifetime', async () => {
    await expect(
      mintCollaborationTicket(SECRET, {
        canvasId: 'canvas-1',
        actor,
        nowEpochSeconds: NOW,
        ttlSeconds: COLLABORATION_TICKET_MAX_TTL_SECONDS + 1,
      }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('reads tickets only from a bearer header or the exact subprotocol offer', () => {
    expect(collaborationTicketFromAuthorization('Bearer abc.def')).toBe('abc.def');
    expect(collaborationTicketFromAuthorization('bearer abc.def')).toBeNull();
    expect(collaborationTicketFromAuthorization('Bearer abc def')).toBeNull();
    expect(collaborationTicketFromAuthorization(null)).toBeNull();
    expect(
      collaborationTicketFromWebSocketProtocols(`${COLLABORATION_WEBSOCKET_PROTOCOL}, abc.def`),
    ).toBe('abc.def');
    expect(collaborationTicketFromWebSocketProtocols('abc.def')).toBeNull();
    expect(
      collaborationTicketFromWebSocketProtocols(`abc.def, ${COLLABORATION_WEBSOCKET_PROTOCOL}`),
    ).toBeNull();
    expect(
      collaborationTicketFromWebSocketProtocols(`${COLLABORATION_WEBSOCKET_PROTOCOL}, a.b, c.d`),
    ).toBeNull();
    expect(collaborationTicketFromWebSocketProtocols(null)).toBeNull();
  });

  it('derives stable non-PII presentation from the user id alone', () => {
    const id = actor.actor_id;
    expect(collaborationActorColor(id)).toBe(collaborationActorColor(id));
    expect(collaborationActorColor(id)).toMatch(/^#[0-9a-f]{6}$/u);
    expect(collaborationFallbackDisplayName(id)).toBe(collaborationFallbackDisplayName(id));
    expect(collaborationFallbackDisplayName(id)).toMatch(/^Collaborator [0-9A-F]{4}$/u);
    expect(collaborationFallbackDisplayName(id)).not.toContain(id);
  });
});
