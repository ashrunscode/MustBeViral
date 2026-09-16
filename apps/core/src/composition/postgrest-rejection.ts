// PostgREST answers 400 for invalid input (SQLSTATE class 22, 23502, P0001 raised by an RPC, and
// request errors such as PGRST100) and 409 for unique and foreign-key violations. Sending the same
// request again fails the same way. 422 is kept as permanent too, although PostgREST 14 was not
// observed returning it. Every other failure is treated as unavailable: 402 (a restricted project),
// 404 (the RPC is missing: a Worker deployed ahead of its migration, or a stale schema cache), 405
// (SQLSTATE 25006, a read-only database), 408, 425 and 429 (timing and rate limits), and 5xx (lock
// and statement timeouts, serialization retries that time out as 504, and P0002 raised by an RPC,
// which clears on retry only when the missing row can still appear).
const PERMANENT_REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 409, 422]);

// SQLSTATE 0A000 also answers 400, but an RPC raises it when a newer migration retires it, which
// clears once the Worker that matches the migration is deployed.
const RETIRED_RPC_CODE = '0A000';

const SAFE_ERROR_CODE = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/u;

// RPCs raise fixed upper-case reason tokens such as STRIPE_EVENT_WORKSPACE_MISMATCH. Free-text
// messages and details are never kept: they can echo row values.
const SAFE_REASON = /^[A-Z][A-Z0-9_]{2,62}$/u;

export interface PostgrestRejection {
  readonly code: string;
  readonly reason: string | undefined;
}

/**
 * Returns the error code and reason token of a failure that sending the same request again cannot
 * fix, or null for any other response. Only a 400, 409 or 422 body is read. PostgREST always sends
 * a SQLSTATE or PGRST code, so a body without a well-formed one (for example a proxy error page) is
 * not treated as permanent, and neither is SQLSTATE 0A000.
 */
export async function readPermanentRejection(
  response: Response,
): Promise<PostgrestRejection | null> {
  if (!PERMANENT_REJECTION_STATUSES.has(response.status)) return null;

  let body: Readonly<{ code?: unknown; message?: unknown }> | null = null;
  try {
    body = (await response.json()) as Readonly<{ code?: unknown; message?: unknown }> | null;
  } catch {
    body = null;
  }
  const code = body?.code;
  if (typeof code !== 'string' || !SAFE_ERROR_CODE.test(code) || code === RETIRED_RPC_CODE) {
    return null;
  }
  const reason =
    typeof body?.message === 'string' && SAFE_REASON.test(body.message) ? body.message : undefined;
  return { code, reason };
}
