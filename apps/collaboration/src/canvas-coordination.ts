import { DurableObject } from 'cloudflare:workers';

import {
  COLLABORATION_CLIENT_MESSAGE_MAX_BYTES,
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_SNAPSHOT_MAX_BYTES,
  COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS,
  COLLABORATION_SOCKETS_MAX_PER_ACTOR,
  COLLABORATION_SOCKETS_MAX_PER_CANVAS,
  COLLABORATION_WEBSOCKET_PROTOCOL,
  ClientMessageSchema,
  ServerMessageSchema,
  describeClientMessageIssues,
  utf8ByteLength,
  type ClientMessage,
  type CollaborationActor,
  type CollaborationErrorPayload,
  type CollaborationSnapshot,
  type ServerMessage,
} from '@mustbeviral/collaboration';

import {
  CanvasLimitError,
  CoordinationStore,
  NotFoundError,
  OwnershipError,
  type CanvasLimit,
  type Surface,
} from './coordination-store';
import {
  INTERNAL_IDENTITY_HEADER,
  decodeVerifiedIdentity,
  parseVerifiedIdentity,
  type VerifiedIdentity,
} from './identity';
import {
  BROADCAST_MIN_INTERVAL_MS,
  CanvasRateLimiter,
  INVALID_FRAME_STRIKES,
  INVALID_FRAME_TOKEN_COST,
  MESSAGE_TOKEN_COST,
  OVERSIZED_FRAME_STRIKES,
  OVERSIZED_FRAME_TOKEN_COST,
  SNAPSHOT_TOKEN_COST,
  type RateDecision,
} from './rate-limit';

const ATTACHMENT_VERSION = 2;
const OPEN_READY_STATE = 1;
const SOCKET_MAX_LIFETIME_MS = COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000;
const CLIENT_MESSAGE_TYPES: ReadonlySet<string> = new Set<ClientMessage['type']>([
  'presence.join',
  'presence.leave',
  'comment.create',
  'comment.update',
  'comment.delete',
  'comment.upsert',
  'text.draft.upsert',
  'lease.acquire',
  'lease.release',
  'text.draft.clear',
  'snapshot.request',
]);

/**
 * Serialized onto each accepted socket so the bound identity and expiry survive hibernation. Nothing
 * a client sends can change `canvas_id`, `actor` or `expires_at_ms`; only the verified request that
 * opened the socket sets them.
 */
interface SocketAttachment {
  readonly v: typeof ATTACHMENT_VERSION;
  readonly socket_id: string;
  readonly canvas_id: string;
  readonly actor: CollaborationActor;
  readonly surface: Surface | null;
  /** The opening ticket's `iat`, epoch seconds. */
  readonly ticket_issued_at: number;
  /** Epoch milliseconds after which the socket is closed with `SESSION_EXPIRED`. */
  readonly expires_at_ms: number;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
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
  const identity = parseVerifiedIdentity({
    canvas_id: record.canvas_id,
    actor: record.actor,
    ticket_issued_at: record.ticket_issued_at,
  });
  if (
    identity === null ||
    record.v !== ATTACHMENT_VERSION ||
    typeof record.socket_id !== 'string' ||
    !isPositiveSafeInteger(record.expires_at_ms) ||
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
    ticket_issued_at: identity.ticket_issued_at,
    expires_at_ms: record.expires_at_ms,
  };
}

function closeQuietly(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // Already closed.
  }
}

function jsonError(
  status: number,
  error: Readonly<Record<string, unknown>>,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return Response.json({ error }, { status, headers });
}

function unauthenticated(): Response {
  return jsonError(401, {
    code: 'UNAUTHENTICATED',
    message: 'A verified collaboration identity is required.',
  });
}

function rateLimitedResponse(decision: Extract<RateDecision, { allowed: false }>): Response {
  return jsonError(
    429,
    {
      code: 'RATE_LIMITED',
      message: 'Too many collaboration requests. Retry later.',
      details: { scope: decision.scope, retry_after_ms: decision.retryAfterMs },
    },
    { 'Retry-After': String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))) },
  );
}

function limitDetails(limit: CanvasLimit): CollaborationErrorPayload['details'] {
  return { resource: limit.resource, scope: limit.scope, unit: limit.unit, limit: limit.limit };
}

/**
 * Size of a WebSocket frame in bytes without encoding more than the limit allows: a string of more
 * than `limit` UTF-16 code units has more than `limit` UTF-8 bytes, and one of at most `limit / 3`
 * code units cannot exceed it.
 */
function exceedsMessageLimit(message: string | ArrayBuffer): boolean {
  const limit = COLLABORATION_CLIENT_MESSAGE_MAX_BYTES;
  if (typeof message !== 'string') return message.byteLength > limit;
  if (message.length > limit) return true;
  if (message.length * 3 <= limit) return false;
  return utf8ByteLength(message) > limit;
}

type EncodedSnapshot =
  | Readonly<{ ok: true; text: string; snapshot: CollaborationSnapshot }>
  | Readonly<{ ok: false; bytes: number }>;

/**
 * One coordination object per canvas. Its only public methods are the runtime entry points: `fetch`,
 * `alarm` and the hibernatable WebSocket handlers. All state access lives in `CoordinationStore` and
 * in `#private` members, so no Durable Object RPC call can read or change canvas state.
 */
export class CanvasCoordination extends DurableObject<CollaborationBindings> {
  readonly #store: CoordinationStore;
  readonly #limiter = new CanvasRateLimiter();
  #broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  #lastBroadcastAtMs = 0;

  constructor(ctx: DurableObjectState, env: CollaborationBindings) {
    super(ctx, env);
    this.#store = new CoordinationStore(ctx.storage.sql);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const canvasId = url.searchParams.get('canvas_id');
    if (!canvasId) {
      return jsonError(400, { code: 'VALIDATION_FAILED', message: 'canvas_id is required' });
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
      const decision = this.#limiter.consumeActor(identity.actor.actor_id, SNAPSHOT_TOKEN_COST);
      if (!decision.allowed) return rateLimitedResponse(decision);
      this.#store.ensureCanvasId(canvasId);
      const encoded = this.#encodeSnapshot();
      if (!encoded.ok) {
        return jsonError(503, {
          code: 'SNAPSHOT_TOO_LARGE',
          message: 'The collaboration snapshot exceeds its size ceiling.',
        });
      }
      return Response.json({ data: encoded.snapshot });
    }

    return new Response('Not Found', { status: 404 });
  }

  /** Closes every socket past its maximum lifetime, then schedules the next expiry. */
  override async alarm(): Promise<void> {
    const nowMs = Date.now();
    let next: number | null = null;
    let expired = false;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = readAttachment(socket);
      if (attachment === null) {
        closeQuietly(
          socket,
          COLLABORATION_CLOSE_CODES.POLICY_VIOLATION,
          'collaboration identity unavailable',
        );
        continue;
      }
      if (socket.readyState !== OPEN_READY_STATE) continue;
      if (attachment.expires_at_ms <= nowMs) {
        this.#expireSocket(socket, attachment);
        expired = true;
        continue;
      }
      next = next === null ? attachment.expires_at_ms : Math.min(next, attachment.expires_at_ms);
    }
    if (next !== null) await this.#ensureAlarmBy(next);
    this.#limiter.pruneIdleActors();
    if (expired) this.#scheduleBroadcast();
  }

  override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment === null) {
      closeQuietly(
        socket,
        COLLABORATION_CLOSE_CODES.POLICY_VIOLATION,
        'collaboration identity unavailable',
      );
      return;
    }
    // Frames still in flight after the object closed this socket are never acted on.
    if (socket.readyState !== OPEN_READY_STATE) return;
    // The alarm closes expired sockets; this check also covers a message that arrives first.
    if (attachment.expires_at_ms <= Date.now()) {
      this.#expireSocket(socket, attachment);
      this.#scheduleBroadcast();
      return;
    }
    if (exceedsMessageLimit(message)) {
      this.#refuseFrame(socket, attachment, OVERSIZED_FRAME_TOKEN_COST, OVERSIZED_FRAME_STRIKES, {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Messages are limited to ${String(COLLABORATION_CLIENT_MESSAGE_MAX_BYTES)} bytes.`,
        details: {
          resource: 'message',
          unit: 'bytes',
          limit: COLLABORATION_CLIENT_MESSAGE_MAX_BYTES,
        },
      });
      return;
    }
    const decision = this.#limiter.consume(
      attachment.socket_id,
      attachment.actor.actor_id,
      MESSAGE_TOKEN_COST,
    );
    if (!decision.allowed) {
      this.#rejectRateLimited(socket, attachment, decision);
      return;
    }
    this.#handleSocketMessage(socket, attachment, message);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment !== null) {
      this.#limiter.forgetSocket(attachment.socket_id);
      this.#releasePresenceFor(attachment, socket);
      this.#scheduleBroadcast();
    }
    this.#limiter.pruneIdleActors();
    closeQuietly(socket, 1000, 'closed');
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment !== null) {
      this.#limiter.forgetSocket(attachment.socket_id);
      this.#releasePresenceFor(attachment, socket);
      this.#scheduleBroadcast();
    }
  }

  async #acceptSocket(identity: VerifiedIdentity): Promise<Response> {
    const nowMs = Date.now();
    // Bound to the ticket's issue time, and never later than a full lifetime from now even if the
    // issuer's clock ran ahead within the verifier's skew allowance.
    const expiresAtMs = Math.min(identity.ticket_issued_at * 1_000, nowMs) + SOCKET_MAX_LIFETIME_MS;
    if (expiresAtMs <= nowMs) return unauthenticated();

    // Schedule the expiry first, so a socket never exists without an alarm to end it. Everything
    // after this await runs synchronously, so no other request can change the counts checked below
    // before this socket is accepted.
    await this.#ensureAlarmBy(expiresAtMs);

    const open = this.#openBoundSockets(Date.now());
    if (open.length >= COLLABORATION_SOCKETS_MAX_PER_CANVAS) {
      return this.#socketLimitResponse('canvas', COLLABORATION_SOCKETS_MAX_PER_CANVAS);
    }
    if (
      open.filter(({ attachment }) => attachment.actor.actor_id === identity.actor.actor_id)
        .length >= COLLABORATION_SOCKETS_MAX_PER_ACTOR
    ) {
      return this.#socketLimitResponse('actor', COLLABORATION_SOCKETS_MAX_PER_ACTOR);
    }
    const decision = this.#limiter.consumeActor(identity.actor.actor_id, SNAPSHOT_TOKEN_COST);
    if (!decision.allowed) return rateLimitedResponse(decision);

    this.#store.ensureCanvasId(identity.canvas_id);
    const snapshot = this.#encodeSnapshot();
    if (!snapshot.ok) {
      return jsonError(503, {
        code: 'SNAPSHOT_TOO_LARGE',
        message: 'The collaboration snapshot exceeds its size ceiling.',
      });
    }

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
      ticket_issued_at: identity.ticket_issued_at,
      expires_at_ms: expiresAtMs,
    };
    server.serializeAttachment(attachment);
    server.send(snapshot.text);
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': COLLABORATION_WEBSOCKET_PROTOCOL },
    });
  }

  /** Keeps one alarm, set no later than `atMs`. An earlier alarm stays; it reschedules when it runs. */
  async #ensureAlarmBy(atMs: number): Promise<void> {
    const scheduled = await this.ctx.storage.getAlarm();
    if (scheduled === null || scheduled > atMs) await this.ctx.storage.setAlarm(atMs);
  }

  #socketLimitResponse(scope: 'canvas' | 'actor', limit: number): Response {
    return jsonError(429, {
      code: 'CANVAS_LIMIT_REACHED',
      message: `The ${scope} limit of ${String(limit)} open collaboration connections is reached.`,
      details: { resource: 'sockets', scope, unit: 'rows', limit },
    });
  }

  #openBoundSockets(nowMs: number): { socket: WebSocket; attachment: SocketAttachment }[] {
    const open: { socket: WebSocket; attachment: SocketAttachment }[] = [];
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState !== OPEN_READY_STATE) continue;
      const attachment = readAttachment(socket);
      if (attachment === null || attachment.expires_at_ms <= nowMs) continue;
      open.push({ socket, attachment });
    }
    return open;
  }

  /** Encodes the current snapshot, refusing any encoding above the ceiling. */
  #encodeSnapshot(): EncodedSnapshot {
    const message = ServerMessageSchema.parse({
      type: 'snapshot',
      payload: this.#store.getSnapshot(this.#store.readCanvasId()),
    });
    if (message.type !== 'snapshot') throw new TypeError('Snapshot message did not parse');
    const text = JSON.stringify(message);
    const limit = COLLABORATION_SNAPSHOT_MAX_BYTES;
    const bytes = text.length * 3 <= limit ? text.length : utf8ByteLength(text);
    if (bytes > limit) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'collaboration.snapshot_over_ceiling',
          canvas_id: this.#store.readCanvasId(),
          bytes,
          limit,
        }),
      );
      return { ok: false, bytes };
    }
    return { ok: true, text, snapshot: message.payload };
  }

  #send(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(ServerMessageSchema.parse(message)));
    } catch {
      closeQuietly(socket, 1011, 'send failed');
    }
  }

  #sendError(socket: WebSocket, payload: CollaborationErrorPayload): void {
    this.#send(socket, { type: 'error', payload });
  }

  #rejectRateLimited(
    socket: WebSocket,
    attachment: SocketAttachment,
    decision: Extract<RateDecision, { allowed: false }>,
  ): void {
    if (decision.abusive) {
      this.#closeAbusive(socket, attachment);
      return;
    }
    this.#sendError(socket, {
      code: 'RATE_LIMITED',
      message: 'Too many collaboration messages. Slow down and retry.',
      details: { scope: decision.scope, retry_after_ms: decision.retryAfterMs, unit: 'tokens' },
    });
  }

  /**
   * Refuses a frame that failed before doing any work (oversized or invalid). It still spends
   * `tokenCost` tokens when the buckets have them, and adds `strikes`, so a client that keeps sending
   * such frames is closed even while it stays under the message rate.
   */
  #refuseFrame(
    socket: WebSocket,
    attachment: SocketAttachment,
    tokenCost: number,
    strikes: number,
    error: CollaborationErrorPayload,
  ): void {
    const decision = this.#limiter.consume(
      attachment.socket_id,
      attachment.actor.actor_id,
      tokenCost,
    );
    if (
      (!decision.allowed && decision.abusive) ||
      this.#limiter.strike(attachment.socket_id, strikes)
    ) {
      this.#closeAbusive(socket, attachment);
      return;
    }
    this.#sendError(socket, error);
  }

  /** Closes a socket whose client keeps sending after refusals; the client must not reconnect. */
  #closeAbusive(socket: WebSocket, attachment: SocketAttachment): void {
    console.log(
      JSON.stringify({
        level: 'warn',
        event: 'collaboration.socket_closed_for_abuse',
        canvas_id: attachment.canvas_id,
        actor_id: attachment.actor.actor_id,
      }),
    );
    closeQuietly(socket, COLLABORATION_CLOSE_CODES.POLICY_VIOLATION, 'rate limit exceeded');
    this.#releasePresenceFor(attachment, socket);
    this.#scheduleBroadcast();
  }

  /** Ends a socket at its maximum lifetime. The client reconnects with a fresh ticket from Core. */
  #expireSocket(socket: WebSocket, attachment: SocketAttachment): void {
    closeQuietly(
      socket,
      COLLABORATION_CLOSE_CODES.SESSION_EXPIRED,
      'session expired; reconnect with a new ticket',
    );
    this.#releasePresenceFor(attachment, socket);
  }

  /**
   * Coalesces broadcasts: the first change in an interval is sent at once, later ones in the same
   * interval are sent together when it ends. This bounds full-snapshot fan-out per canvas no matter
   * how many members send messages.
   */
  #scheduleBroadcast(): void {
    if (this.#broadcastTimer !== null) return;
    const waitMs = this.#lastBroadcastAtMs + BROADCAST_MIN_INTERVAL_MS - Date.now();
    if (waitMs <= 0) {
      this.#broadcastSnapshot();
      return;
    }
    this.#broadcastTimer = setTimeout(() => {
      this.#broadcastTimer = null;
      this.#broadcastSnapshot();
    }, waitMs);
  }

  /** Sends the snapshot only to open, unexpired sockets with a valid bound identity. */
  #broadcastSnapshot(): void {
    this.#lastBroadcastAtMs = Date.now();
    const encoded = this.#encodeSnapshot();
    const nowMs = Date.now();
    const expired: { socket: WebSocket; attachment: SocketAttachment }[] = [];
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = readAttachment(socket);
      if (attachment === null) {
        closeQuietly(
          socket,
          COLLABORATION_CLOSE_CODES.POLICY_VIOLATION,
          'collaboration identity unavailable',
        );
        continue;
      }
      if (socket.readyState !== OPEN_READY_STATE) continue;
      if (attachment.expires_at_ms <= nowMs) {
        expired.push({ socket, attachment });
        continue;
      }
      if (!encoded.ok) {
        this.#sendError(socket, {
          code: 'SNAPSHOT_TOO_LARGE',
          message: 'The collaboration snapshot exceeds its size ceiling.',
          details: { resource: 'snapshot', unit: 'bytes', limit: COLLABORATION_SNAPSHOT_MAX_BYTES },
        });
        continue;
      }
      try {
        socket.send(encoded.text);
      } catch {
        closeQuietly(socket, 1011, 'broadcast failed');
      }
    }
    for (const { socket, attachment } of expired) this.#expireSocket(socket, attachment);
    if (expired.length > 0) this.#scheduleBroadcast();
  }

  /**
   * Removes the socket's bound actor from presence unless another open socket of the same actor
   * still holds a presence join, in which case that socket's surface is kept. Other actors are
   * untouched.
   */
  #releasePresenceFor(attachment: SocketAttachment, closing: WebSocket): void {
    const remaining = this.#openBoundSockets(Date.now()).find(
      ({ socket, attachment: candidate }) =>
        socket !== closing &&
        candidate.socket_id !== attachment.socket_id &&
        candidate.actor.actor_id === attachment.actor.actor_id &&
        candidate.surface !== null,
    );
    if (remaining?.attachment.surface) {
      try {
        this.#store.joinPresence(
          attachment.canvas_id,
          remaining.attachment.actor,
          remaining.attachment.surface,
        );
      } catch (error) {
        if (!(error instanceof CanvasLimitError)) throw error;
      }
    } else {
      this.#store.leavePresence(attachment.canvas_id, attachment.actor);
    }
  }

  #handleSocketMessage(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: string | ArrayBuffer,
  ): void {
    const canvasId = attachment.canvas_id;
    const actor = attachment.actor;
    let requestType: string | undefined;
    let clientRequestId: string | undefined;
    // A frame that is not UTF-8 JSON, or that fails the protocol schema, spends the extra tokens and
    // strikes for invalid frames; one token was already spent before parsing.
    let raw: unknown;
    try {
      const text =
        typeof message === 'string'
          ? message
          : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(message);
      raw = JSON.parse(text) as unknown;
    } catch {
      this.#refuseFrame(
        socket,
        attachment,
        INVALID_FRAME_TOKEN_COST - MESSAGE_TOKEN_COST,
        INVALID_FRAME_STRIKES,
        { code: 'VALIDATION_FAILED', message: 'Collaboration messages must be JSON text.' },
      );
      return;
    }
    try {
      if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        const type = (raw as Readonly<Record<string, unknown>>).type;
        if (typeof type === 'string' && CLIENT_MESSAGE_TYPES.has(type)) requestType = type;
      }
      // The schema strips any identity fields a client sends. Every branch below acts as `actor`,
      // the identity bound when the socket was accepted.
      const result = ClientMessageSchema.safeParse(raw);
      if (!result.success) {
        this.#refuseFrame(
          socket,
          attachment,
          INVALID_FRAME_TOKEN_COST - MESSAGE_TOKEN_COST,
          INVALID_FRAME_STRIKES,
          {
            ...describeClientMessageIssues(result.error.issues),
            ...(requestType === undefined ? {} : { request_type: requestType }),
          },
        );
        return;
      }
      const parsed = result.data;
      if ('payload' in parsed && 'client_request_id' in parsed.payload) {
        clientRequestId = parsed.payload.client_request_id;
      }

      switch (parsed.type) {
        case 'presence.join': {
          this.#store.joinPresence(canvasId, actor, parsed.payload.surface);
          socket.serializeAttachment({ ...attachment, surface: parsed.payload.surface });
          this.#scheduleBroadcast();
          return;
        }
        case 'presence.leave': {
          socket.serializeAttachment({ ...attachment, surface: null });
          this.#releasePresenceFor(attachment, socket);
          this.#scheduleBroadcast();
          return;
        }
        case 'comment.create':
        case 'comment.upsert': {
          // Legacy `comment.upsert` is a create: its client-chosen comment_id is never used.
          const comment = this.#store.createComment(canvasId, actor, {
            body: parsed.payload.body,
            ...(parsed.payload.anchor_node_id === undefined
              ? {}
              : { anchor_node_id: parsed.payload.anchor_node_id }),
          });
          this.#scheduleBroadcast();
          // Legacy clients do not know `comment.result`, so only new clients receive it.
          if (parsed.type === 'comment.create') {
            this.#send(socket, {
              type: 'comment.result',
              payload: {
                operation: 'create',
                comment_id: comment.comment_id,
                ...(clientRequestId === undefined ? {} : { client_request_id: clientRequestId }),
              },
            });
          }
          return;
        }
        case 'comment.update': {
          const comment = this.#store.updateComment(canvasId, actor, parsed.payload);
          this.#scheduleBroadcast();
          this.#send(socket, {
            type: 'comment.result',
            payload: {
              operation: 'update',
              comment_id: comment.comment_id,
              ...(clientRequestId === undefined ? {} : { client_request_id: clientRequestId }),
            },
          });
          return;
        }
        case 'comment.delete': {
          this.#store.deleteComment(canvasId, actor, parsed.payload);
          this.#scheduleBroadcast();
          this.#send(socket, {
            type: 'comment.result',
            payload: {
              operation: 'delete',
              comment_id: parsed.payload.comment_id,
              ...(clientRequestId === undefined ? {} : { client_request_id: clientRequestId }),
            },
          });
          return;
        }
        case 'text.draft.upsert': {
          const result = this.#store.upsertTextDraft(canvasId, actor, parsed.payload);
          if (result.accepted) this.#scheduleBroadcast();
          this.#send(socket, {
            type: 'text.draft.result',
            payload: {
              accepted: result.accepted,
              draft_id: parsed.payload.draft_id,
              node_id: parsed.payload.node_id,
              field_path: parsed.payload.field_path,
              reason: result.reason,
            },
          });
          if (result.reason === 'limit_reached') {
            this.#sendLimitError(socket, requestType, clientRequestId, result.limit);
          }
          return;
        }
        case 'lease.acquire': {
          const result = this.#store.acquireLease(canvasId, actor, parsed.payload);
          if (result.accepted) this.#scheduleBroadcast();
          this.#send(socket, {
            type: 'lease.result',
            payload: {
              accepted: result.accepted,
              lease_id: result.lease_id,
              node_id: parsed.payload.node_id,
              reason: result.reason,
            },
          });
          if (result.reason === 'limit_reached') {
            this.#sendLimitError(socket, requestType, clientRequestId, result.limit);
          }
          return;
        }
        case 'lease.release': {
          if (this.#store.releaseLease(canvasId, actor, parsed.payload)) this.#scheduleBroadcast();
          return;
        }
        case 'text.draft.clear': {
          const cleared = this.#store.clearCheckpointedDrafts(canvasId, actor, parsed.payload);
          if (cleared.length > 0) this.#scheduleBroadcast();
          this.#send(socket, {
            type: 'text.draft.clear.result',
            payload: {
              cleared_draft_ids: [...cleared],
              revision_id: parsed.payload.revision_id,
            },
          });
          return;
        }
        case 'snapshot.request': {
          // A snapshot costs more than a mutation; the first token was spent before parsing.
          const decision = this.#limiter.consume(
            attachment.socket_id,
            actor.actor_id,
            SNAPSHOT_TOKEN_COST - MESSAGE_TOKEN_COST,
          );
          if (!decision.allowed) {
            this.#rejectRateLimited(socket, attachment, decision);
            return;
          }
          const encoded = this.#encodeSnapshot();
          if (!encoded.ok) {
            this.#sendError(socket, {
              code: 'SNAPSHOT_TOO_LARGE',
              message: 'The collaboration snapshot exceeds its size ceiling.',
              request_type: 'snapshot.request',
              details: {
                resource: 'snapshot',
                unit: 'bytes',
                limit: COLLABORATION_SNAPSHOT_MAX_BYTES,
              },
            });
            return;
          }
          try {
            socket.send(encoded.text);
          } catch {
            closeQuietly(socket, 1011, 'send failed');
          }
          return;
        }
      }
    } catch (error) {
      const context = {
        ...(requestType === undefined ? {} : { request_type: requestType }),
        ...(clientRequestId === undefined ? {} : { client_request_id: clientRequestId }),
      };
      if (error instanceof OwnershipError) {
        this.#sendError(socket, { code: 'FORBIDDEN', message: error.message, ...context });
        return;
      }
      if (error instanceof NotFoundError) {
        this.#sendError(socket, { code: 'NOT_FOUND', message: error.message, ...context });
        return;
      }
      if (error instanceof CanvasLimitError) {
        this.#sendLimitError(socket, requestType, clientRequestId, error.limit);
        return;
      }
      this.#sendError(socket, {
        code: 'VALIDATION_FAILED',
        message: 'Invalid collaboration message.',
        ...context,
      });
    }
  }

  #sendLimitError(
    socket: WebSocket,
    requestType: string | undefined,
    clientRequestId: string | undefined,
    limit: CanvasLimit,
  ): void {
    this.#sendError(socket, {
      code: 'CANVAS_LIMIT_REACHED',
      message: new CanvasLimitError(limit).message,
      ...(requestType === undefined ? {} : { request_type: requestType }),
      ...(clientRequestId === undefined ? {} : { client_request_id: clientRequestId }),
      details: limitDetails(limit),
    });
  }
}

export { CanvasCoordination as default };
