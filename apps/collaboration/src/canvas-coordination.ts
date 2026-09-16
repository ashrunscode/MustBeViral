import { DurableObject } from 'cloudflare:workers';

import {
  COLLABORATION_WEBSOCKET_PROTOCOL,
  ClientMessageSchema,
  ServerMessageSchema,
  type CollaborationActor,
} from '@mustbeviral/collaboration';

import { CoordinationStore, OwnershipError, type Surface } from './coordination-store';
import {
  INTERNAL_IDENTITY_HEADER,
  decodeVerifiedIdentity,
  parseVerifiedIdentity,
  type VerifiedIdentity,
} from './identity';

const ATTACHMENT_VERSION = 1;
const UNBOUND_SOCKET_CLOSE_CODE = 1008;

/**
 * Serialized onto each accepted socket so the bound identity survives hibernation. Nothing a client
 * sends can change `canvas_id` or `actor`; only the verified request that opened the socket sets them.
 */
interface SocketAttachment {
  readonly v: typeof ATTACHMENT_VERSION;
  readonly socket_id: string;
  readonly canvas_id: string;
  readonly actor: CollaborationActor;
  readonly surface: Surface | null;
}

function encodeServerMessage(message: ReturnType<typeof ServerMessageSchema.parse>): string {
  return JSON.stringify(ServerMessageSchema.parse(message));
}

function readAttachment(socket: WebSocket): SocketAttachment | null {
  let raw: unknown;
  try {
    raw = socket.deserializeAttachment() as unknown;
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Readonly<Record<string, unknown>>;
  const identity = parseVerifiedIdentity({ canvas_id: record.canvas_id, actor: record.actor });
  if (
    identity === null ||
    record.v !== ATTACHMENT_VERSION ||
    typeof record.socket_id !== 'string' ||
    (record.surface !== null && record.surface !== 'canvas' && record.surface !== 'review')
  ) {
    return null;
  }
  return {
    v: ATTACHMENT_VERSION,
    socket_id: record.socket_id,
    canvas_id: identity.canvas_id,
    actor: identity.actor,
    surface: record.surface,
  };
}

function closeQuietly(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // Already closed.
  }
}

function unauthenticated(): Response {
  return Response.json(
    {
      error: { code: 'UNAUTHENTICATED', message: 'A verified collaboration identity is required.' },
    },
    { status: 401 },
  );
}

/**
 * One coordination object per canvas. Its only public methods are the runtime entry points: `fetch`
 * and the hibernatable WebSocket handlers. All state access lives in `CoordinationStore` and in
 * `#private` members, so no Durable Object RPC call can read or change canvas state.
 */
export class CanvasCoordination extends DurableObject<CollaborationBindings> {
  readonly #store: CoordinationStore;

  constructor(ctx: DurableObjectState, env: CollaborationBindings) {
    super(ctx, env);
    this.#store = new CoordinationStore(ctx.storage.sql);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const canvasId = url.searchParams.get('canvas_id');
    if (!canvasId) {
      return Response.json(
        { error: { code: 'VALIDATION_FAILED', message: 'canvas_id is required' } },
        { status: 400 },
      );
    }

    // Defense in depth: the Worker always sets this header after verifying a ticket. A request
    // without a well-formed identity for this exact canvas is refused.
    const identity = decodeVerifiedIdentity(request.headers.get(INTERNAL_IDENTITY_HEADER));
    if (identity === null || identity.canvas_id !== canvasId) {
      return unauthenticated();
    }

    const upgrade = request.headers.get('Upgrade') === 'websocket';
    if (url.pathname === '/ws' && upgrade) {
      return this.#acceptSocket(identity);
    }

    if (url.pathname === '/snapshot' && request.method === 'GET' && !upgrade) {
      return Response.json({ data: this.#store.getSnapshot(canvasId) });
    }

    return new Response('Not Found', { status: 404 });
  }

  override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment === null) {
      closeQuietly(socket, UNBOUND_SOCKET_CLOSE_CODE, 'collaboration identity unavailable');
      return;
    }
    this.#handleSocketMessage(socket, attachment, message);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment !== null) this.#releasePresenceFor(attachment);
    closeQuietly(socket, 1000, 'closed');
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment !== null) this.#releasePresenceFor(attachment);
  }

  #acceptSocket(identity: VerifiedIdentity): Response {
    const snapshot = this.#store.getSnapshot(identity.canvas_id);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    // Serialized synchronously after acceptance: no broadcast can run in between.
    const attachment: SocketAttachment = {
      v: ATTACHMENT_VERSION,
      socket_id: crypto.randomUUID(),
      canvas_id: identity.canvas_id,
      actor: identity.actor,
      surface: null,
    };
    server.serializeAttachment(attachment);
    server.send(encodeServerMessage({ type: 'snapshot', payload: snapshot }));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': COLLABORATION_WEBSOCKET_PROTOCOL },
    });
  }

  /** Sends the snapshot only to sockets with a valid bound identity; any other socket is closed. */
  #broadcastSnapshot(): void {
    const payload = encodeServerMessage({
      type: 'snapshot',
      payload: this.#store.getSnapshot(this.#store.readCanvasId()),
    });
    for (const socket of this.ctx.getWebSockets()) {
      if (readAttachment(socket) === null) {
        closeQuietly(socket, UNBOUND_SOCKET_CLOSE_CODE, 'collaboration identity unavailable');
        continue;
      }
      try {
        socket.send(payload);
      } catch {
        closeQuietly(socket, 1011, 'broadcast failed');
      }
    }
  }

  /**
   * Removes the socket's bound actor from presence unless another socket of the same actor still
   * holds a presence join, in which case that socket's surface is kept. Other actors are untouched.
   */
  #releasePresenceFor(attachment: SocketAttachment): void {
    const remaining = this.ctx
      .getWebSockets()
      .map((candidate) => readAttachment(candidate))
      .find(
        (candidate) =>
          candidate !== null &&
          candidate.socket_id !== attachment.socket_id &&
          candidate.actor.actor_id === attachment.actor.actor_id &&
          candidate.surface !== null,
      );
    if (remaining?.surface) {
      this.#store.joinPresence(attachment.canvas_id, remaining.actor, remaining.surface);
    } else {
      this.#store.leavePresence(attachment.canvas_id, attachment.actor);
    }
    this.#broadcastSnapshot();
  }

  #handleSocketMessage(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: string | ArrayBuffer,
  ): void {
    const canvasId = attachment.canvas_id;
    const actor = attachment.actor;
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      // The schema strips any identity fields a client sends. Every branch below acts as `actor`,
      // the identity bound when the socket was accepted.
      const parsed = ClientMessageSchema.parse(JSON.parse(text));
      if (parsed.type === 'presence.join') {
        socket.serializeAttachment({ ...attachment, surface: parsed.payload.surface });
        this.#store.joinPresence(canvasId, actor, parsed.payload.surface);
        this.#broadcastSnapshot();
        return;
      }
      if (parsed.type === 'presence.leave') {
        socket.serializeAttachment({ ...attachment, surface: null });
        this.#releasePresenceFor(attachment);
        return;
      }
      if (parsed.type === 'comment.upsert') {
        this.#store.upsertComment(canvasId, actor, parsed.payload);
        this.#broadcastSnapshot();
        return;
      }
      if (parsed.type === 'text.draft.upsert') {
        const result = this.#store.upsertTextDraft(canvasId, actor, parsed.payload);
        if (result.accepted) this.#broadcastSnapshot();
        socket.send(
          encodeServerMessage({
            type: 'text.draft.result',
            payload: {
              accepted: result.accepted,
              draft_id: parsed.payload.draft_id,
              node_id: parsed.payload.node_id,
              field_path: parsed.payload.field_path,
              reason: result.reason,
            },
          }),
        );
        return;
      }
      if (parsed.type === 'lease.acquire') {
        const accepted = this.#store.acquireLease(canvasId, actor, parsed.payload);
        if (accepted) this.#broadcastSnapshot();
        socket.send(
          encodeServerMessage({
            type: 'lease.result',
            payload: {
              accepted,
              lease_id: parsed.payload.lease_id,
              node_id: parsed.payload.node_id,
            },
          }),
        );
        return;
      }
      if (parsed.type === 'lease.release') {
        this.#store.releaseLease(canvasId, actor, parsed.payload.lease_id);
        this.#broadcastSnapshot();
        return;
      }
      if (parsed.type === 'text.draft.clear') {
        const cleared = this.#store.clearCheckpointedDrafts(canvasId, actor, parsed.payload);
        this.#broadcastSnapshot();
        socket.send(
          encodeServerMessage({
            type: 'text.draft.clear.result',
            payload: {
              cleared_draft_ids: [...cleared],
              revision_id: parsed.payload.revision_id,
            },
          }),
        );
        return;
      }
      if (parsed.type === 'snapshot.request') {
        socket.send(
          encodeServerMessage({ type: 'snapshot', payload: this.#store.getSnapshot(canvasId) }),
        );
      }
    } catch (error) {
      socket.send(
        encodeServerMessage({
          type: 'error',
          payload:
            error instanceof OwnershipError
              ? { code: 'FORBIDDEN', message: error.message }
              : { code: 'VALIDATION_FAILED', message: 'Invalid collaboration message' },
        }),
      );
    }
  }
}

export { CanvasCoordination as default };
