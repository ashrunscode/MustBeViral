import {
  ClientMessageSchema,
  ServerMessageSchema,
  type CollaborationActor,
  type CollaborationSnapshot,
  type UpsertCommentInput,
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

  #setStatus(status: CollaborationClientStatus): void {
    this.#status = status;
    this.#options.onStatus?.(status);
  }
}
