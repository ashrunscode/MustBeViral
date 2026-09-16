import {
  CollaborationCanvasIdSchema,
  FORBIDDEN_COLLABORATION_ROUTES,
  collaborationTicketFromAuthorization,
  collaborationTicketFromWebSocketProtocols,
  collaborationTicketSecretConfigured,
  verifyCollaborationTicket,
} from '@mustbeviral/collaboration';

import { CanvasCoordination } from './canvas-coordination';
import { INTERNAL_IDENTITY_HEADER, encodeVerifiedIdentity } from './identity';

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function parseCanvasId(pathname: string): string | null {
  const match = /^\/canvases\/([^/]+)(?:\/.*)?$/u.exec(pathname);
  if (!match?.[1]) return null;
  let canvasId: string;
  try {
    canvasId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return CollaborationCanvasIdSchema.safeParse(canvasId).success ? canvasId : null;
}

function coordinationStub(
  env: CollaborationBindings,
  canvasId: string,
): DurableObjectStub<CanvasCoordination> {
  const namespace = env.CANVAS_COORDINATION;
  if (!namespace) {
    throw new Error('CANVAS_COORDINATION binding is not configured');
  }
  return namespace.get(namespace.idFromName(canvasId));
}

function unauthenticated(): Response {
  return jsonError(401, 'UNAUTHENTICATED', 'A valid collaboration ticket is required.');
}

const worker = {
  async fetch(incoming: Request, env: CollaborationBindings): Promise<Response> {
    // Strip the internal identity header before anything else reads the request. Only this Worker
    // may set it, and only after a ticket verifies.
    const headers = new Headers(incoming.headers);
    headers.delete(INTERNAL_IDENTITY_HEADER);

    const url = new URL(incoming.url);
    const pathname = url.pathname.replace(/\/+$/u, '') || '/';

    if (pathname === '/health') {
      return Response.json({
        data: {
          service: env.SERVICE_NAME,
          generation: env.SERVICE_GENERATION,
          authority: 'draft-only',
        },
      });
    }

    for (const forbidden of FORBIDDEN_COLLABORATION_ROUTES) {
      if (pathname === forbidden || pathname.startsWith(`${forbidden}/`)) {
        return jsonError(
          404,
          'NOT_FOUND',
          'Collaboration worker does not expose revision or billing authority',
        );
      }
    }

    const canvasId = parseCanvasId(pathname);
    if (!canvasId) {
      return jsonError(404, 'NOT_FOUND', 'Unknown collaboration route');
    }

    const isSnapshot = pathname === `/canvases/${canvasId}/snapshot` && incoming.method === 'GET';
    const isSocket = pathname === `/canvases/${canvasId}/ws`;
    if (!isSnapshot && !isSocket) {
      return jsonError(404, 'NOT_FOUND', 'Unknown collaboration route');
    }

    // Fail closed: without a usable secret no ticket can be verified, so nothing is served.
    const secret = env.COLLABORATION_TICKET_SECRET;
    if (!collaborationTicketSecretConfigured(secret)) {
      return jsonError(503, 'INTERNAL_ERROR', 'Collaboration authentication is not configured.');
    }

    if (isSocket && (incoming.method !== 'GET' || headers.get('Upgrade') !== 'websocket')) {
      return jsonError(426, 'VALIDATION_FAILED', 'A WebSocket upgrade is required.');
    }

    // Tickets are read only from headers. A query-string ticket would be recorded by invocation logs.
    const ticket = isSocket
      ? collaborationTicketFromWebSocketProtocols(headers.get('Sec-WebSocket-Protocol'))
      : collaborationTicketFromAuthorization(headers.get('Authorization'));
    if (ticket === null) return unauthenticated();

    const verification = await verifyCollaborationTicket(secret, ticket, {
      canvasId,
      nowEpochSeconds: Math.floor(Date.now() / 1000),
    });
    if (!verification.valid) return unauthenticated();

    // The object needs neither the ticket nor the caller's credentials, only the verified identity.
    headers.delete('Authorization');
    headers.delete('Sec-WebSocket-Protocol');
    headers.delete('Cookie');
    // A snapshot read stays a plain read: it can never be turned into a socket upgrade.
    if (!isSocket) headers.delete('Upgrade');
    headers.set(
      INTERNAL_IDENTITY_HEADER,
      encodeVerifiedIdentity({ canvas_id: canvasId, actor: verification.actor }),
    );

    const target = new URL(url.origin);
    target.pathname = isSocket ? '/ws' : '/snapshot';
    target.searchParams.set('canvas_id', canvasId);
    return coordinationStub(env, canvasId).fetch(
      new Request(target.toString(), { method: 'GET', headers }),
    );
  },
};

export default worker;
export { CanvasCoordination };
