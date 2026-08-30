import type { MustBeViralRestClient, P0OperationData } from '@mustbeviral/contracts';
import {
  GB04_EXPECTED_EXPORT_MEMBERS,
  findGb04ExpectedExportMember,
  gb04ExpectedMimeTypeLabel,
  gb04ExportFilename,
  type Gb04ExpectedExportMember,
} from '@mustbeviral/artifacts';

import {
  SESSION_EXPIRED_RESULT,
  isSessionExpiredFailure,
  type SessionExpiredResult,
} from '../../lib/core/session-expiry';

export type ExportRowState = 'queued' | 'ready' | 'failed' | 'missing';

export interface ExportRow {
  readonly id: string;
  readonly label: string;
  readonly format: string;
  readonly state: ExportRowState;
  readonly detail: string;
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
  | {
      readonly type: 'review_incomplete';
      readonly pending_group_ids: readonly string[];
      readonly rows: readonly ExportRow[];
      readonly receipt: ImmutableReceipt;
    }
  | {
      readonly type: 'export_failed';
      readonly message: string;
      readonly request_id?: string;
      readonly rows: readonly ExportRow[];
      readonly receipt: ImmutableReceipt;
    }
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
    const rows = [
      {
        id: 'assets',
        label: '12 visual assets',
        format: 'PNG + WebP',
        state: 'ready' as const,
        detail: 'Approved source members are ready.',
      },
      {
        id: 'copy',
        label: '3 copy sets',
        format: 'JSON',
        state: 'ready' as const,
        detail: 'Approved source members are ready.',
      },
      {
        id: 'motion',
        label: '1 motion export',
        format: 'MP4 H.264',
        state: 'queued' as const,
        detail: 'Motion verification is still in progress.',
      },
      {
        id: 'manifest',
        label: 'Lineage manifest',
        format: 'JSON',
        state: 'failed' as const,
        detail: 'Preview fixture exposes the failed manifest state.',
      },
    ];
    const receipt: ImmutableReceipt = {
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
    };
    if (this.#scenario === 'review_incomplete' || !input.approvedGroupIds.includes('visuals')) {
      return { type: 'review_incomplete', pending_group_ids: ['visuals'], rows, receipt };
    }
    return {
      type: 'ok',
      rows,
      receipt,
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

type ReceiptArtifact = P0OperationData<'get_receipt'>['receipt']['artifacts'][number];
type RunNode = P0OperationData<'get_run'>['nodes'][number];

function memberPresentation(
  expected: Gb04ExpectedExportMember,
  mimeType?: string,
): Readonly<{ label: string; format: string; validMimeType: boolean }> {
  const filename = mimeType === undefined ? undefined : gb04ExportFilename(expected, mimeType);
  return {
    label: filename ?? expected.filenameTemplate,
    format: mimeType ?? gb04ExpectedMimeTypeLabel(expected),
    validMimeType: mimeType === undefined || filename !== undefined,
  };
}

function approvedArtifactState(
  artifact: ReceiptArtifact,
  presentation: ReturnType<typeof memberPresentation>,
): Readonly<{ state: ExportRowState; detail: string }> {
  if (artifact.status !== 'available') {
    return { state: 'failed', detail: 'The approved output is not available.' };
  }
  if (!presentation.validMimeType) {
    return { state: 'failed', detail: 'The approved output has an invalid archive format.' };
  }
  if (!artifact.accessibility_description?.trim()) {
    return { state: 'failed', detail: 'The approved output has no accessibility description.' };
  }
  return { state: 'ready', detail: 'Approved and verified for the immutable archive.' };
}

export function composeGb04ExportReadiness(
  receipt: P0OperationData<'get_receipt'>['receipt'],
  nodes: readonly RunNode[],
): Readonly<{
  rows: readonly ExportRow[];
  blockingMemberIds: readonly string[];
  approvedArtifactIds: readonly string[];
  exportArtifact: ReceiptArtifact | undefined;
}> {
  const nodesByKey = new Map(nodes.map((node) => [node.nodeKey, node]));
  const nodeKeysById = new Map(nodes.map((node) => [node.runNodeId, node.nodeKey]));
  const artifactsByNodeKey = new Map<string, ReceiptArtifact[]>();
  for (const artifact of receipt.artifacts) {
    if (
      artifact.run_node_id === null ||
      (artifact.artifact_kind !== 'provider_output' && artifact.artifact_kind !== 'approved_output')
    ) {
      continue;
    }
    const nodeKey = nodeKeysById.get(artifact.run_node_id);
    if (nodeKey === undefined) continue;
    const current = artifactsByNodeKey.get(nodeKey) ?? [];
    current.push(artifact);
    artifactsByNodeKey.set(nodeKey, current);
  }

  const rows: ExportRow[] = [];
  const blockingMemberIds: string[] = [];
  const approvedArtifactIds: string[] = [];
  const consumedApprovedIds = new Set<string>();
  for (const expected of GB04_EXPECTED_EXPORT_MEMBERS) {
    const { nodeKey } = expected;
    const node = nodesByKey.get(nodeKey);
    const candidates = artifactsByNodeKey.get(nodeKey) ?? [];
    const approved = candidates.filter((artifact) => artifact.artifact_kind === 'approved_output');
    const providerOutputs = candidates.filter(
      (artifact) => artifact.artifact_kind === 'provider_output',
    );
    const presentation = memberPresentation(expected, approved[0]?.mime_type);
    let state: ExportRowState;
    let detail: string;
    if (node === undefined) {
      state = 'missing';
      detail = 'The required GB-04 run node is missing.';
    } else if (node.status === 'reconciliation_required') {
      state = 'failed';
      detail = 'The run node needs reconciliation before export.';
    } else if (node.status === 'failed') {
      state = 'failed';
      detail = 'The run node failed before producing an exportable output.';
    } else if (node.status === 'canceled' || node.status === 'skipped') {
      state = 'missing';
      detail = 'The run node ended without an exportable output.';
    } else if (node.status !== 'succeeded') {
      state = 'queued';
      detail = 'Generation or artifact verification is still in progress.';
    } else if (approved.length > 1) {
      state = 'failed';
      detail = 'Duplicate approved outputs exist; exactly one is required.';
      for (const artifact of approved) consumedApprovedIds.add(artifact.id);
    } else if (approved.length === 1) {
      const artifact = approved[0];
      if (artifact === undefined) throw new TypeError('Approved artifact lookup was inconsistent');
      consumedApprovedIds.add(artifact.id);
      const approvedState = approvedArtifactState(artifact, presentation);
      state = approvedState.state;
      detail = approvedState.detail;
      if (state === 'ready') approvedArtifactIds.push(artifact.id);
    } else if (providerOutputs.some((artifact) => artifact.status !== 'available')) {
      state = 'failed';
      detail = 'Generated output is quarantined or unavailable and cannot be approved.';
    } else if (providerOutputs.length > 0) {
      state = 'queued';
      detail = 'Generated output exists but still needs approval.';
    } else {
      state = 'missing';
      detail = 'The run node is finished but its approved output is missing.';
    }
    rows.push({
      id: nodeKey,
      label: presentation.label,
      format: presentation.format,
      state,
      detail,
    });
    if (state !== 'ready') blockingMemberIds.push(nodeKey);
  }

  for (const artifact of receipt.artifacts) {
    if (artifact.artifact_kind !== 'approved_output' || consumedApprovedIds.has(artifact.id)) {
      continue;
    }
    const nodeKey =
      artifact.run_node_id === null ? undefined : nodeKeysById.get(artifact.run_node_id);
    if (nodeKey !== undefined && findGb04ExpectedExportMember(nodeKey) !== undefined) continue;
    rows.push({
      id: artifact.id,
      label: nodeKey === undefined ? 'Unmapped approved output' : `Unexpected output · ${nodeKey}`,
      format: artifact.mime_type,
      state: 'failed',
      detail: 'This output is not part of the exact GB-04 archive member set.',
    });
    blockingMemberIds.push(nodeKey ?? 'unmapped-approved-output');
  }

  const exportArtifact = receipt.artifacts
    .filter(
      (artifact) =>
        artifact.artifact_kind === 'export' &&
        artifact.status === 'available' &&
        artifact.mime_type === 'application/zip',
    )
    .sort(
      (left, right) =>
        right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id),
    )[0];
  const archiveState: ExportRowState = exportArtifact === undefined ? 'queued' : 'ready';
  const archiveDetail =
    exportArtifact === undefined
      ? 'Created deterministically after every source member is ready.'
      : 'Present in the verified immutable archive.';
  for (const filename of ['qa-report.json', 'receipt.json', 'manifest.json']) {
    rows.push({
      id: filename,
      label: filename,
      format: 'application/json',
      state: archiveState,
      detail: archiveDetail,
    });
  }
  rows.push({
    id: exportArtifact?.id ?? 'launch-pack-archive',
    label: `mustbeviral-launch-pack-${receipt.run.id}.zip`,
    format: 'application/zip',
    state: archiveState,
    detail:
      exportArtifact === undefined
        ? 'The archive has not been created.'
        : 'The archive is ready for a just-in-time download link.',
  });

  return {
    rows,
    blockingMemberIds: [...new Set(blockingMemberIds)],
    approvedArtifactIds,
    exportArtifact,
  };
}

const GENERATED_EXPORT_MEMBER_IDS = new Set([
  'qa-report.json',
  'receipt.json',
  'manifest.json',
  'launch-pack-archive',
]);

function failedExportRows(rows: readonly ExportRow[]): readonly ExportRow[] {
  return rows.map((row) =>
    GENERATED_EXPORT_MEMBER_IDS.has(row.id)
      ? {
          ...row,
          state: 'failed',
          detail: 'Core did not prove this generated archive member.',
        }
      : row,
  );
}

function provenExportRows(
  rows: readonly ExportRow[],
  input: Readonly<{ exportId: string; mimeType: string; runId: string }>,
): readonly ExportRow[] {
  return rows.map((row) => {
    if (row.id === 'launch-pack-archive') {
      return {
        ...row,
        id: input.exportId,
        label: `mustbeviral-launch-pack-${input.runId}.zip`,
        format: input.mimeType,
        state: 'ready',
        detail: 'Core returned the verified immutable archive.',
      };
    }
    if (GENERATED_EXPORT_MEMBER_IDS.has(row.id)) {
      return {
        ...row,
        state: 'ready',
        detail: 'Present in the verified immutable archive.',
      };
    }
    return row;
  });
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
    let creationContext:
      | Readonly<{
          readiness: ReturnType<typeof composeGb04ExportReadiness>;
          receipt: P0OperationData<'get_receipt'>['receipt'];
        }>
      | undefined;
    let creationProven = false;
    try {
      const before = await this.client.request('get_receipt', { id: this.runId });
      if ('error' in before) return this.#mapError(before.error);
      this.#revision = before.data.receipt.run.canvas_revision_id;
      const run = await this.client.request('get_run', { id: this.runId });
      if ('error' in run) return this.#mapError(run.error);
      const readiness = composeGb04ExportReadiness(before.data.receipt, run.data.nodes);
      if (readiness.blockingMemberIds.length > 0) {
        return {
          type: 'review_incomplete',
          pending_group_ids: readiness.blockingMemberIds,
          rows: readiness.rows,
          receipt: immutableReceipt(before.data.receipt),
        };
      }
      const existingExport = readiness.exportArtifact;
      let exportId: string;
      let receipt = before.data.receipt;
      let createdMimeType = existingExport?.mime_type ?? 'application/zip';
      if (!allowCreate) {
        if (existingExport === undefined) {
          return {
            type: 'export_required',
            rows: readiness.rows,
            receipt: immutableReceipt(receipt),
          };
        }
        exportId = existingExport.id;
      } else {
        creationContext = { readiness, receipt };
        this.#idempotencyKey ??= this.createIdempotencyKey();
        const created = await this.client.request('create_export', {
          id: this.runId,
          idempotencyKey: this.#idempotencyKey,
          body: { artifact_ids: [...readiness.approvedArtifactIds], format: 'zip' },
        });
        if ('error' in created) {
          const mapped = this.#mapError(created.error, false);
          if (mapped.type !== 'error') return mapped;
          return {
            type: 'export_failed',
            message: mapped.message,
            ...(mapped.request_id === undefined ? {} : { request_id: mapped.request_id }),
            rows: failedExportRows(readiness.rows),
            receipt: immutableReceipt(receipt),
          };
        }
        // Preserve the key for uncertain failures above, but rotate it after a proven response so
        // a later buyer-triggered rebuild cannot replay an earlier successful create operation.
        this.#idempotencyKey = null;
        creationProven = true;
        exportId = created.data.artifact.artifact_id;
        createdMimeType = created.data.artifact.mime_type;
        const after = await this.client.request('get_receipt', { id: this.runId });
        if ('error' in after) {
          const mapped = this.#mapError(after.error, false);
          if (mapped.type !== 'error') return mapped;
          return {
            type: 'export_failed',
            message: 'Core created the export, but its receipt could not be verified.',
            ...(mapped.request_id === undefined ? {} : { request_id: mapped.request_id }),
            rows: failedExportRows(readiness.rows),
            receipt: immutableReceipt(receipt),
          };
        }
        receipt = after.data.receipt;
      }
      const afterReadiness = composeGb04ExportReadiness(receipt, run.data.nodes);
      if (afterReadiness.blockingMemberIds.length > 0) {
        return {
          type: 'review_incomplete',
          pending_group_ids: afterReadiness.blockingMemberIds,
          rows: afterReadiness.rows,
          receipt: immutableReceipt(receipt),
        };
      }
      const rows =
        afterReadiness.exportArtifact === undefined
          ? provenExportRows(afterReadiness.rows, {
              exportId,
              mimeType: createdMimeType,
              runId: this.runId,
            })
          : afterReadiness.rows;
      return {
        type: 'ok',
        rows,
        receipt: immutableReceipt(receipt),
        exportArtifactId: exportId,
      };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      if (allowCreate && creationContext !== undefined) {
        return {
          type: 'export_failed',
          message: creationProven
            ? 'Core created the export, but its receipt could not be verified.'
            : 'Core did not prove whether this export was created.',
          rows: failedExportRows(creationContext.readiness.rows),
          receipt: immutableReceipt(creationContext.receipt),
        };
      }
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
  ): Exclude<
    ExportPortResult,
    { type: 'ok' | 'export_required' | 'review_incomplete' | 'export_failed' }
  > {
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
