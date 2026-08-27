import {
  runFailureRecoveryCopy,
  type MustBeViralRestClient,
  type P0OperationData,
  type RunFailureRecoveryCopy,
} from '@mustbeviral/contracts';

import { quoteIsExpired, type QuoteConfirmResult, type RunQuote } from '../quote/quote-port';

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
  readonly recovery: RunFailureRecoveryCopy | null;
}

export type RunPortResult =
  | { readonly type: 'ok'; readonly snapshot: RunSnapshot }
  | { readonly type: 'conflict'; readonly actual_state: RunState }
  | { readonly type: 'not_found'; readonly run_id: string }
  | { readonly type: 'forbidden' }
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
          retryable: error.retryable,
          request_id: error.request_id,
        };
      }
      return {
        type: 'ok',
        runId: result.data.run.runId,
        acceptedMaximumMicros: input.quote.totalMicros,
      };
    } catch {
      return {
        type: 'error',
        message: 'Core could not start this run.',
        retryable: true,
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

function failedNodeRecovery(data: P0OperationData<'get_run'>): RunFailureRecoveryCopy | null {
  const failed = data.nodes.filter((node) => node.status === 'failed');
  if (failed.length === 0) return null;
  const policy = failed.find((node) => node.providerErrorCode === 'content_policy_violation');
  return runFailureRecoveryCopy(policy?.providerErrorCode ?? failed[0]?.providerErrorCode);
}

function nodeDetail(node: P0OperationData<'get_run'>['nodes'][number]): string {
  if (node.status === 'failed') {
    return runFailureRecoveryCopy(node.providerErrorCode).attemptDetail;
  }
  return `Dispatch wave ${String(node.dispatchWave)} · ${node.status.replaceAll('_', ' ')}`;
}

function runSnapshot(data: P0OperationData<'get_run'>): RunSnapshot {
  const attempts = data.nodes.map((node) => ({
    id: node.runNodeId,
    node: node.nodeKey,
    provider: node.modelRouteId ?? 'Core route',
    state: runAttemptState(node.status),
    detail: nodeDetail(node),
  }));
  return {
    runId: data.run.runId,
    revision: data.run.canvasRevisionId,
    sequence: 0,
    state: runState(data),
    firstReviewable: attempts.some((attempt) => attempt.state === 'complete'),
    attempts,
    recovery: failedNodeRecovery(data),
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
    } catch {
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
    } catch {
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
  return {
    runId: 'run-lumen-0007',
    revision: '7f3a',
    sequence,
    state: failed
      ? 'failed'
      : completeCount === attempts.length
        ? 'complete'
        : completeCount > 0
          ? 'reviewable'
          : 'running',
    firstReviewable: completeCount > 0,
    attempts,
    recovery: failed ? runFailureRecoveryCopy('content_policy_violation') : null,
  };
}

export class InMemoryRunPort implements RunPort {
  #snapshot = snapshotFor(0, fixtureFrames[0]);
  readonly #listeners = new Set<(snapshot: RunSnapshot) => void>();
  readonly #scenario: 'normal' | 'failed';

  constructor(scenario: 'normal' | 'failed' = 'normal') {
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
      this.#scenario === 'failed' && nextIndex === 2
        ? fixtureFrame.map((attempt) =>
            attempt.id === 'motion'
              ? {
                  ...attempt,
                  state: 'failed' as const,
                  detail: runFailureRecoveryCopy('content_policy_violation').attemptDetail,
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
