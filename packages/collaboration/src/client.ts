import {
  ClientMessageSchema,
  DEFAULT_LEASE_TTL_SECONDS,
  ServerMessageSchema,
  type CollaborationActor,
  type CollaborationSnapshot,
  type UpsertCommentInput,
  type UpsertTextDraftInput,
} from './protocol';

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

export interface CollaborationClientOptions {
  readonly baseUrl: string;
  readonly canvasId: string;
  readonly actor: CollaborationActor;
  readonly surface: 'canvas' | 'review';
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
}

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

  constructor(options: CollaborationClientOptions) {
    this.#options = options;
  }

  get status(): CollaborationClientStatus {
    return this.#status;
  }

  get snapshot(): CollaborationSnapshot | null {
    return this.#snapshot;
  }

  connect(): void {
    if (this.#socket !== null) return;
    const WebSocketCtor = this.#options.WebSocketImpl ?? globalThis.WebSocket;
    if (WebSocketCtor === undefined) {
      this.#setStatus('error');
      return;
    }
    this.#setStatus('connecting');
    const socket = new WebSocketCtor(
      collaborationWebSocketUrl(this.#options.baseUrl, this.#options.canvasId),
    );
    this.#socket = socket;
    socket.addEventListener('open', () => {
      this.#setStatus('open');
      sendMessage(socket, {
        type: 'presence.join',
        payload: {
          actor: this.#options.actor,
          surface: this.#options.surface,
        },
      });
    });
    socket.addEventListener('message', (event) => {
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
      this.#socket = null;
      this.#setStatus('closed');
    });
    socket.addEventListener('error', () => {
      this.#setStatus('error');
    });
  }

  disconnect(): void {
    const socket = this.#socket;
    if (socket === null) return;
    if (socket.readyState === WebSocket.OPEN) {
      sendMessage(socket, {
        type: 'presence.leave',
        payload: { actor_id: this.#options.actor.actor_id },
      });
    }
    socket.close();
    this.#socket = null;
    this.#setStatus('closed');
  }

  requestSnapshot(): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    sendMessage(socket, { type: 'snapshot.request' });
  }

  upsertComment(input: Omit<UpsertCommentInput, 'author'>): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    sendMessage(socket, {
      type: 'comment.upsert',
      payload: {
        ...input,
        author: this.#options.actor,
      },
    });
  }

  upsertTextDraft(input: Omit<UpsertTextDraftInput, 'author'>): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    sendMessage(socket, {
      type: 'text.draft.upsert',
      payload: {
        ...input,
        author: this.#options.actor,
      },
    });
  }

  acquireLease(nodeId: string, leaseId?: string, ttlSeconds = DEFAULT_LEASE_TTL_SECONDS): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    sendMessage(socket, {
      type: 'lease.acquire',
      payload: {
        lease_id: leaseId ?? `lease-${nodeId}-${this.#options.actor.actor_id}`,
        node_id: nodeId,
        holder: this.#options.actor,
        ttl_seconds: ttlSeconds,
      },
    });
  }

  releaseLease(leaseId: string): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    sendMessage(socket, {
      type: 'lease.release',
      payload: {
        lease_id: leaseId,
        actor_id: this.#options.actor.actor_id,
      },
    });
  }

  #setStatus(status: CollaborationClientStatus): void {
    this.#status = status;
    this.#options.onStatus?.(status);
  }
}
