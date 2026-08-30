import type { MustBeViralRestClient, P0OperationData } from '@mustbeviral/contracts';

import {
  SESSION_EXPIRED_RESULT,
  isSessionExpiredFailure,
  type SessionExpiredResult,
} from '../../lib/core/session-expiry';

export interface QuoteLineItem {
  readonly id: string;
  readonly node: string;
  readonly basis: string;
  readonly amountMicros: bigint;
}

export interface RunQuote {
  readonly id: string;
  readonly revision: string;
  readonly route: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly lineItems: readonly QuoteLineItem[];
  readonly totalMicros: bigint;
  readonly runCapMicros: bigint;
  readonly workspaceDayCapMicros: bigint;
  readonly workspaceDayUsedMicros: bigint;
  readonly confirmationToken: string;
}

export type QuoteReadResult =
  | { readonly type: 'ok'; readonly quote: RunQuote }
  | {
      readonly type: 'conflict';
      readonly expected_revision_id: string;
      readonly actual_revision_id: string;
    }
  | { readonly type: 'graph_invalid'; readonly message: string }
  | { readonly type: 'forbidden' }
  | SessionExpiredResult
  | { readonly type: 'not_found'; readonly canvas_id: string }
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export interface QuoteReadPort {
  read(): Promise<QuoteReadResult>;
  requote(): Promise<QuoteReadResult>;
}

export type QuoteConfirmResult =
  | { readonly type: 'ok'; readonly runId: string; readonly acceptedMaximumMicros: bigint }
  | {
      readonly type: 'reconciliation_required';
      readonly quoteId: string;
      readonly message: string;
    }
  | { readonly type: 'expired_quote'; readonly expiredAtMs: number }
  | {
      readonly type: 'cap_exceeded';
      readonly capMicros: bigint;
      readonly attemptedMicros: bigint;
      readonly explanation: string;
    }
  | {
      readonly type: 'conflict';
      readonly expected_revision_id: string;
      readonly actual_revision_id: string;
    }
  | { readonly type: 'forbidden' }
  | SessionExpiredResult
  | { readonly type: 'not_found'; readonly quote_id: string }
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export interface QuotePort {
  read(nowMs?: number): RunQuote;
  confirm(
    input: Readonly<{ quote: RunQuote; acknowledged: boolean; nowMs: number }>,
  ): Promise<QuoteConfirmResult>;
  requote(nowMs?: number): Promise<RunQuote>;
}

export type QuotePortScenario = 'ok' | 'expired_quote' | 'cap_exceeded' | 'conflict';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const goldenLineItems: readonly QuoteLineItem[] = [
  { id: 'concept', node: 'Concept logic', basis: 'kimi-2.6', amountMicros: 1_200_000n },
  { id: 'assets', node: 'Asset gen x3', basis: 'flux-2-klein', amountMicros: 2_400_000n },
  { id: 'copy', node: 'Copy', basis: '3 sets', amountMicros: 240_000n },
  {
    id: 'motion',
    node: 'Motion seedance-1.0 6s',
    basis: '9:16',
    amountMicros: 360_000n,
  },
];

export function createGoldenQuote(nowMs = Date.now()): RunQuote {
  const totalMicros = goldenLineItems.reduce((total, item) => total + item.amountMicros, 0n);
  return {
    id: `quote-7f3a-${String(nowMs)}`,
    revision: '7f3a',
    route: 'kimi-2.6 + flux-2-klein + seedance-1.0',
    createdAtMs: nowMs,
    expiresAtMs: nowMs + FIFTEEN_MINUTES_MS,
    lineItems: goldenLineItems,
    totalMicros,
    runCapMicros: 8_000_000n,
    workspaceDayCapMicros: 100_000_000n,
    workspaceDayUsedMicros: 18_420_000n,
    confirmationToken: 'fixture-confirmation-token',
  };
}

function detailString(details: Readonly<Record<string, unknown>> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function quoteFromData(data: P0OperationData<'quote_run'>): RunQuote {
  const route = [
    ...new Set(data.quote.nodeLines.map(({ providerModelId }) => providerModelId)),
  ].join(' + ');
  return {
    id: data.quote.quoteId,
    revision: data.quote.canvasRevisionId,
    route,
    createdAtMs: Date.parse(data.quote.createdAt),
    expiresAtMs: Date.parse(data.quote.expiresAt),
    lineItems: data.quote.nodeLines.map((line) => ({
      id: line.nodeId,
      node: line.nodeId,
      basis: line.priceComponents
        .map((component) => `${component.quantity} ${component.unit.replaceAll('_', ' ')}`)
        .join(' + '),
      amountMicros: BigInt(line.totalMicros),
    })),
    totalMicros: BigInt(data.quote.maximumChargeMicros),
    runCapMicros: BigInt(data.spend.runCapMicros),
    workspaceDayCapMicros: BigInt(data.spend.workspaceDayCapMicros),
    workspaceDayUsedMicros: BigInt(data.spend.workspaceDayExposureMicros),
    confirmationToken: data.confirmationToken,
  };
}

export class WorkerQuotePort implements QuoteReadPort {
  #pending: Promise<QuoteReadResult> | null = null;

  constructor(
    private readonly client: MustBeViralRestClient,
    private readonly canvasId: string,
    private readonly expectedRevisionId: string | undefined,
    private readonly createIdempotencyKey: () => string,
  ) {}

  read(): Promise<QuoteReadResult> {
    this.#pending ??= this.#createQuote();
    return this.#pending;
  }

  requote(): Promise<QuoteReadResult> {
    this.#pending = this.#createQuote();
    return this.#pending;
  }

  async #createQuote(): Promise<QuoteReadResult> {
    try {
      let revision = this.expectedRevisionId;
      if (revision === undefined) {
        const context = await this.client.request('get_canvas_context', { id: this.canvasId });
        if ('error' in context) return this.#mapError(context.error, 'unknown revision');
        revision = context.data.canvas.headRevisionId;
      }
      const result = await this.client.request('quote_run', {
        id: this.canvasId,
        idempotencyKey: this.createIdempotencyKey(),
        body: { expected_revision_id: revision },
      });
      if ('error' in result) return this.#mapError(result.error, revision);
      return { type: 'ok', quote: quoteFromData(result.data) };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return {
        type: 'error',
        message: 'Core could not create a quote for this canvas.',
        retryable: true,
      };
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
    expectedRevisionId: string,
  ): QuoteReadResult {
    if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
    if (error.code === 'REVISION_CONFLICT') {
      return {
        type: 'conflict',
        expected_revision_id: expectedRevisionId,
        actual_revision_id: detailString(error.details, 'actual') ?? 'current revision',
      };
    }
    if (error.code === 'GRAPH_INVALID') {
      return { type: 'graph_invalid', message: error.message };
    }
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'NOT_FOUND') return { type: 'not_found', canvas_id: this.canvasId };
    return {
      type: 'error',
      message: error.message,
      retryable: error.retryable,
      request_id: error.request_id,
    };
  }
}

export function quoteSecondsRemaining(expiresAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

export function quoteIsExpired(expiresAtMs: number, nowMs: number): boolean {
  return quoteSecondsRemaining(expiresAtMs, nowMs) === 0;
}

export function formatQuoteCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function canConfirmQuote(
  input: Readonly<{
    acknowledged: boolean;
    confirmationAttempted: boolean;
    expiresAtMs: number;
    nowMs: number;
    pending: boolean;
  }>,
): boolean {
  return (
    input.acknowledged &&
    !input.confirmationAttempted &&
    !input.pending &&
    !quoteIsExpired(input.expiresAtMs, input.nowMs)
  );
}

export class InMemoryQuotePort implements QuotePort {
  readonly #scenario: QuotePortScenario;
  #quote: RunQuote;

  constructor(options: Readonly<{ nowMs?: number; scenario?: QuotePortScenario }> = {}) {
    this.#scenario = options.scenario ?? 'ok';
    this.#quote = createGoldenQuote(options.nowMs);
  }

  read(): RunQuote {
    return this.#quote;
  }

  async confirm(
    input: Readonly<{
      quote: RunQuote;
      acknowledged: boolean;
      nowMs: number;
    }>,
  ): Promise<QuoteConfirmResult> {
    if (!input.acknowledged) {
      throw new Error('Explicit quote acknowledgment is required.');
    }
    if (
      this.#scenario === 'expired_quote' ||
      quoteIsExpired(input.quote.expiresAtMs, input.nowMs)
    ) {
      return { type: 'expired_quote', expiredAtMs: input.quote.expiresAtMs };
    }
    if (this.#scenario === 'cap_exceeded') {
      return {
        type: 'cap_exceeded',
        capMicros: input.quote.runCapMicros,
        attemptedMicros: input.quote.totalMicros,
        explanation:
          'The workspace-day reservation changed after this quote. No provider work was submitted and no spend was accepted.',
      };
    }
    if (this.#scenario === 'conflict') {
      return {
        type: 'conflict',
        expected_revision_id: input.quote.revision,
        actual_revision_id: '81c2',
      };
    }
    return {
      type: 'ok',
      runId: 'run-lumen-0007',
      acceptedMaximumMicros: input.quote.totalMicros,
    };
  }

  async requote(nowMs = Date.now()): Promise<RunQuote> {
    this.#quote = createGoldenQuote(nowMs);
    return this.#quote;
  }
}
