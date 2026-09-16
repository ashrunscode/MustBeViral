import {
  CollaborationActorSchema,
  CollaborationCanvasIdSchema,
  type CollaborationActor,
} from '@mustbeviral/collaboration';

/**
 * Carries the ticket-verified identity from the Worker to the Durable Object.
 *
 * Trust rests on one rule in `index.ts`: the Worker deletes this header from every incoming request
 * before it does anything else, and sets it only after a ticket verifies. A client-supplied value
 * therefore never reaches the object, which is reachable only through the Worker's binding.
 */
export const INTERNAL_IDENTITY_HEADER = 'x-mbv-collaboration-identity';

export interface VerifiedIdentity {
  readonly canvas_id: string;
  readonly actor: CollaborationActor;
}

function base64UrlEncodeUtf8(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function base64UrlDecodeUtf8(text: string): string | null {
  try {
    const padded = text.replace(/-/gu, '+').replace(/_/gu, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    return null;
  }
}

export function parseVerifiedIdentity(value: unknown): VerifiedIdentity | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  const canvasId = CollaborationCanvasIdSchema.safeParse(record.canvas_id);
  const actor = CollaborationActorSchema.safeParse(record.actor);
  if (!canvasId.success || !actor.success) return null;
  return {
    canvas_id: canvasId.data,
    actor: {
      actor_id: actor.data.actor_id,
      display_name: actor.data.display_name,
      ...(actor.data.color === undefined ? {} : { color: actor.data.color }),
    },
  };
}

export function encodeVerifiedIdentity(identity: VerifiedIdentity): string {
  const parsed = parseVerifiedIdentity(identity);
  if (parsed === null) throw new TypeError('Verified identity is invalid');
  return base64UrlEncodeUtf8(JSON.stringify(parsed));
}

export function decodeVerifiedIdentity(value: string | null): VerifiedIdentity | null {
  if (value === null || value.length === 0 || value.length > 2_048) return null;
  const json = base64UrlDecodeUtf8(value);
  if (json === null) return null;
  try {
    return parseVerifiedIdentity(JSON.parse(json));
  } catch {
    return null;
  }
}
