import { COLLABORATION_CLOSE_CODES } from './limits';
import {
  ClientMessageSchema,
  CollaborationActorSchema,
  DEFAULT_LEASE_TTL_SECONDS,
  ServerMessageSchema,
  describeClientMessageIssues,
  type ClientMessage,
  type CollaborationActor,
  type CollaborationErrorPayload,
  type CollaborationSnapshot,
  type CreateCommentInput,
  type UpdateCommentInput,
  type UpsertTextDraftInput,
} from './protocol';
import { COLLABORATION_WEBSOCKET_PROTOCOL } from './ticket';

export function collaborationWebSocketUrl(baseUrl: string, canvasId: string): string {
  const normalized = baseUrl.replace(/\/+$/u, '');
  const wsBase = normalized.startsWith('https://')
    ? `wss://${normalized.slice('https://'.length)}`
    : normalized.startsWith('http://')
      ? `ws://${normalized.slice('http://'.length)}`
      : normalized;
  return `${wsBase}/canvases/${encodeURIComponent(canvasId)}/ws`;
}

export type CollaborationClientStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/** What Core returns for one connection attempt: a short-lived ticket and the identity it binds. */
export interface CollaborationTicketGrant {
  readonly ticket: string;
  readonly actor: CollaborationActor;
}

/**
 * Obtains a fresh ticket from Core. Called for every connection attempt, including every
 * reconnect, because a ticket expires within seconds and is never reused.
 */
export type CollaborationTicketProvider = () => Promise<CollaborationTicketGrant>;

/** Thrown by a ticket provider when retrying cannot help, for example the session has no access. */
export class CollaborationTicketDeniedError extends Error {
  override readonly name = 'CollaborationTicketDeniedError';
}

export const DEFAULT_COLLABORATION_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/**
 * A `SESSION_EXPIRED` close is expected only after the Worker's socket lifetime. One that arrives
 * sooner is treated as an ordinary failure with backoff, so a misbehaving server cannot make the
 * client request tickets in a tight loop.
 */
export const COLLABORATION_MIN_SESSION_MS_FOR_IMMEDIATE_RECONNECT = 30_000;
/** Messages sent while re-authenticating after `SESSION_EXPIRED` wait for the new socket. */
export const COLLABORATION_REAUTH_QUEUE_MAX_MESSAGES = 16;
export const COLLABORATION_REAUTH_QUEUE_MAX_AGE_MS = 10_000;

export interface CollaborationCommentResult {
  readonly operation: 'create' | 'update' | 'delete';
  readonly comment_id: string;
  readonly client_request_id?: string;
}

export interface CollaborationClientOptions {
  readonly baseUrl: string;
  readonly canvasId: string;
  readonly surface: 'canvas' | 'review';
  readonly ticketProvider: CollaborationTicketProvider;
  readonly onActor?: (actor: CollaborationActor) => void;
  readonly onSnapshot?: (snapshot: CollaborationSnapshot) => void;
  readonly onStatus?: (status: CollaborationClientStatus) => void;
  readonly onLeaseResult?: (result: {
    accepted: boolean;
    lease_id: string;
    node_id: string;
    reason?: 'ok' | 'contested' | 'invalid_lease_id' | 'limit_reached';
  }) => void;
  readonly onTextDraftResult?: (result: {
    accepted: boolean;
    draft_id: string;
    node_id: string;
    field_path: string;
    reason?: 'ok' | 'lease_held' | 'stale' | 'limit_reached';
  }) => void;
  readonly onCommentResult?: (result: CollaborationCommentResult) => void;
  /** Typed refusals from the Worker: limits, rate limits, ownership and validation. */
  readonly onError?: (error: CollaborationErrorPayload) => void;
  readonly WebSocketImpl?: typeof WebSocket;
  /** Delay before each consecutive reconnect attempt; the last entry repeats until the limit. */
  readonly reconnectDelaysMs?: readonly number[];
  /** Consecutive failed attempts before the client stops and reports `error`. */
  readonly maxReconnectAttempts?: number;
  /** Clock for session age and queue expiry. Defaults to `Date.now`. */
  readonly now?: () => number;
}

const OPEN_READY_STATE = 1;

function closeCode(event: unknown): number | undefined {
  if (typeof event !== 'object' || event === null) return undefined;
  const code = (event as { code?: unknown }).code;
  return typeof code === 'number' ? code : undefined;
}

export class CollaborationClient {
  readonly #options: CollaborationClientOptions;
  #socket: WebSocket | null = null;
  #status: CollaborationClientStatus = 'idle';
  #snapshot: CollaborationSnapshot | null = null;
  #actor: CollaborationActor | null = null;
  #active = false;
  #generation = 0;
  #failedAttempts = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #reauthenticating = false;
  #pending: { readonly message: ClientMessage; readonly queuedAtMs: number }[] = [];

  constructor(options: CollaborationClientOptions) {
    this.#options = options;
  }

  get status(): CollaborationClientStatus {
    return this.#status;
  }

  get snapshot(): CollaborationSnapshot | null {
    return this.#snapshot;
  }

  /** The identity bound by the most recent ticket. Null until Core has issued one. */
  get actor(): CollaborationActor | null {
    return this.#actor;
  }

  #now(): number {
    return (this.#options.now ?? Date.now)();
  }

  connect(): void {
    if (this.#active) return;
    this.#active = true;
    this.#failedAttempts = 0;
    void this.#attempt();
  }

  disconnect(): void {
    const wasActive = this.#active;
    this.#active = false;
    this.#generation += 1;
    this.#stopReauthenticating();
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    const socket = this.#socket;
    this.#socket = null;
    if (socket !== null) {
      if (socket.readyState === OPEN_READY_STATE) {
        this.#write(socket, { type: 'presence.leave', payload: {} });
      }
      socket.close();
    }
    if (wasActive || socket !== null) this.#setStatus('closed');
  }

  async #attempt(): Promise<void> {
    const generation = ++this.#generation;
    const WebSocketCtor = this.#options.WebSocketImpl ?? globalThis.WebSocket;
    if (WebSocketCtor === undefined) {
      this.#active = false;
      this.#stopReauthenticating();
      this.#setStatus('error');
      return;
    }
    this.#setStatus('connecting');

    let grant: CollaborationTicketGrant;
    try {
      const provided = await this.#options.ticketProvider();
      grant = { ticket: provided.ticket, actor: CollaborationActorSchema.parse(provided.actor) };
      if (grant.ticket.length === 0) throw new TypeError('Empty collaboration ticket');
    } catch (error) {
      if (generation !== this.#generation || !this.#active) return;
      this.#scheduleReconnect(!(error instanceof CollaborationTicketDeniedError));
      return;
    }
    if (generation !== this.#generation || !this.#active) return;

    this.#actor = grant.actor;
    this.#options.onActor?.(grant.actor);

    let socket: WebSocket;
    try {
      // The ticket rides in the subprotocol offer, never the URL, so request logs never record it.
      socket = new WebSocketCtor(
        collaborationWebSocketUrl(this.#options.baseUrl, this.#options.canvasId),
        [COLLABORATION_WEBSOCKET_PROTOCOL, grant.ticket],
      );
    } catch {
      this.#scheduleReconnect(true);
      return;
    }
    this.#socket = socket;
    let openedAtMs: number | null = null;

    socket.addEventListener('open', () => {
      if (this.#socket !== socket) return;
      openedAtMs = this.#now();
      this.#failedAttempts = 0;
      this.#setStatus('open');
      this.#write(socket, {
        type: 'presence.join',
        payload: { surface: this.#options.surface },
      });
      this.#flushPending(socket);
    });
    socket.addEventListener('message', (event) => {
      if (this.#socket !== socket) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      // Frames this client does not understand are ignored, so a newer server stays compatible.
      const parsed = ServerMessageSchema.safeParse(raw);
      if (!parsed.success) return;
      const message = parsed.data;
      switch (message.type) {
        case 'snapshot':
          this.#snapshot = message.payload;
          this.#options.onSnapshot?.(message.payload);
          return;
        case 'lease.result':
          this.#options.onLeaseResult?.({
            accepted: message.payload.accepted,
            lease_id: message.payload.lease_id,
            node_id: message.payload.node_id,
            ...(message.payload.reason === undefined ? {} : { reason: message.payload.reason }),
          });
          return;
        case 'text.draft.result':
          this.#options.onTextDraftResult?.({
            accepted: message.payload.accepted,
            draft_id: message.payload.draft_id,
            node_id: message.payload.node_id,
            field_path: message.payload.field_path,
            ...(message.payload.reason === undefined ? {} : { reason: message.payload.reason }),
          });
          return;
        case 'comment.result':
          this.#options.onCommentResult?.({
            operation: message.payload.operation,
            comment_id: message.payload.comment_id,
            ...(message.payload.client_request_id === undefined
              ? {}
              : { client_request_id: message.payload.client_request_id }),
          });
          return;
        case 'error':
          this.#options.onError?.(message.payload);
          return;
        case 'text.draft.clear.result':
          return;
      }
    });
    socket.addEventListener('close', (event) => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      if (!this.#active) {
        this.#setStatus('closed');
        return;
      }
      const code = closeCode(event);
      if (code === COLLABORATION_CLOSE_CODES.POLICY_VIOLATION) {
        // Refused identity or sustained abuse: reconnecting cannot help.
        this.#active = false;
        this.#stopReauthenticating();
        this.#setStatus('error');
        return;
      }
      if (
        code === COLLABORATION_CLOSE_CODES.SESSION_EXPIRED &&
        openedAtMs !== null &&
        this.#now() - openedAtMs >= COLLABORATION_MIN_SESSION_MS_FOR_IMMEDIATE_RECONNECT
      ) {
        // The socket reached its lifetime. Ask Core for a fresh ticket now; Core re-checks access.
        // Messages sent meanwhile wait for the new socket instead of being dropped.
        this.#reauthenticating = true;
        void this.#attempt();
        return;
      }
      this.#scheduleReconnect(true);
    });
    socket.addEventListener('error', () => {
      if (this.#socket !== socket) return;
      this.#setStatus('error');
    });
  }

  #scheduleReconnect(retryable: boolean): void {
    this.#failedAttempts += 1;
    const maxAttempts = this.#options.maxReconnectAttempts ?? 6;
    if (!retryable || this.#failedAttempts > maxAttempts) {
      this.#active = false;
      this.#stopReauthenticating();
      this.#setStatus('error');
      return;
    }
    const delays = this.#options.reconnectDelaysMs ?? DEFAULT_COLLABORATION_RECONNECT_DELAYS_MS;
    const delay = delays[Math.min(this.#failedAttempts - 1, delays.length - 1)] ?? 0;
    this.#setStatus('connecting');
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      if (!this.#active) return;
      void this.#attempt();
    }, delay);
  }

  #stopReauthenticating(): void {
    this.#reauthenticating = false;
    this.#pending = [];
  }

  #flushPending(socket: WebSocket): void {
    const pending = this.#pending;
    this.#stopReauthenticating();
    const oldestAllowed = this.#now() - COLLABORATION_REAUTH_QUEUE_MAX_AGE_MS;
    for (const entry of pending) {
      if (entry.queuedAtMs >= oldestAllowed) this.#write(socket, entry.message);
    }
  }

  #write(socket: WebSocket, message: ClientMessage): void {
    socket.send(JSON.stringify(message));
  }

  /**
   * Validates against the same limits the Worker enforces, then sends on the open socket or queues
   * while re-authenticating. An over-limit message is reported through `onError` with the same typed
   * error the Worker would send, and nothing is sent. Returns false when nothing was sent or queued.
   */
  #dispatch(message: ClientMessage): boolean {
    const parsed = ClientMessageSchema.safeParse(message);
    if (!parsed.success) {
      this.#options.onError?.({
        ...describeClientMessageIssues(parsed.error.issues),
        request_type: message.type,
      });
      return false;
    }
    const socket = this.#socket;
    if (socket !== null && socket.readyState === OPEN_READY_STATE) {
      this.#write(socket, parsed.data);
      return true;
    }
    if (this.#reauthenticating && this.#pending.length < COLLABORATION_REAUTH_QUEUE_MAX_MESSAGES) {
      this.#pending.push({ message: parsed.data, queuedAtMs: this.#now() });
      return true;
    }
    return false;
  }

  requestSnapshot(): boolean {
    return this.#dispatch({ type: 'snapshot.request' });
  }

  /** Creates a comment. The Worker assigns its id and reports it through `onCommentResult`. */
  createComment(input: CreateCommentInput): boolean {
    return this.#dispatch({ type: 'comment.create', payload: input });
  }

  updateComment(input: UpdateCommentInput): boolean {
    return this.#dispatch({ type: 'comment.update', payload: input });
  }

  deleteComment(commentId: string, clientRequestId?: string): boolean {
    return this.#dispatch({
      type: 'comment.delete',
      payload: {
        comment_id: commentId,
        ...(clientRequestId === undefined ? {} : { client_request_id: clientRequestId }),
      },
    });
  }

  upsertTextDraft(input: UpsertTextDraftInput): boolean {
    return this.#dispatch({ type: 'text.draft.upsert', payload: input });
  }

  /** Leases a node to the ticket-bound actor. The Worker derives the lease id. */
  acquireLease(nodeId: string, ttlSeconds = DEFAULT_LEASE_TTL_SECONDS): boolean {
    return this.#dispatch({
      type: 'lease.acquire',
      payload: { node_id: nodeId, ttl_seconds: ttlSeconds },
    });
  }

  releaseLease(nodeId: string): boolean {
    return this.#dispatch({ type: 'lease.release', payload: { node_id: nodeId } });
  }

  clearCheckpointedDrafts(draftIds: readonly string[], revisionId: string): boolean {
    if (draftIds.length === 0) return false;
    return this.#dispatch({
      type: 'text.draft.clear',
      payload: { draft_ids: [...draftIds], revision_id: revisionId },
    });
  }

  #setStatus(status: CollaborationClientStatus): void {
    if (this.#status === status) return;
    this.#status = status;
    this.#options.onStatus?.(status);
  }
}
