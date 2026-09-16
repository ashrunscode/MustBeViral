import { leaseIdForActor } from './conflict-resolution';
import {
  ClientMessageSchema,
  CollaborationActorSchema,
  DEFAULT_LEASE_TTL_SECONDS,
  ServerMessageSchema,
  type CollaborationActor,
  type CollaborationSnapshot,
  type UpsertCommentInput,
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
  }) => void;
  readonly onTextDraftResult?: (result: {
    accepted: boolean;
    draft_id: string;
    node_id: string;
    field_path: string;
    reason?: 'ok' | 'lease_held' | 'stale';
  }) => void;
  readonly WebSocketImpl?: typeof WebSocket;
  /** Delay before each consecutive reconnect attempt; the last entry repeats until the limit. */
  readonly reconnectDelaysMs?: readonly number[];
  /** Consecutive failed attempts before the client stops and reports `error`. */
  readonly maxReconnectAttempts?: number;
}

const OPEN_READY_STATE = 1;

function sendMessage(
  socket: WebSocket,
  message: ReturnType<typeof ClientMessageSchema.parse>,
): void {
  socket.send(JSON.stringify(ClientMessageSchema.parse(message)));
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
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    const socket = this.#socket;
    this.#socket = null;
    if (socket !== null) {
      if (socket.readyState === OPEN_READY_STATE) {
        sendMessage(socket, { type: 'presence.leave', payload: {} });
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

    socket.addEventListener('open', () => {
      if (this.#socket !== socket) return;
      this.#failedAttempts = 0;
      this.#setStatus('open');
      sendMessage(socket, { type: 'presence.join', payload: { surface: this.#options.surface } });
    });
    socket.addEventListener('message', (event) => {
      if (this.#socket !== socket) return;
      try {
        const parsed = ServerMessageSchema.parse(JSON.parse(String(event.data)));
        if (parsed.type === 'snapshot') {
          this.#snapshot = parsed.payload;
          this.#options.onSnapshot?.(parsed.payload);
          return;
        }
        if (parsed.type === 'lease.result') {
          this.#options.onLeaseResult?.(parsed.payload);
          return;
        }
        if (parsed.type === 'text.draft.result') {
          const payload = parsed.payload;
          this.#options.onTextDraftResult?.({
            accepted: payload.accepted,
            draft_id: payload.draft_id,
            node_id: payload.node_id,
            field_path: payload.field_path,
            ...(payload.reason === undefined ? {} : { reason: payload.reason }),
          });
        }
      } catch {
        this.#setStatus('error');
      }
    });
    socket.addEventListener('close', () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      if (!this.#active) {
        this.#setStatus('closed');
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

  #openSocket(): WebSocket | null {
    const socket = this.#socket;
    return socket !== null && socket.readyState === OPEN_READY_STATE ? socket : null;
  }

  requestSnapshot(): void {
    const socket = this.#openSocket();
    if (socket === null) return;
    sendMessage(socket, { type: 'snapshot.request' });
  }

  upsertComment(input: UpsertCommentInput): void {
    const socket = this.#openSocket();
    if (socket === null) return;
    sendMessage(socket, { type: 'comment.upsert', payload: input });
  }

  upsertTextDraft(input: UpsertTextDraftInput): void {
    const socket = this.#openSocket();
    if (socket === null) return;
    sendMessage(socket, { type: 'text.draft.upsert', payload: input });
  }

  acquireLease(nodeId: string, ttlSeconds = DEFAULT_LEASE_TTL_SECONDS): void {
    const socket = this.#openSocket();
    const actor = this.#actor;
    if (socket === null || actor === null) return;
    sendMessage(socket, {
      type: 'lease.acquire',
      payload: {
        lease_id: leaseIdForActor(nodeId, actor.actor_id),
        node_id: nodeId,
        ttl_seconds: ttlSeconds,
      },
    });
  }

  releaseLease(nodeId: string): void {
    const socket = this.#openSocket();
    const actor = this.#actor;
    if (socket === null || actor === null) return;
    sendMessage(socket, {
      type: 'lease.release',
      payload: { lease_id: leaseIdForActor(nodeId, actor.actor_id) },
    });
  }

  clearCheckpointedDrafts(draftIds: readonly string[], revisionId: string): void {
    const socket = this.#openSocket();
    if (socket === null || draftIds.length === 0) return;
    sendMessage(socket, {
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
