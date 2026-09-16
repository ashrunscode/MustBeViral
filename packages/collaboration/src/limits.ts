/**
 * Hard limits for live collaboration. The collaboration Worker enforces every one of them and
 * rejects over-limit input with a typed error; nothing is truncated. The rationale for each value is
 * recorded in `docs/architecture/DATA_AUTH_AND_TENANCY.md`.
 *
 * Character limits count UTF-16 code units, which is what `String.length` and the protocol schemas
 * measure. Byte limits count UTF-8 bytes of the JSON the Worker stores and sends.
 */

const KIB = 1_024;

/** Node ids, anchor node ids, comment ids, revision ids and client request ids. */
export const COLLABORATION_ID_MAX_LENGTH = 128;
/** Draft field paths such as `parameters.prompt`. */
export const COLLABORATION_FIELD_PATH_MAX_LENGTH = 128;
/** A review note, roughly 600 words. */
export const COLLABORATION_COMMENT_BODY_MAX_LENGTH = 4_000;
/** A drafted node parameter such as a generation prompt or configuration notes. */
export const COLLABORATION_TEXT_DRAFT_BODY_MAX_LENGTH = 4_000;
/** Draft ids a checkpoint may clear in one message; equal to the per-canvas draft cap. */
export const COLLABORATION_CLEAR_DRAFT_IDS_MAX_ITEMS = 64;

/**
 * `JSON.stringify` writes at most six characters per UTF-16 code unit (`\u0001`), so these are the
 * longest keys `textDraftKey` and `leaseIdForActor` can produce from ids within their limits.
 */
const MAX_JSON_CHARACTERS_PER_CODE_UNIT = 6;
export const COLLABORATION_TEXT_DRAFT_ID_MAX_LENGTH =
  '["",""]'.length +
  MAX_JSON_CHARACTERS_PER_CODE_UNIT *
    (COLLABORATION_ID_MAX_LENGTH + COLLABORATION_FIELD_PATH_MAX_LENGTH);
/** Actor ids share the id limit (`CollaborationActorSchema.actor_id`). */
export const COLLABORATION_LEASE_ID_MAX_LENGTH =
  '["lease","",""]'.length +
  MAX_JSON_CHARACTERS_PER_CODE_UNIT * (COLLABORATION_ID_MAX_LENGTH + COLLABORATION_ID_MAX_LENGTH);

/**
 * Largest client message the Worker parses, checked before JSON parsing. A comment or text draft at
 * its field limits stays under 28 KiB even when every character JSON-escapes to six bytes, and a
 * checkpoint clear of 64 drafts with ASCII ids at their limits is about 17 KiB. Only a clear whose
 * ids are near their limits and escape-heavy can exceed it; that message is refused as too large.
 */
export const COLLABORATION_CLIENT_MESSAGE_MAX_BYTES = 32 * KIB;

/** Row caps per canvas and per actor within a canvas. */
export const COLLABORATION_COMMENTS_MAX_PER_CANVAS = 200;
export const COLLABORATION_COMMENTS_MAX_PER_ACTOR = 50;
export const COLLABORATION_TEXT_DRAFTS_MAX_PER_CANVAS = 64;
export const COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR = 32;
export const COLLABORATION_LEASES_MAX_PER_CANVAS = 32;
export const COLLABORATION_LEASES_MAX_PER_ACTOR = 4;
export const COLLABORATION_PRESENCE_MAX_PER_CANVAS = 32;
export const COLLABORATION_SOCKETS_MAX_PER_CANVAS = 64;
export const COLLABORATION_SOCKETS_MAX_PER_ACTOR = 4;

/**
 * Byte budgets for each snapshot section: the UTF-8 length of every stored row's JSON. A write that
 * would take a section over its budget is rejected, so a snapshot can never exceed the ceiling below.
 */
export const COLLABORATION_COMMENTS_MAX_BYTES = 192 * KIB;
export const COLLABORATION_TEXT_DRAFTS_MAX_BYTES = 192 * KIB;
export const COLLABORATION_LEASES_MAX_BYTES = 64 * KIB;
export const COLLABORATION_PRESENCE_MAX_BYTES = 48 * KIB;

/**
 * Ceiling for one encoded snapshot message. The section budgets add up to 496 KiB, and the envelope,
 * canvas id and separators add under 2 KiB. Workers accept WebSocket messages up to 32 MiB; this
 * stays at a sixty-fourth of that, and under the earlier 1 MiB limit, to bound broadcast fan-out.
 */
export const COLLABORATION_SNAPSHOT_MAX_BYTES = 512 * KIB;

/**
 * Longest a WebSocket stays open. The object closes it with `SESSION_EXPIRED` no later than this
 * many seconds after Core issued the ticket that opened it, so the client must ask Core for a new
 * ticket, and Core re-checks membership and canvas access.
 */
export const COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS = 600;

export const COLLABORATION_CLOSE_CODES = {
  /** The socket reached its maximum lifetime. Reconnect with a fresh ticket from Core. */
  SESSION_EXPIRED: 4401,
  /** No valid bound identity, or sustained abuse. Do not reconnect automatically. */
  POLICY_VIOLATION: 1008,
} as const;

export const COLLABORATION_ERROR_CODES = [
  'VALIDATION_FAILED',
  'FIELD_TOO_LARGE',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'CANVAS_LIMIT_REACHED',
  'SNAPSHOT_TOO_LARGE',
  'FORBIDDEN',
  'NOT_FOUND',
] as const;

export type CollaborationErrorCode = (typeof COLLABORATION_ERROR_CODES)[number];

export type CollaborationLimitedResource =
  'comments' | 'text_drafts' | 'leases' | 'presence' | 'sockets';

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
