import { z } from 'zod';

import type { CollaborationActor } from './protocol';

/**
 * Collaboration tickets bind a live collaboration connection to an identity Core has already
 * verified.
 *
 * Core mints a ticket only after it has verified the caller's Supabase session and checked canvas
 * access with the same checks as its other canvas endpoints. The collaboration Worker has no
 * database access, so the ticket is the only identity evidence it accepts. It verifies the HMAC,
 * the audience, the version, the expiry and the canvas, and it ignores every identity field a
 * client sends in a message.
 *
 * Wire format: `base64url(canonical JSON claims) "." base64url(HMAC-SHA256(secret, canonical JSON))`.
 * The claims serialize in one fixed key order. The verifier checks the signature over the exact
 * bytes it received, then rejects any payload that does not re-serialize to those same bytes, so
 * a ticket has exactly one valid encoding.
 */

export const COLLABORATION_WEBSOCKET_PROTOCOL = 'mbv-collab.v1';
export const COLLABORATION_TICKET_VERSION = 1;
export const COLLABORATION_TICKET_AUDIENCE = 'collaboration';
/** Minted lifetime: long enough to open a socket, short enough that a leaked ticket dies quickly. */
export const COLLABORATION_TICKET_TTL_SECONDS = 60;
/** Upper bound the verifier enforces on any signed ticket, whatever lifetime it claims. */
export const COLLABORATION_TICKET_MAX_TTL_SECONDS = 120;
export const COLLABORATION_TICKET_CLOCK_SKEW_SECONDS = 15;
/** Matches the repository's other HMAC signing keys: shorter or absent keys fail closed. */
export const COLLABORATION_TICKET_SECRET_MIN_LENGTH = 32;
export const COLLABORATION_TICKET_MAX_LENGTH = 2_048;

const COLLABORATION_ACTOR_COLORS = [
  '#3182d4',
  '#1f9d63',
  '#b4531f',
  '#7b4fc9',
  '#c23b6b',
  '#0f8a8a',
  '#8a6d00',
  '#5a6b7d',
] as const;

export const CollaborationCanvasIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);

export const CollaborationTicketClaimsSchema = z.strictObject({
  v: z.literal(COLLABORATION_TICKET_VERSION),
  aud: z.literal(COLLABORATION_TICKET_AUDIENCE),
  canvas_id: CollaborationCanvasIdSchema,
  sub: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  color: z.string().regex(/^#[0-9a-f]{6}$/u),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type CollaborationTicketClaims = z.infer<typeof CollaborationTicketClaimsSchema>;

export type CollaborationTicketFailureReason =
  | 'unconfigured'
  | 'malformed'
  | 'signature'
  | 'version'
  | 'audience'
  | 'lifetime'
  | 'not_yet_valid'
  | 'expired'
  | 'canvas_mismatch';

export type CollaborationTicketVerification =
  | Readonly<{ valid: true; claims: CollaborationTicketClaims; actor: CollaborationActor }>
  | Readonly<{ valid: false; reason: CollaborationTicketFailureReason }>;

export class CollaborationTicketSigningUnavailableError extends Error {
  override readonly name = 'CollaborationTicketSigningUnavailableError';

  constructor() {
    super('Collaboration ticket signing is not configured');
  }
}

export function collaborationTicketSecretConfigured(
  secret: string | undefined | null,
): secret is string {
  return typeof secret === 'string' && secret.length >= COLLABORATION_TICKET_SECRET_MIN_LENGTH;
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic presence color for an actor id. Not a security property. */
export function collaborationActorColor(actorId: string): string {
  return COLLABORATION_ACTOR_COLORS[fnv1a32(actorId) % COLLABORATION_ACTOR_COLORS.length]!;
}

/**
 * Label for an actor that has no profile or membership display name. Derived only from the stable
 * user id, so it never exposes an email address or provider profile field.
 */
export function collaborationFallbackDisplayName(actorId: string): string {
  const suffix = fnv1a32(`display:${actorId}`).toString(16).padStart(8, '0').slice(0, 4);
  return `Collaborator ${suffix.toUpperCase()}`;
}

export function canonicalCollaborationTicketPayload(claims: CollaborationTicketClaims): string {
  return JSON.stringify({
    v: claims.v,
    aud: claims.aud,
    canvas_id: claims.canvas_id,
    sub: claims.sub,
    name: claims.name,
    color: claims.color,
    iat: claims.iat,
    exp: claims.exp,
  });
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = text.replace(/-/gu, '+').replace(/_/gu, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function mintCollaborationTicket(
  secret: string | undefined,
  input: Readonly<{
    canvasId: string;
    actor: Readonly<{ actor_id: string; display_name: string; color: string }>;
    nowEpochSeconds: number;
    ttlSeconds?: number;
  }>,
): Promise<Readonly<{ ticket: string; claims: CollaborationTicketClaims }>> {
  if (!collaborationTicketSecretConfigured(secret)) {
    throw new CollaborationTicketSigningUnavailableError();
  }
  const ttlSeconds = input.ttlSeconds ?? COLLABORATION_TICKET_TTL_SECONDS;
  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 1 ||
    ttlSeconds > COLLABORATION_TICKET_MAX_TTL_SECONDS
  ) {
    throw new RangeError('Collaboration ticket lifetime is out of bounds');
  }
  const claims = CollaborationTicketClaimsSchema.parse({
    v: COLLABORATION_TICKET_VERSION,
    aud: COLLABORATION_TICKET_AUDIENCE,
    canvas_id: input.canvasId,
    sub: input.actor.actor_id,
    name: input.actor.display_name,
    color: input.actor.color,
    iat: input.nowEpochSeconds,
    exp: input.nowEpochSeconds + ttlSeconds,
  });
  const payload = canonicalCollaborationTicketPayload(claims);
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return {
    ticket: `${base64Url(new TextEncoder().encode(payload))}.${base64Url(signature)}`,
    claims,
  };
}

export async function verifyCollaborationTicket(
  secret: string | undefined,
  ticket: string,
  expected: Readonly<{ canvasId: string; nowEpochSeconds: number }>,
): Promise<CollaborationTicketVerification> {
  if (!collaborationTicketSecretConfigured(secret)) return { valid: false, reason: 'unconfigured' };
  if (
    typeof ticket !== 'string' ||
    ticket.length > COLLABORATION_TICKET_MAX_LENGTH ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(ticket)
  ) {
    return { valid: false, reason: 'malformed' };
  }
  const [encodedPayload, encodedSignature] = ticket.split('.') as [string, string];
  const payloadBytes = fromBase64Url(encodedPayload);
  const signature = fromBase64Url(encodedSignature);
  if (payloadBytes === null || signature === null || signature.length !== 32) {
    return { valid: false, reason: 'malformed' };
  }

  const key = await importKey(secret);
  // crypto.subtle.verify compares inside the crypto implementation, the constant-time primitive a
  // Worker has. Nothing in the payload is trusted until this returns true.
  const signatureValid = await crypto.subtle.verify('HMAC', key, signature, payloadBytes);
  if (!signatureValid) return { valid: false, reason: 'signature' };

  let parsed: unknown;
  let payloadText: string;
  try {
    payloadText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(payloadBytes);
    parsed = JSON.parse(payloadText);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!isRecord(parsed)) return { valid: false, reason: 'malformed' };
  if (parsed.v !== COLLABORATION_TICKET_VERSION) return { valid: false, reason: 'version' };
  if (parsed.aud !== COLLABORATION_TICKET_AUDIENCE) return { valid: false, reason: 'audience' };
  const claimsResult = CollaborationTicketClaimsSchema.safeParse(parsed);
  if (!claimsResult.success) return { valid: false, reason: 'malformed' };
  const claims = claimsResult.data;
  if (canonicalCollaborationTicketPayload(claims) !== payloadText) {
    return { valid: false, reason: 'malformed' };
  }
  if (claims.exp <= claims.iat || claims.exp - claims.iat > COLLABORATION_TICKET_MAX_TTL_SECONDS) {
    return { valid: false, reason: 'lifetime' };
  }
  if (claims.iat > expected.nowEpochSeconds + COLLABORATION_TICKET_CLOCK_SKEW_SECONDS) {
    return { valid: false, reason: 'not_yet_valid' };
  }
  if (expected.nowEpochSeconds >= claims.exp + COLLABORATION_TICKET_CLOCK_SKEW_SECONDS) {
    return { valid: false, reason: 'expired' };
  }
  if (claims.canvas_id !== expected.canvasId) return { valid: false, reason: 'canvas_mismatch' };
  return {
    valid: true,
    claims,
    actor: { actor_id: claims.sub, display_name: claims.name, color: claims.color },
  };
}

/** Extracts the ticket from `Authorization: Bearer <ticket>`. Anything else is no ticket. */
export function collaborationTicketFromAuthorization(header: string | null): string | null {
  if (header === null) return null;
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/u.exec(header);
  return match?.[1] ?? null;
}

/**
 * Extracts the ticket from `Sec-WebSocket-Protocol`. The client offers exactly
 * `[COLLABORATION_WEBSOCKET_PROTOCOL, ticket]`; any other shape is no ticket. The server echoes only
 * the protocol name, never the ticket.
 */
export function collaborationTicketFromWebSocketProtocols(header: string | null): string | null {
  if (header === null) return null;
  const offered = header.split(',').map((entry) => entry.trim());
  if (offered.length !== 2 || offered[0] !== COLLABORATION_WEBSOCKET_PROTOCOL) return null;
  const ticket = offered[1];
  return ticket === undefined || ticket.length === 0 ? null : ticket;
}
