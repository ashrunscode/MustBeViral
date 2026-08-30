import {
  SESSION_EXPIRED_RESULT,
  isSessionExpiredFailure,
  type SessionExpiredResult,
} from '../../lib/core/session-expiry';

export type ExportRowState = 'queued' | 'ready' | 'failed';

export interface ExportRow {
  readonly id: string;
  readonly label: string;
  readonly format: string;
  readonly state: ExportRowState;
}

export interface ReceiptLineageRow {
  readonly attemptId: string;
  readonly provider: string;
  readonly providerModelId: string;
  readonly routeId: string;
  readonly status: P0OperationData<'get_receipt'>['receipt']['provider_jobs'][number]['status'];
  readonly capturedMicros: bigint;
}

export interface ImmutableReceipt {
  readonly receiptNumber: string;
  readonly quoteMicros: bigint;
  readonly actualMicros: bigint;
  readonly revision: string;
  readonly issuedAt: string;
  readonly lineage: readonly ReceiptLineageRow[];
}

export interface ExportDownloadLink {
  readonly artifactId: string;
  readonly url: string;
  readonly expiresAt: string;
}

export type ExportDownloadResult =
  | { readonly type: 'ok'; readonly download: ExportDownloadLink }
  | { readonly type: 'rebuild_required' }
  | { readonly type: 'forbidden' }
  | SessionExpiredResult
  | { readonly type: 'not_found'; readonly run_id: string }
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export type ExportPortResult =
  | {
      readonly type: 'ok';
      readonly rows: readonly ExportRow[];
      readonly receipt: ImmutableReceipt;
      readonly exportArtifactId?: string;
      readonly download?: ExportDownloadLink;
    }
  | {
      readonly type: 'export_required';
      readonly rows: readonly ExportRow[];
      readonly receipt: ImmutableReceipt;
    }
  | {
      readonly type: 'rebuild_required';
      readonly rows: readonly ExportRow[];
      readonly receipt: ImmutableReceipt;
    }
  | { readonly type: 'review_incomplete'; readonly pending_group_ids: readonly string[] }
  | {
      readonly type: 'conflict';
      readonly expected_revision_id: string;
      readonly actual_revision_id: string;
    }
  | { readonly type: 'forbidden' }
  | SessionExpiredResult
  | { readonly type: 'not_found'; readonly run_id: string }
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export interface ExportReadPort {
  read(): Promise<ExportPortResult>;
  create(): Promise<ExportPortResult>;
  remintDownload?(artifactId: string): Promise<ExportDownloadResult>;
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
            attemptId: 'attempt-concept',
            provider: 'Moonshot',
            providerModelId: 'kimi-2.6',
            routeId: 'openrouter/kimi-concept',
            status: 'succeeded',
            capturedMicros: 1_140_000n,
          },
          {
            attemptId: 'attempt-assets',
            provider: 'fal',
            providerModelId: 'flux-2-klein',
            routeId: 'fal/flux-visuals',
            status: 'succeeded',
            capturedMicros: 2_340_000n,
          },
          {
            attemptId: 'attempt-copy',
            provider: 'Moonshot',
            providerModelId: 'kimi-2.6',
            routeId: 'openrouter/kimi-copy',
            status: 'succeeded',
            capturedMicros: 240_000n,
          },
          {
            attemptId: 'attempt-motion',
            provider: 'fal',
            providerModelId: 'seedance-1.0',
            routeId: 'fal/seedance-motion',
            status: 'succeeded',
            capturedMicros: 360_000n,
          },
        ],
      },
    };
  }
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
    lineage: [...receipt.provider_jobs]
      .sort((left, right) => left.attempt_id.localeCompare(right.attempt_id))
      .map((job) => ({
        attemptId: job.attempt_id,
        provider: job.provider,
        providerModelId: job.provider_model_id,
        routeId: job.route_id,
        status: job.status,
        capturedMicros: BigInt(job.captured_micros),
      })),
  };
}

function errorDetailString(
  details: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function sameOriginArtifactUrl(artifactId: string, accessUrl: string): string | null {
  try {
    const url = new URL(accessUrl);
    const expectedPath = `/v1/artifacts/${encodeURIComponent(artifactId)}/content`;
    const tokenValues = url.searchParams.getAll('token');
    const token = tokenValues[0];
    const [payload, signature, ...extraTokenParts] = token?.split('.') ?? [];
    if (
      url.pathname !== expectedPath ||
      url.hash.length > 0 ||
      tokenValues.length !== 1 ||
      [...url.searchParams.keys()].some((key) => key !== 'token') ||
      token === undefined ||
      token.length === 0 ||
      token.length > 8_192 ||
      payload === undefined ||
      !/^[A-Za-z0-9_-]+$/u.test(payload) ||
      signature === undefined ||
      signature.length !== 43 ||
      !/^[A-Za-z0-9_-]+$/u.test(signature) ||
      extraTokenParts.length > 0
    ) {
      return null;
    }
    return `/api/download/${encodeURIComponent(artifactId)}?${new URLSearchParams({ token }).toString()}`;
  } catch {
    return null;
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

  read(): Promise<ExportPortResult> {
    return this.#readOrCreate(false);
  }

  create(): Promise<ExportPortResult> {
    return this.#readOrCreate(true);
  }

  async #readOrCreate(allowCreate: boolean): Promise<ExportPortResult> {
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
      const existingExport = before.data.receipt.artifacts.find(
        (artifact) => artifact.artifact_kind === 'export' && artifact.status === 'available',
      );
      let exportId: string;
      let receipt = before.data.receipt;
      let createdMimeType = existingExport?.mime_type ?? 'application/zip';
      if (!allowCreate) {
        if (existingExport === undefined) {
          return {
            type: 'export_required',
            rows: exportRows(receipt),
            receipt: immutableReceipt(receipt),
          };
        }
        exportId = existingExport.id;
      } else {
        this.#idempotencyKey ??= this.createIdempotencyKey();
        const created = await this.client.request('create_export', {
          id: this.runId,
          idempotencyKey: this.#idempotencyKey,
          body: { artifact_ids: approved.map(({ id }) => id), format: 'zip' },
        });
        if ('error' in created) return this.#mapError(created.error, false);
        // Preserve the key for uncertain failures above, but rotate it after a proven response so
        // a later buyer-triggered rebuild cannot replay an earlier successful create operation.
        this.#idempotencyKey = null;
        exportId = created.data.artifact.artifact_id;
        createdMimeType = created.data.artifact.mime_type;
        const after = await this.client.request('get_receipt', { id: this.runId });
        if ('error' in after) return this.#mapError(after.error, false);
        receipt = after.data.receipt;
      }
      const rows = exportRows(receipt);
      return {
        type: 'ok',
        rows: rows.some(({ id }) => id === exportId)
          ? rows
          : [
              ...rows,
              {
                id: exportId,
                label: 'Immutable export bundle',
                format: createdMimeType,
                state: 'ready',
              },
            ],
        receipt: immutableReceipt(receipt),
        exportArtifactId: exportId,
      };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return {
        type: 'error',
        message: allowCreate
          ? 'Core could not create this export.'
          : 'Core could not read this export receipt.',
        retryable: !allowCreate,
      };
    }
  }

  async remintDownload(artifactId: string): Promise<ExportDownloadResult> {
    try {
      const detail = await this.client.request('get_artifact', { id: artifactId });
      if ('error' in detail) {
        if (detail.error.code === 'NOT_FOUND') return { type: 'rebuild_required' };
        const mapped = this.#mapError(detail.error);
        if (mapped.type === 'conflict') {
          return {
            type: 'error',
            message: 'Core could not mint this download link.',
            retryable: false,
          };
        }
        return mapped;
      }
      if (
        detail.data.access?.purpose !== 'customer_download' ||
        detail.data.access.url.length === 0
      ) {
        return {
          type: 'error',
          message: 'Core did not return a customer download link.',
          retryable: true,
        };
      }
      const url = sameOriginArtifactUrl(artifactId, detail.data.access.url);
      if (url === null) {
        return {
          type: 'error',
          message: 'Core returned an invalid customer download link.',
          retryable: false,
        };
      }
      return {
        type: 'ok',
        download: {
          artifactId,
          url,
          expiresAt: detail.data.access.expires_at,
        },
      };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return {
        type: 'error',
        message: 'Core could not mint this download link.',
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
    allowRetry = true,
  ): Exclude<ExportPortResult, { type: 'ok' | 'export_required' | 'review_incomplete' }> {
    if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'NOT_FOUND') return { type: 'not_found', run_id: this.runId };
    if (error.code === 'REVISION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT') {
      return {
        type: 'conflict',
        expected_revision_id: this.#revision,
        actual_revision_id:
          errorDetailString(error.details, 'actual') ?? 'current immutable revision',
      };
    }
    return {
      type: 'error',
      message: error.message,
      retryable: allowRetry && error.retryable,
      request_id: error.request_id,
    };
  }
}
import type { MustBeViralRestClient, P0OperationData } from '@mustbeviral/contracts';
