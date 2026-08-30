import {
  classifyProviderErrorCode,
  runFailureRecoveryCopy,
  runFailureRecoveryCopyForKind,
  type MustBeViralRestClient,
  type P0OperationData,
} from '@mustbeviral/contracts';

import { quoteIsExpired, type QuoteConfirmResult, type RunQuote } from '../quote/quote-port';
import {
  SESSION_EXPIRED_RESULT,
  isSessionExpiredFailure,
  type SessionExpiredResult,
} from '../../lib/core/session-expiry';
import {
  runRecoveryView,
  runSettlementView,
  type RunRecoveryView,
  type RunSettlementView,
} from './run-recovery';

export type RunAttemptState =
  'queued' | 'running' | 'complete' | 'failed' | 'cancelled' | 'skipped' | 'reconciliation';

export interface RunAttempt {
  readonly id: string;
  readonly node: string;
  readonly provider: string;
  readonly state: RunAttemptState;
  readonly detail: string;
}

export type RunState =
  'running' | 'reviewable' | 'complete' | 'failed' | 'cancelled' | 'reconciliation_required';

export interface RunSnapshot {
  readonly runId: string;
  readonly revision: string;
  readonly sequence: number;
  readonly state: RunState;
  readonly firstReviewable: boolean;
  readonly attempts: readonly RunAttempt[];
  readonly recovery: RunRecoveryView | null;
  readonly settlement: RunSettlementView | null;
}

export type RunPortResult =
  | { readonly type: 'ok'; readonly snapshot: RunSnapshot }
  | { readonly type: 'conflict'; readonly actual_state: RunState }
  | { readonly type: 'not_found'; readonly run_id: string }
  | { readonly type: 'forbidden' }
  | SessionExpiredResult
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export interface RunStartPort {
  confirm(
    input: Readonly<{ quote: RunQuote; acknowledged: boolean; nowMs: number }>,
  ): Promise<QuoteConfirmResult>;
}

export interface RunReadPort {
  read(runId: string): Promise<RunPortResult>;
  cancel(runId: string): Promise<RunPortResult>;
}

export interface RunPort {
  read(runId: string): RunPortResult;
  advance(runId: string, expectedSequence: number): RunPortResult;
  cancel(runId: string, expectedSequence: number): RunPortResult;
  subscribe(listener: (snapshot: RunSnapshot) => void): () => void;
}

function detailString(details: Readonly<Record<string, unknown>> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function detailMicros(
  details: Readonly<Record<string, unknown>> | undefined,
  key: string,
  fallback: bigint,
) {
  const value = detailString(details, key);
  return value !== undefined && /^\d+$/u.test(value) ? BigInt(value) : fallback;
}

export class WorkerRunStartPort implements RunStartPort {
  readonly #idempotencyKeys = new Map<string, string>();

  constructor(
    private readonly client: MustBeViralRestClient,
    private readonly createIdempotencyKey: () => string,
  ) {}

  async confirm(
    input: Readonly<{ quote: RunQuote; acknowledged: boolean; nowMs: number }>,
  ): Promise<QuoteConfirmResult> {
    if (!input.acknowledged) throw new Error('Explicit quote acknowledgment is required.');
    if (quoteIsExpired(input.quote.expiresAtMs, input.nowMs)) {
      return { type: 'expired_quote', expiredAtMs: input.quote.expiresAtMs };
    }
    try {
      const result = await this.client.request('start_run', {
        id: input.quote.id,
        idempotencyKey: this.#idempotencyKey(input.quote.id),
        body: { confirmed: true, confirmation_token: input.quote.confirmationToken },
      });
      if ('error' in result) {
        const { error } = result;
        if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
        if (error.code === 'QUOTE_EXPIRED') {
          const expiredAt = detailString(error.details, 'expired_at');
          return {
            type: 'expired_quote',
            expiredAtMs: expiredAt === undefined ? input.quote.expiresAtMs : Date.parse(expiredAt),
          };
        }
        if (error.code === 'BUDGET_EXCEEDED' || error.code === 'INSUFFICIENT_BALANCE') {
          return {
            type: 'cap_exceeded',
            capMicros: detailMicros(
              error.details,
              error.code === 'INSUFFICIENT_BALANCE' ? 'available_micros' : 'cap_micros',
              input.quote.runCapMicros,
            ),
            attemptedMicros: detailMicros(
              error.details,
              'requested_micros',
              input.quote.totalMicros,
            ),
            explanation:
              'The authoritative reservation caps changed after this quote. No provider work was submitted and no spend was accepted.',
          };
        }
        if (
          error.code === 'QUOTE_STALE' ||
          error.code === 'REVISION_CONFLICT' ||
          error.code === 'IDEMPOTENCY_CONFLICT'
        ) {
          return {
            type: 'conflict',
            expected_revision_id: input.quote.revision,
            actual_revision_id: detailString(error.details, 'actual') ?? 'current revision',
          };
        }
        if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
        if (error.code === 'NOT_FOUND') return { type: 'not_found', quote_id: input.quote.id };
        return {
          type: 'error',
          message: error.message,
          retryable: false,
          request_id: error.request_id,
        };
      }
      return {
        type: 'ok',
        runId: result.data.run.runId,
        acceptedMaximumMicros: input.quote.totalMicros,
      };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return {
        type: 'reconciliation_required',
        quoteId: input.quote.id,
        message:
          'Core did not return an authoritative confirmation result. Do not submit this paid operation again until its idempotency receipt is reconciled.',
      };
    }
  }

  #idempotencyKey(quoteId: string): string {
    const existing = this.#idempotencyKeys.get(quoteId);
    if (existing !== undefined) return existing;
    const created = this.createIdempotencyKey();
    this.#idempotencyKeys.set(quoteId, created);
    return created;
  }
}

function runAttemptState(status: P0OperationData<'get_run'>['nodes'][number]['status']) {
  if (status === 'succeeded') return 'complete' as const;
  if (status === 'failed') return 'failed' as const;
  if (status === 'canceled') return 'cancelled' as const;
  if (status === 'skipped') return 'skipped' as const;
  if (status === 'reconciliation_required') return 'reconciliation' as const;
  if (status === 'running') return 'running' as const;
  return 'queued' as const;
}

function runState(data: P0OperationData<'get_run'>): RunState {
  if (data.run.status === 'succeeded') return 'complete';
  if (data.run.status === 'failed') return 'failed';
  if (data.run.status === 'canceled') return 'cancelled';
  if (data.run.status === 'reconciliation_required') return 'reconciliation_required';
  if (
    data.run.status === 'partial_succeeded' ||
    data.nodes.some((node) => node.status === 'succeeded')
  ) {
    return 'reviewable';
  }
  return 'running';
}

function visibleRunState(status: string): RunState {
  if (status === 'succeeded') return 'complete';
  if (status === 'failed') return 'failed';
  if (status === 'canceled') return 'cancelled';
  if (status === 'partial_succeeded') return 'reviewable';
  if (status === 'reconciliation_required') return 'reconciliation_required';
  return 'running';
}

function nodeDetail(
  data: P0OperationData<'get_run'>,
  node: P0OperationData<'get_run'>['nodes'][number],
): string {
  if (node.status === 'failed' || node.status === 'reconciliation_required') {
    const kind =
      (data.recovery?.affectedNodeKeys.includes(node.nodeKey) ? data.recovery.kind : undefined) ??
      (node.status === 'reconciliation_required'
        ? 'ambiguous'
        : classifyProviderErrorCode(node.providerErrorCode));
    return runFailureRecoveryCopyForKind(kind).attemptDetail;
  }
  return `Dispatch wave ${String(node.dispatchWave)} · ${node.status.replaceAll('_', ' ')}`;
}

function runSnapshot(data: P0OperationData<'get_run'>): RunSnapshot {
  const attempts = data.nodes.map((node) => ({
    id: node.runNodeId,
    node: node.nodeKey,
    provider: node.modelRouteId ?? 'Core route',
    state: runAttemptState(node.status),
    detail: nodeDetail(data, node),
  }));
  return {
    runId: data.run.runId,
    revision: data.run.canvasRevisionId,
    sequence: 0,
    state: runState(data),
    firstReviewable: attempts.some((attempt) => attempt.state === 'complete'),
    attempts,
    recovery: runRecoveryView(data),
    settlement: runSettlementView(data),
  };
}

export class WorkerRunPort implements RunReadPort {
  readonly #cancelIdempotencyKeys = new Map<string, string>();

  constructor(
    private readonly client: MustBeViralRestClient,
    private readonly createIdempotencyKey: () => string,
  ) {}

  async read(runId: string): Promise<RunPortResult> {
    try {
      const result = await this.client.request('get_run', { id: runId });
      if ('error' in result) return this.#mapError(result.error, runId);
      return { type: 'ok', snapshot: runSnapshot(result.data) };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return { type: 'error', message: 'Core could not read this run.', retryable: true };
    }
  }

  async cancel(runId: string): Promise<RunPortResult> {
    try {
      const result = await this.client.request('cancel_run', {
        id: runId,
        idempotencyKey: this.#cancelIdempotencyKey(runId),
        body: { reason: 'Canceled from Studio run progress' },
      });
      if ('error' in result) return this.#mapError(result.error, runId);
      return this.read(runId);
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return { type: 'error', message: 'Core could not cancel this run.', retryable: true };
    }
  }

  #mapError(
    error: Readonly<{
      code: string;
      message: string;
      request_id: string;
      retryable: boolean;
      details?: Readonly<Record<string, unknown>> | undefined;
    }>,
    runId: string,
  ): RunPortResult {
    if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
    if (error.code === 'NOT_FOUND') return { type: 'not_found', run_id: runId };
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'RUN_NOT_CANCELABLE') {
      return {
        type: 'conflict',
        actual_state: visibleRunState(detailString(error.details, 'actual') ?? 'running'),
      };
    }
    return {
      type: 'error',
      message: error.message,
      retryable: error.retryable,
      request_id: error.request_id,
    };
  }

  #cancelIdempotencyKey(runId: string): string {
    const existing = this.#cancelIdempotencyKeys.get(runId);
    if (existing !== undefined) return existing;
    const created = this.createIdempotencyKey();
    this.#cancelIdempotencyKeys.set(runId, created);
    return created;
  }
}

const fixtureFrames = [
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'running',
      detail: 'Reasoning route pinned',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'queued',
      detail: '3 variants queued',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'queued',
      detail: '3 sets queued',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'queued',
      detail: '6 second render queued',
    },
  ],
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: 'Approved route produced',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'running',
      detail: 'Variant 2 of 3',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'running',
      detail: 'Set 1 reviewable',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'queued',
      detail: 'Waiting on hero asset',
    },
  ],
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: 'Approved route produced',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'complete',
      detail: '3 variants reviewable',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: '3 sets reviewable',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'running',
      detail: 'Rendering frame 96 of 144',
    },
  ],
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: 'Approved route produced',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'complete',
      detail: '3 variants reviewable',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: '3 sets reviewable',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'complete',
      detail: '6 second render reviewable',
    },
  ],
] as const satisfies readonly (readonly RunAttempt[])[];

function snapshotFor(sequence: number, attempts: readonly RunAttempt[]): RunSnapshot {
  const completeCount = attempts.filter((attempt) => attempt.state === 'complete').length;
  const failed = attempts.some((attempt) => attempt.state === 'failed');
  const reconciliation = attempts.some((attempt) => attempt.state === 'reconciliation');
  const recoveryKind = reconciliation ? 'ambiguous' : 'content_policy_violation';
  return {
    runId: 'run-lumen-0007',
    revision: '7f3a',
    sequence,
    state: reconciliation
      ? 'reconciliation_required'
      : failed
        ? 'failed'
        : completeCount === attempts.length
          ? 'complete'
          : completeCount > 0
            ? 'reviewable'
            : 'running',
    firstReviewable: completeCount > 0,
    attempts,
    recovery:
      failed || reconciliation
        ? {
            ...runFailureRecoveryCopyForKind(recoveryKind),
            state: reconciliation ? 'reconciliation_required' : 'failed',
            affectedNodes: attempts
              .filter((attempt) => attempt.state === 'failed' || attempt.state === 'reconciliation')
              .map((attempt) => ({
                runNodeId: attempt.id,
                nodeKey: attempt.node,
                state:
                  attempt.state === 'reconciliation'
                    ? ('reconciliation_required' as const)
                    : ('failed' as const),
                kind: recoveryKind,
              })),
            retainedRunNodeIds: attempts
              .filter((attempt) => attempt.state === 'complete')
              .map((attempt) => attempt.id),
          }
        : null,
    settlement: {
      reservationMicros: 4_200_000n,
      capturedMicros:
        failed || reconciliation
          ? 2_800_000n
          : sequence === fixtureFrames.length - 1
            ? 4_200_000n
            : 0n,
      releasedMicros: failed ? 1_400_000n : 0n,
      refundedMicros: 0n,
      netMicros:
        failed || reconciliation
          ? 2_800_000n
          : sequence === fixtureFrames.length - 1
            ? 4_200_000n
            : 0n,
      pendingMicros:
        failed || sequence === fixtureFrames.length - 1
          ? 0n
          : reconciliation
            ? 1_400_000n
            : 4_200_000n,
      settlementStatus:
        failed || reconciliation
          ? 'partially_captured'
          : sequence === fixtureFrames.length - 1
            ? 'captured'
            : 'active',
    },
  };
}

export class InMemoryRunPort implements RunPort {
  #snapshot = snapshotFor(0, fixtureFrames[0]);
  readonly #listeners = new Set<(snapshot: RunSnapshot) => void>();
  readonly #scenario: 'normal' | 'failed' | 'reconciliation';

  constructor(scenario: 'normal' | 'failed' | 'reconciliation' = 'normal') {
    this.#scenario = scenario;
  }

  read(runId: string): RunPortResult {
    return runId === this.#snapshot.runId
      ? { type: 'ok', snapshot: this.#snapshot }
      : { type: 'not_found', run_id: runId };
  }

  advance(runId: string, expectedSequence: number): RunPortResult {
    const current = this.read(runId);
    if (current.type !== 'ok') return current;
    if (expectedSequence !== current.snapshot.sequence || current.snapshot.state === 'cancelled') {
      return { type: 'conflict', actual_state: current.snapshot.state };
    }
    const nextIndex = Math.min(current.snapshot.sequence + 1, fixtureFrames.length - 1);
    const fixtureFrame = fixtureFrames[nextIndex] ?? fixtureFrames[0];
    const nextAttempts =
      this.#scenario !== 'normal' && nextIndex === 2
        ? fixtureFrame.map((attempt) =>
            attempt.id === 'motion'
              ? {
                  ...attempt,
                  state:
                    this.#scenario === 'reconciliation'
                      ? ('reconciliation' as const)
                      : ('failed' as const),
                  detail:
                    this.#scenario === 'reconciliation'
                      ? runFailureRecoveryCopyForKind('ambiguous').attemptDetail
                      : runFailureRecoveryCopy('content_policy_violation').attemptDetail,
                }
              : attempt,
          )
        : fixtureFrame;
    this.#snapshot = snapshotFor(nextIndex, nextAttempts);
    this.#emit();
    return { type: 'ok', snapshot: this.#snapshot };
  }

  cancel(runId: string, expectedSequence: number): RunPortResult {
    const current = this.read(runId);
    if (current.type !== 'ok') return current;
    if (expectedSequence !== current.snapshot.sequence || current.snapshot.state === 'complete') {
      return { type: 'conflict', actual_state: current.snapshot.state };
    }
    this.#snapshot = {
      ...current.snapshot,
      sequence: current.snapshot.sequence + 1,
      state: 'cancelled',
      attempts: current.snapshot.attempts.map((attempt) =>
        attempt.state === 'queued' || attempt.state === 'running'
          ? {
              ...attempt,
              state: 'cancelled' as const,
              detail: 'Cancelled before provider completion',
            }
          : attempt,
      ),
      settlement:
        current.snapshot.settlement === null
          ? null
          : {
              ...current.snapshot.settlement,
              releasedMicros:
                current.snapshot.settlement.reservationMicros -
                current.snapshot.settlement.capturedMicros,
              pendingMicros: 0n,
              settlementStatus:
                current.snapshot.settlement.capturedMicros === 0n
                  ? 'released'
                  : 'partially_captured',
            },
    };
    this.#emit();
    return { type: 'ok', snapshot: this.#snapshot };
  }

  subscribe(listener: (snapshot: RunSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener(this.#snapshot);
  }
}
