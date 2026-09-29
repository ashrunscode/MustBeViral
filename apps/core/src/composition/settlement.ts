import {
  captureLedgerMovement,
  refundLedgerMovement,
  releaseLedgerMovement,
  usdMicros,
  usdMicrosToSafeInteger,
  type LedgerMovementDraft,
  type UsdMicros,
} from '../../../../packages/billing/src/index';

import type { CoreBindings } from '../bindings';

export interface SettlementMovementInput {
  readonly workspaceId: string;
  readonly runId: string;
  readonly reservationId: string;
  readonly amountMicros: UsdMicros;
  readonly causativeKey: string;
  readonly requestId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CaptureSettlementInput extends SettlementMovementInput {
  /** Authoritative remaining reservation observed by the settlement command before persistence. */
  readonly reservationRemainingMicros: UsdMicros;
}

export interface SettlementResult {
  readonly transactionId: string;
  readonly replayed: boolean;
}

export interface PrivilegedSettlementPort {
  capture(input: CaptureSettlementInput): Promise<SettlementResult>;
  release(input: SettlementMovementInput): Promise<SettlementResult>;
  refund(input: SettlementMovementInput): Promise<SettlementResult>;
}

export class SettlementPortError extends Error {
  override readonly name = 'SettlementPortError';

  constructor(
    readonly reason: 'settlement_unavailable' | 'settlement_forbidden',
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(
      reason === 'settlement_forbidden'
        ? 'Settlement persistence rejected the privileged credential'
        : 'Settlement persistence is unavailable',
      options,
    );
  }
}

function unavailable(cause?: unknown): SettlementPortError {
  return new SettlementPortError(
    'settlement_unavailable',
    true,
    cause === undefined ? undefined : { cause },
  );
}

function settlementResult(value: unknown): SettlementResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw unavailable();
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (typeof record.transaction_id !== 'string' || typeof record.replayed !== 'boolean') {
    throw unavailable();
  }
  return Object.freeze({
    transactionId: record.transaction_id,
    replayed: record.replayed,
  });
}

function rpcBody(
  workspaceId: string,
  movement: LedgerMovementDraft,
): Readonly<Record<string, unknown>> {
  return {
    p_workspace_id: workspaceId,
    p_entry_type: movement.entryType,
    p_amount_micros: usdMicrosToSafeInteger(movement.amountMicros),
    p_causative_key: movement.causativeKey,
    p_reservation_id: movement.reservationId,
    p_run_id: movement.runId,
    p_request_id: movement.requestId,
    p_metadata: movement.metadata,
  };
}

/**
 * Creates a dedicated machine-only settlement surface.
 *
 * This factory is intentionally separate from caller-scoped request dependencies. It sends the
 * privileged key only as `apikey` to the single semantic-ledger RPC.
 */
export function createPrivilegedSettlementPort(
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): PrivilegedSettlementPort {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const boundFetch = fetchImplementation ?? ((input, init) => fetch(input, init));

  async function persist(workspaceId: string, movement: LedgerMovementDraft) {
    if (!baseUrl || !privilegedKey) throw unavailable();

    let response: Response;
    try {
      response = await boundFetch(`${baseUrl}/rest/v1/rpc/record_ledger_movement`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: privilegedKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(rpcBody(workspaceId, movement)),
      });
    } catch (cause) {
      throw unavailable(cause);
    }

    if (response.status === 401 || response.status === 403) {
      throw new SettlementPortError('settlement_forbidden', false);
    }
    if (!response.ok) throw unavailable();

    try {
      return settlementResult((await response.json()) as unknown);
    } catch (cause) {
      if (cause instanceof SettlementPortError) throw cause;
      throw unavailable(cause);
    }
  }

  return {
    async capture(input) {
      usdMicros(input.reservationRemainingMicros);
      if (input.amountMicros > input.reservationRemainingMicros) {
        throw new RangeError('Capture exceeds the remaining reservation');
      }
      return await persist(
        input.workspaceId,
        captureLedgerMovement({
          amountMicros: input.amountMicros,
          causativeKey: input.causativeKey,
          requestId: input.requestId,
          reservationId: input.reservationId,
          runId: input.runId,
          metadata: input.metadata,
        }),
      );
    },
    async release(input) {
      return await persist(
        input.workspaceId,
        releaseLedgerMovement({
          amountMicros: input.amountMicros,
          causativeKey: input.causativeKey,
          requestId: input.requestId,
          reservationId: input.reservationId,
          runId: input.runId,
          metadata: input.metadata,
        }),
      );
    },
    async refund(input) {
      return await persist(
        input.workspaceId,
        refundLedgerMovement({
          amountMicros: input.amountMicros,
          causativeKey: input.causativeKey,
          requestId: input.requestId,
          reservationId: input.reservationId,
          runId: input.runId,
          metadata: input.metadata,
        }),
      );
    },
  };
}
