export type ExportRowState = 'queued' | 'ready' | 'failed';

export interface ExportRow {
  readonly id: string;
  readonly label: string;
  readonly format: string;
  readonly state: ExportRowState;
}

export interface ReceiptLineageRow {
  readonly id: string;
  readonly artifact: string;
  readonly provider: string;
  readonly model: string;
  readonly costMicros: bigint;
}

export interface ImmutableReceipt {
  readonly receiptNumber: string;
  readonly quoteMicros: bigint;
  readonly actualMicros: bigint;
  readonly revision: string;
  readonly issuedAt: string;
  readonly lineage: readonly ReceiptLineageRow[];
}

export type ExportPortResult =
  | {
      readonly type: 'ok';
      readonly rows: readonly ExportRow[];
      readonly receipt: ImmutableReceipt;
      readonly downloadUrl?: string | null;
    }
  | { readonly type: 'review_incomplete'; readonly pending_group_ids: readonly string[] }
  | {
      readonly type: 'conflict';
      readonly expected_revision_id: string;
      readonly actual_revision_id: string;
    }
  | { readonly type: 'forbidden' }
  | { readonly type: 'not_found'; readonly run_id: string }
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export interface ExportReadPort {
  create(): Promise<ExportPortResult>;
}

export interface ExportPort {
  create(
    input: Readonly<{ expectedRevisionId: string; approvedGroupIds: readonly string[] }>,
  ): ExportPortResult;
}

export class InMemoryExportPort implements ExportPort {
  readonly #scenario: 'ok' | 'review_incomplete' | 'conflict';

  constructor(scenario: 'ok' | 'review_incomplete' | 'conflict' = 'ok') {
    this.#scenario = scenario;
  }

  create(
    input: Readonly<{ expectedRevisionId: string; approvedGroupIds: readonly string[] }>,
  ): ExportPortResult {
    if (this.#scenario === 'conflict' || input.expectedRevisionId !== '7f3a')
      return {
        type: 'conflict',
        expected_revision_id: input.expectedRevisionId,
        actual_revision_id: '81c2',
      };
    if (this.#scenario === 'review_incomplete' || !input.approvedGroupIds.includes('visuals'))
      return { type: 'review_incomplete', pending_group_ids: ['visuals'] };
    return {
      type: 'ok',
      rows: [
        { id: 'assets', label: '12 visual assets', format: 'PNG + WebP', state: 'ready' },
        { id: 'copy', label: '3 copy sets', format: 'CSV + TXT', state: 'ready' },
        { id: 'motion', label: '1 motion export', format: 'MP4 H.264', state: 'queued' },
        { id: 'manifest', label: 'Lineage manifest', format: 'JSON', state: 'failed' },
      ],
      receipt: {
        receiptNumber: 'MBV-0042-7F3A',
        quoteMicros: 4_200_000n,
        actualMicros: 4_080_000n,
        revision: '7f3a',
        issuedAt: '2026-07-20T18:42:00.000Z',
        lineage: [
          {
            id: 'concept',
            artifact: 'Concept logic',
            provider: 'Moonshot',
            model: 'kimi-2.6',
            costMicros: 1_140_000n,
          },
          {
            id: 'assets',
            artifact: 'Visual assets x3',
            provider: 'fal',
            model: 'flux-2-klein',
            costMicros: 2_340_000n,
          },
          {
            id: 'copy',
            artifact: 'Copy sets x3',
            provider: 'Moonshot',
            model: 'kimi-2.6',
            costMicros: 240_000n,
          },
          {
            id: 'motion',
            artifact: 'Motion 6s',
            provider: 'fal',
            model: 'seedance-1.0',
            costMicros: 360_000n,
          },
        ],
      },
    };
  }
}

function metadataString(value: unknown, keys: readonly string[]): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return undefined;
}

function immutableReceipt(receipt: P0OperationData<'get_receipt'>['receipt']): ImmutableReceipt {
  const reservation = receipt.reservation;
  const capturedMicros = BigInt(reservation?.captured_micros ?? 0);
  const refundedMicros = BigInt(reservation?.refunded_micros ?? 0);
  return {
    receiptNumber: receipt.run.id,
    quoteMicros: BigInt(reservation?.amount_micros ?? 0),
    actualMicros: capturedMicros >= refundedMicros ? capturedMicros - refundedMicros : 0n,
    revision: receipt.run.canvas_revision_id,
    issuedAt: receipt.run.updated_at,
    lineage: receipt.ledger
      .filter((entry) => entry.entry_type === 'capture' && entry.direction === 'debit')
      .map((entry) => ({
        id: entry.id,
        artifact:
          metadataString(entry.metadata, ['artifact_label', 'artifact_id']) ?? 'Captured output',
        provider:
          metadataString(entry.metadata, ['provider', 'provider_registration_id']) ??
          'Ledger metadata unavailable',
        model:
          metadataString(entry.metadata, ['provider_model_id', 'model_route_id', 'model']) ??
          'Ledger metadata unavailable',
        costMicros: BigInt(entry.amount_micros),
      })),
  };
}

function sameOriginArtifactUrl(accessUrl: string): string {
  try {
    const url = new URL(accessUrl);
    if (typeof window === 'undefined') return accessUrl;
    return `${window.location.origin}/api/core${url.pathname}${url.search}`;
  } catch {
    return accessUrl;
  }
}

function exportRows(receipt: P0OperationData<'get_receipt'>['receipt']): readonly ExportRow[] {
  return receipt.artifacts.map((artifact, index) => ({
    id: artifact.id,
    label:
      artifact.artifact_kind === 'export'
        ? 'Immutable export bundle'
        : `Approved artifact ${String(index + 1).padStart(2, '0')}`,
    format: artifact.mime_type,
    state: artifact.status === 'available' ? ('ready' as const) : ('failed' as const),
  }));
}

export class WorkerExportPort implements ExportReadPort {
  #idempotencyKey: string | null = null;
  #revision = 'current immutable revision';

  constructor(
    private readonly client: MustBeViralRestClient,
    private readonly runId: string,
    private readonly createIdempotencyKey: () => string,
  ) {}

  async create(): Promise<ExportPortResult> {
    try {
      const before = await this.client.request('get_receipt', { id: this.runId });
      if ('error' in before) return this.#mapError(before.error);
      this.#revision = before.data.receipt.run.canvas_revision_id;
      const pending = before.data.receipt.artifacts.filter(
        (artifact) => artifact.artifact_kind === 'provider_output',
      );
      if (pending.length > 0) {
        return {
          type: 'review_incomplete',
          pending_group_ids: pending.map(({ id }) => id),
        };
      }
      const approved = before.data.receipt.artifacts.filter(
        (artifact) => artifact.artifact_kind === 'approved_output',
      );
      if (approved.length === 0) {
        return { type: 'review_incomplete', pending_group_ids: ['approved artifacts'] };
      }
      this.#idempotencyKey ??= this.createIdempotencyKey();
      const created = await this.client.request('create_export', {
        id: this.runId,
        idempotencyKey: this.#idempotencyKey,
        body: { artifact_ids: approved.map(({ id }) => id), format: 'zip' },
      });
      if ('error' in created) return this.#mapError(created.error);
      const after = await this.client.request('get_receipt', { id: this.runId });
      if ('error' in after) return this.#mapError(after.error);
      const rows = exportRows(after.data.receipt);
      const exportId = created.data.artifact.artifact_id;
      let downloadUrl: string | null = null;
      try {
        const detail = await this.client.request('get_artifact', { id: exportId });
        if (
          !('error' in detail) &&
          detail.data.access?.purpose === 'customer_download' &&
          detail.data.access.url.length > 0
        ) {
          downloadUrl = sameOriginArtifactUrl(detail.data.access.url);
        }
      } catch {
        downloadUrl = null;
      }
      return {
        type: 'ok',
        rows: rows.some(({ id }) => id === exportId)
          ? rows
          : [
              ...rows,
              {
                id: exportId,
                label: 'Immutable export bundle',
                format: created.data.artifact.mime_type,
                state: 'ready',
              },
            ],
        receipt: immutableReceipt(after.data.receipt),
        ...(downloadUrl === null ? {} : { downloadUrl }),
      };
    } catch {
      return { type: 'error', message: 'Core could not create this export.', retryable: true };
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
  ): Exclude<ExportPortResult, { type: 'ok' | 'review_incomplete' }> {
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'NOT_FOUND') return { type: 'not_found', run_id: this.runId };
    if (error.code === 'REVISION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT') {
      return {
        type: 'conflict',
        expected_revision_id: this.#revision,
        actual_revision_id:
          metadataString(error.details, ['actual']) ?? 'current immutable revision',
      };
    }
    return {
      type: 'error',
      message: error.message,
      retryable: error.retryable,
      request_id: error.request_id,
    };
  }
}
import type { MustBeViralRestClient, P0OperationData } from '@mustbeviral/contracts';
