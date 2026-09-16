import { env, SELF } from 'cloudflare:test';

import {
  COLLABORATION_WEBSOCKET_PROTOCOL,
  collaborationActorColor,
  mintCollaborationTicket,
  type CollaborationActor,
} from '@mustbeviral/collaboration';

export const ORIGIN = 'https://collaboration.test';

export const actorA = {
  actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  display_name: 'Actor A',
  color: collaborationActorColor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
} as const satisfies CollaborationActor;

export const actorB = {
  actor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  display_name: 'Actor B',
  color: collaborationActorColor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
} as const satisfies CollaborationActor;

export function testSecret(): string {
  const secret = (env as unknown as Readonly<{ COLLABORATION_TICKET_SECRET?: string }>)
    .COLLABORATION_TICKET_SECRET;
  if (secret === undefined) throw new Error('COLLABORATION_TICKET_SECRET test binding is missing');
  return secret;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function ticketFor(
  canvasId: string,
  actor: Readonly<{ actor_id: string; display_name: string; color: string }>,
  options: Readonly<{ nowEpochSeconds?: number; secret?: string }> = {},
): Promise<string> {
  const { ticket } = await mintCollaborationTicket(options.secret ?? testSecret(), {
    canvasId,
    actor,
    nowEpochSeconds: options.nowEpochSeconds ?? nowSeconds(),
  });
  return ticket;
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

/** Signs an arbitrary payload with the real secret, to prove claim checks run after the HMAC. */
export async function signRawTicket(
  payload: Readonly<Record<string, unknown>>,
  secret = testSecret(),
): Promise<string> {
  const text = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return `${base64Url(new TextEncoder().encode(text))}.${base64Url(signature)}`;
}

export function snapshotRequest(
  canvasId: string,
  headers: Readonly<Record<string, string>> = {},
): Request {
  return new Request(`${ORIGIN}/canvases/${canvasId}/snapshot`, { headers });
}

export function socketRequest(
  canvasId: string,
  headers: Readonly<Record<string, string>> = {},
  search = '',
): Request {
  return new Request(`${ORIGIN}/canvases/${canvasId}/ws${search}`, {
    headers: { Upgrade: 'websocket', ...headers },
  });
}

export function protocolHeader(ticket: string): Readonly<Record<string, string>> {
  return { 'Sec-WebSocket-Protocol': `${COLLABORATION_WEBSOCKET_PROTOCOL}, ${ticket}` };
}

export interface ServerFrame {
  readonly type: string;
  readonly payload?: unknown;
}

export interface TestSocket {
  readonly socket: WebSocket;
  readonly frames: ServerFrame[];
  readonly response: Response;
  send(message: unknown): void;
  waitFor(predicate: (frame: ServerFrame) => boolean, timeoutMs?: number): Promise<ServerFrame>;
  close(): void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function openSocket(
  canvasId: string,
  actor: Readonly<{ actor_id: string; display_name: string; color: string }>,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<TestSocket> {
  const ticket = await ticketFor(canvasId, actor);
  const response = await SELF.fetch(
    socketRequest(canvasId, { ...protocolHeader(ticket), ...extraHeaders }),
  );
  const socket = response.webSocket;
  if (response.status !== 101 || socket === null) {
    throw new Error(`Expected a WebSocket upgrade, received HTTP ${String(response.status)}`);
  }
  socket.accept();
  const frames: ServerFrame[] = [];
  socket.addEventListener('message', (event) => {
    frames.push(JSON.parse(String(event.data)) as ServerFrame);
  });
  return {
    socket,
    frames,
    response,
    send(message) {
      socket.send(JSON.stringify(message));
    },
    async waitFor(predicate, timeoutMs = 3_000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = frames.find(predicate);
        if (found !== undefined) return found;
        if (Date.now() > deadline) {
          throw new Error(
            `Timed out waiting for a frame; received ${frames.map((frame) => frame.type).join(', ')}`,
          );
        }
        await delay(10);
      }
    },
    close() {
      try {
        socket.close(1000, 'test complete');
      } catch {
        // Already closed.
      }
    },
  };
}

interface SnapshotPayload {
  readonly canvas_id: string;
  readonly presence: readonly { actor: CollaborationActor; surface: string }[];
  readonly comments: readonly { comment_id: string; author: CollaborationActor; body: string }[];
  readonly text_drafts: readonly {
    draft_id: string;
    node_id: string;
    field_path: string;
    body: string;
    author: CollaborationActor;
  }[];
  readonly leases: readonly { lease_id: string; node_id: string; holder: CollaborationActor }[];
}

/**
 * Requests a snapshot on `socket` and resolves with the last snapshot frame once the socket is
 * quiet. The Durable Object handles one socket's messages in order, so this snapshot reflects every
 * message this socket sent before the request.
 */
export async function freshSnapshot(socket: TestSocket): Promise<SnapshotPayload> {
  const before = socket.frames.length;
  socket.send({ type: 'snapshot.request' });
  const deadline = Date.now() + 3_000;
  while (!socket.frames.slice(before).some((candidate) => candidate.type === 'snapshot')) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for a fresh snapshot');
    await delay(10);
  }
  await delay(50);
  const snapshots = socket.frames.filter((candidate) => candidate.type === 'snapshot');
  return snapshots.at(-1)!.payload as SnapshotPayload;
}

export async function settle(ms = 50): Promise<void> {
  await delay(ms);
}
