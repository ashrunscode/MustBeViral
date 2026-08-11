import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import {
  createMustBeViralRestClient,
  type GoldenCampaignBrief,
  type MustBeViralRestClient,
} from '@mustbeviral/contracts';

import {
  HarnessFlowError,
  StagingLaunchPackTransport,
  prepareGoldenBrief,
  startPreparedGoldenBrief,
  type PreparedGoldenBrief,
} from './launch-pack-harness-lib';
import { loadStagingAdminConfiguration, type StagingAdminConfiguration } from './staging-auth';
import { pollRunUntilTerminal, type TerminalRunProgress } from './washbodega-pack-run';

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const PACK_MICROS = 4_550_000n;
const OPERATOR_HEADROOM_MICROS = 22_750_000n;
const EXPECTED_PROVIDER_OUTPUTS = 16;
const POLL_BEFORE_RECOVERY_MINUTES = 25;
const POLL_AFTER_RECOVERY_MINUTES = 20;

interface SpendExposure {
  readonly observed_at: string;
  readonly utc_day_start: string;
  readonly global_daily_cap_micros: string;
  readonly global_exposure_micros: string;
  readonly global_remaining_micros: string;
  readonly reservation_count: number;
  readonly unsettled_reservation_count: number;
  readonly status_counts: Readonly<Record<string, number>>;
}

type SafeRecord = Readonly<Record<string, unknown>>;

export interface Golden20BriefRecord {
  readonly brief_id: string;
  readonly outcome: 'completed' | 'failed' | 'cap_deferred';
  readonly workspace_id?: string;
  readonly project_id?: string;
  readonly canvas_id?: string;
  readonly revision_id?: string;
  readonly revision_hash?: string;
  readonly quote?: Readonly<{
    quote_id: string;
    quoted_micros: string;
    expires_at: string;
  }>;
  readonly wallet_credit?: Readonly<{
    transaction_id: string;
    amount_micros: string;
    replayed: boolean;
  }>;
  readonly run?: Readonly<{
    run_id: string;
    reservation_id: string;
    status: string;
    confirmed_at?: string;
    terminal_at?: string;
    first_reviewable_at?: string;
    time_to_first_reviewable_ms?: number;
    time_to_terminal_ms?: number;
  }>;
  readonly money?: Readonly<{
    reserved_micros: string;
    captured_micros: string;
    released_micros: string;
    refunded_micros: string;
    residual_micros: string;
    capture_ledger_micros: string;
    catalog_landed_cost_micros: string;
    external_provider_cost_micros: null;
    external_provider_cost_observability: 'not_observable';
  }>;
  readonly providers?: Readonly<{
    jobs: number;
    unique_attempts: number;
    duplicate_attempts: number;
    all_terminal_succeeded: boolean;
    routes: readonly Readonly<{
      provider: string;
      provider_model_id: string;
      route_id: string;
      attempts: number;
      captured_micros: string;
    }>[];
  }>;
  readonly artifacts?: Readonly<{
    customer_reads: number;
    approved_outputs: number;
    exports: number;
    all_available: boolean;
    all_private_exact_key: boolean;
    all_content_addressed: boolean;
    export_content_hash: string;
    export_byte_size: number;
  }>;
  readonly approval?: Readonly<{
    approved: number;
    replayed: number;
  }>;
  readonly export?: Readonly<{
    deterministic: boolean;
    first_content_hash: string;
    second_content_hash: string;
  }>;
  readonly receipt?: Readonly<{
    customer_path_read: boolean;
    ledger_capture_rows: number;
    ledger_artifact_links_complete: boolean;
    lineage_rows: number;
    export_member_rows: number;
    provider_model_cost_complete: boolean;
  }>;
  readonly recovery?: Readonly<{
    exercised: boolean;
    reason?: string;
  }>;
  readonly cap_observation?: SpendExposure;
  readonly failure?: Readonly<{ code: string; message: string; operation?: string }>;
}

export interface DuplicateGoldenRunFinding {
  readonly brief_id: string;
  readonly quote: NonNullable<Golden20BriefRecord['quote']>;
  readonly money: NonNullable<Golden20BriefRecord['money']>;
  readonly run: NonNullable<Golden20BriefRecord['run']>;
}

interface PostgrestClient {
  call(name: string, body: SafeRecord): Promise<unknown>;
}

function record(value: unknown, field: string): SafeRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} was not an object`);
  }
  return value as SafeRecord;
}

function records(value: unknown, field: string): readonly SafeRecord[] {
  if (!Array.isArray(value)) throw new Error(`${field} was not an array`);
  return value.map((entry, index) => record(entry, `${field}[${String(index)}]`));
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${field} was missing`);
  return value;
}

function integer(value: unknown, field: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/u.test(value)) return BigInt(value);
  throw new Error(`${field} was not nonnegative integer micros`);
}

function signedInteger(value: unknown, field: string): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) return BigInt(value);
  throw new Error(`${field} was not integer micros`);
}

function requireData(value: unknown, operation: string): SafeRecord {
  const response = record(value, `${operation} response`);
  if (response['data'] === undefined) {
    const error = record(response['error'], `${operation} error`);
    throw new HarnessFlowError({
      code: text(error['code'], `${operation}.error.code`),
      message: text(error['message'], `${operation}.error.message`),
      operation: operation as never,
    });
  }
  return record(response['data'], `${operation} data`);
}

function safeFailure(
  error: unknown,
): Readonly<{ code: string; message: string; operation?: string }> {
  if (error instanceof HarnessFlowError) {
    return {
      code: error.safe.code,
      message: error.safe.message,
      ...(error.safe.operation === undefined ? {} : { operation: error.safe.operation }),
    };
  }
  return {
    code: 'GOLDEN_RUN_FAILED',
    message: error instanceof Error ? error.message : 'The golden run failed.',
  };
}

function createPostgrestClient(configuration: StagingAdminConfiguration): PostgrestClient {
  return {
    async call(name, body) {
      const response = await fetch(`${configuration.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: configuration.serviceRoleKey,
          authorization: `Bearer ${configuration.serviceRoleKey}`,
          'content-type': 'application/json',
          'user-agent': 'mustbeviral-golden-20-harness/1',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new HarnessFlowError({
          code: 'PRIVILEGED_RPC_FAILED',
          message: `The privileged ${name} PostgREST call failed closed.`,
          http_status: response.status,
        });
      }
      return response.json() as Promise<unknown>;
    },
  };
}

async function getSpendExposure(postgrest: PostgrestClient): Promise<SpendExposure> {
  const value = record(await postgrest.call('get_global_spend_exposure', {}), 'spend exposure');
  return {
    observed_at: text(value['observed_at'], 'observed_at'),
    utc_day_start: text(value['utc_day_start'], 'utc_day_start'),
    global_daily_cap_micros: integer(
      value['global_daily_cap_micros'],
      'global_daily_cap_micros',
    ).toString(10),
    global_exposure_micros: integer(
      value['global_exposure_micros'],
      'global_exposure_micros',
    ).toString(10),
    global_remaining_micros: signedInteger(
      value['global_remaining_micros'],
      'global_remaining_micros',
    ).toString(10),
    reservation_count: Number(integer(value['reservation_count'], 'reservation_count')),
    unsettled_reservation_count: Number(
      integer(value['unsettled_reservation_count'], 'unsettled_reservation_count'),
    ),
    status_counts: record(value['status_counts'], 'status_counts') as Readonly<
      Record<string, number>
    >,
  };
}

export function safeGoldenPackCount(exposure: SpendExposure): number {
  const remaining = BigInt(exposure.global_remaining_micros);
  if (remaining <= OPERATOR_HEADROOM_MICROS) return 0;
  const count = (remaining - OPERATOR_HEADROOM_MICROS) / PACK_MICROS;
  return Number(count > 20n ? 20n : count);
}

async function creditWorkspace(
  postgrest: PostgrestClient,
  prepared: PreparedGoldenBrief,
): Promise<Readonly<{ transaction_id: string; amount_micros: string; replayed: boolean }>> {
  const value = record(
    await postgrest.call('record_ledger_movement', {
      p_workspace_id: prepared.workspaceId,
      p_entry_type: 'credit',
      p_amount_micros: Number(PACK_MICROS),
      p_causative_key: `golden-20:${prepared.briefId}:${prepared.workspaceId}:pack-credit`,
      p_reservation_id: null,
      p_run_id: null,
      p_request_id: `golden-20-credit-${randomUUID()}`,
      p_metadata: {
        purpose: 'golden_20_acceptance',
        brief_id: prepared.briefId,
        pack_quote_micros: Number(PACK_MICROS),
      },
    }),
    'record_ledger_movement',
  );
  return {
    transaction_id: text(value['transaction_id'], 'transaction_id'),
    amount_micros: PACK_MICROS.toString(10),
    replayed: value['replayed'] === true,
  };
}

async function exerciseRecovery(
  postgrest: PostgrestClient,
  reason: string,
  log: (message: string) => void,
): Promise<Readonly<{ exercised: true; reason: string }>> {
  log(`RECOVERY reason=${reason} observed_at=${new Date().toISOString()}`);
  await postgrest.call('arm_stranded_dispatch', { p_age_seconds: 300 });
  await postgrest.call('reap_stranded_synchronous_jobs', { p_age_seconds: 300 });
  return { exercised: true, reason };
}

async function pollWithRecovery(
  transport: StagingLaunchPackTransport,
  prepared: PreparedGoldenBrief,
  runId: string,
  postgrest: PostgrestClient,
  log: (message: string) => void,
): Promise<
  Readonly<{
    terminal: TerminalRunProgress;
    recovery: NonNullable<Golden20BriefRecord['recovery']>;
  }>
> {
  const context = () => ({
    workspace_id: prepared.workspaceId,
    request_id: `golden-20-${prepared.briefId}-${randomUUID()}`,
  });
  let terminal: TerminalRunProgress;
  try {
    terminal = await pollRunUntilTerminal(transport, context, runId, {
      timeoutMs: POLL_BEFORE_RECOVERY_MINUTES * 60_000,
      stderr: log,
    });
  } catch {
    const recovery = await exerciseRecovery(postgrest, 'explicit_poll_timeout', log);
    terminal = await pollRunUntilTerminal(transport, context, runId, {
      timeoutMs: POLL_AFTER_RECOVERY_MINUTES * 60_000,
      stderr: log,
    });
    return { terminal, recovery };
  }
  if (terminal.status === 'reconciliation_required') {
    const recovery = await exerciseRecovery(postgrest, 'reconciliation_required', log);
    terminal = await pollRunUntilTerminal(transport, context, runId, {
      timeoutMs: POLL_AFTER_RECOVERY_MINUTES * 60_000,
      stderr: log,
    });
    return { terminal, recovery };
  }
  return { terminal, recovery: { exercised: false } };
}

function routeSummary(
  providerJobs: readonly SafeRecord[],
): NonNullable<Golden20BriefRecord['providers']> {
  const byRoute = new Map<
    string,
    {
      provider: string;
      provider_model_id: string;
      route_id: string;
      attempts: number;
      captured: bigint;
    }
  >();
  const attempts = providerJobs.map((job) => text(job['attempt_id'], 'provider_job.attempt_id'));
  for (const job of providerJobs) {
    const provider = text(job['provider'], 'provider_job.provider');
    const providerModelId = text(job['provider_model_id'], 'provider_job.provider_model_id');
    const routeId = text(job['route_id'], 'provider_job.route_id');
    const key = `${provider}\u0000${providerModelId}\u0000${routeId}`;
    const current = byRoute.get(key) ?? {
      provider,
      provider_model_id: providerModelId,
      route_id: routeId,
      attempts: 0,
      captured: 0n,
    };
    current.attempts += 1;
    current.captured += integer(job['capture_micros'], 'provider_job.capture_micros');
    byRoute.set(key, current);
  }
  const uniqueAttempts = new Set(attempts).size;
  return {
    jobs: providerJobs.length,
    unique_attempts: uniqueAttempts,
    duplicate_attempts: providerJobs.length - uniqueAttempts,
    all_terminal_succeeded: providerJobs.every((job) => job['status'] === 'succeeded'),
    routes: [...byRoute.values()]
      .sort((left, right) => left.route_id.localeCompare(right.route_id))
      .map((route) => ({
        provider: route.provider,
        provider_model_id: route.provider_model_id,
        route_id: route.route_id,
        attempts: route.attempts,
        captured_micros: route.captured.toString(10),
      })),
  };
}

function earliestReviewable(artifacts: readonly SafeRecord[]): string {
  const candidates = artifacts
    .filter(
      (artifact) =>
        artifact['status'] === 'available' &&
        typeof artifact['mime_type'] === 'string' &&
        (artifact['mime_type'] as string).startsWith('image/'),
    )
    .map((artifact) => text(artifact['created_at'], 'artifact.created_at'))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  const first = candidates[0];
  if (first === undefined) throw new Error('No reviewable static artifact was produced');
  return first;
}

async function approveExportAndReconcile(input: {
  readonly brief: GoldenCampaignBrief;
  readonly prepared: PreparedGoldenBrief;
  readonly runId: string;
  readonly reservationId: string;
  readonly terminal: TerminalRunProgress;
  readonly recovery: NonNullable<Golden20BriefRecord['recovery']>;
  readonly walletCredit: NonNullable<Golden20BriefRecord['wallet_credit']>;
  readonly client: MustBeViralRestClient;
  readonly postgrest: PostgrestClient;
}): Promise<Golden20BriefRecord> {
  if (input.terminal.status !== 'succeeded') {
    throw new Error(`Run reached terminal status ${input.terminal.status}, expected succeeded`);
  }
  const terminalReceipt = input.terminal.receipt;
  const terminalArtifacts = records(terminalReceipt['artifacts'], 'terminal receipt artifacts');
  const approvableOutputs = terminalArtifacts.filter(
    (artifact) =>
      (artifact['artifact_kind'] === 'provider_output' ||
        artifact['artifact_kind'] === 'approved_output') &&
      artifact['status'] === 'available',
  );
  if (approvableOutputs.length !== EXPECTED_PROVIDER_OUTPUTS) {
    throw new Error(
      `Expected ${String(EXPECTED_PROVIDER_OUTPUTS)} available provider or approved outputs, found ${String(approvableOutputs.length)}`,
    );
  }
  const approvals = approvableOutputs.map((artifact) => ({
    artifact_id: text(artifact['id'], 'provider artifact id'),
    accessibility_description: `Technical golden-run artifact for ${input.brief.product}; visual usability is evaluated separately.`,
  }));
  const approved = requireData(
    await input.client.request('approve_artifacts', {
      id: input.runId,
      idempotencyKey: `golden-20:${input.brief.briefId}:approve`,
      body: { approvals },
    }),
    'approve_artifacts',
  );
  const replayed = requireData(
    await input.client.request('approve_artifacts', {
      id: input.runId,
      idempotencyKey: `golden-20:${input.brief.briefId}:approve-replay`,
      body: { approvals },
    }),
    'approve_artifacts replay',
  );
  if (
    Number(approved['approved']) + Number(approved['replayed']) !== EXPECTED_PROVIDER_OUTPUTS ||
    replayed['replayed'] !== EXPECTED_PROVIDER_OUTPUTS
  ) {
    throw new Error('Approval or approval replay did not cover all 16 outputs');
  }
  const approvedArtifacts = records(approved['artifacts'], 'approved artifacts');
  const approvedIds = approvedArtifacts.map((artifact) =>
    text(artifact['artifact_id'], 'approved id'),
  );
  const firstExport = requireData(
    await input.client.request('create_export', {
      id: input.runId,
      idempotencyKey: `golden-20:${input.brief.briefId}:export`,
      body: { artifact_ids: approvedIds, format: 'zip' },
    }),
    'create_export',
  );
  const secondExport = requireData(
    await input.client.request('create_export', {
      id: input.runId,
      idempotencyKey: `golden-20:${input.brief.briefId}:export-replay`,
      body: { artifact_ids: approvedIds, format: 'zip' },
    }),
    'create_export replay',
  );
  const firstExportArtifact = record(firstExport['artifact'], 'first export artifact');
  const secondExportArtifact = record(secondExport['artifact'], 'second export artifact');
  const firstExportHash = text(firstExportArtifact['content_hash'], 'first export hash');
  const secondExportHash = text(secondExportArtifact['content_hash'], 'second export hash');
  if (firstExportHash !== secondExportHash) throw new Error('Re-export was not byte-identical');

  const receiptData = requireData(
    await input.client.request('get_receipt', { id: input.runId }),
    'get_receipt',
  );
  const receipt = record(receiptData['receipt'], 'customer receipt');
  const run = record(receipt['run'], 'receipt run');
  const reservation = record(receipt['reservation'], 'receipt reservation');
  const artifacts = records(receipt['artifacts'], 'receipt artifacts');
  const ledger = records(receipt['ledger'], 'receipt ledger');
  const lineage = records(receipt['lineage'], 'receipt lineage');
  const capturedMicros = integer(reservation['captured_micros'], 'captured_micros');
  const releasedMicros = integer(reservation['released_micros'], 'released_micros');
  const refundedMicros = integer(reservation['refunded_micros'], 'refunded_micros');
  const reservedMicros = integer(reservation['amount_micros'], 'amount_micros');
  const residual = reservedMicros - capturedMicros - releasedMicros;
  const captureRows = ledger.filter(
    (entry) =>
      entry['entry_type'] === 'capture' &&
      entry['account_code'] === 'usage_expense' &&
      entry['direction'] === 'credit',
  );
  const captureLedgerMicros = captureRows.reduce(
    (sum, entry) => sum + integer(entry['amount_micros'], 'ledger amount'),
    0n,
  );
  const ledgerArtifactIds = new Set(
    captureRows.map((entry) =>
      text(record(entry['metadata'], 'ledger metadata')['artifact_id'], 'ledger artifact id'),
    ),
  );
  const finalApproved = artifacts.filter(
    (artifact) => artifact['artifact_kind'] === 'approved_output',
  );
  const finalExports = artifacts.filter((artifact) => artifact['artifact_kind'] === 'export');
  const customerReads = await Promise.all(
    artifacts.map(async (artifact) => {
      const artifactId = text(artifact['id'], 'artifact id');
      return requireData(
        await input.client.request('get_artifact', { id: artifactId }),
        'get_artifact',
      );
    }),
  );
  const readArtifacts = customerReads.map((entry) =>
    record(entry['artifact'], 'customer artifact'),
  );
  const runPrefix = `workspaces/${input.prepared.workspaceId}/runs/${input.runId}/`;
  const allPrivateExactKey = readArtifacts.every((artifact) => {
    const objectKey = text(artifact['object_key'], 'artifact object_key');
    if (!objectKey.startsWith(runPrefix) || /^https?:/u.test(objectKey)) return false;
    const relativeKey = objectKey.slice(runPrefix.length);
    return artifact['artifact_kind'] === 'export'
      ? /^exports\/[0-9a-f]{64}\.zip$/u.test(relativeKey)
      : /^attempts\/[0-9a-f-]{36}\/provider-output$/u.test(relativeKey);
  });
  const allAvailable = readArtifacts.every((artifact) => artifact['status'] === 'available');
  const allContentAddressed = readArtifacts.every(
    (artifact) =>
      typeof artifact['content_hash'] === 'string' &&
      /^[0-9a-f]{64}$/u.test(artifact['content_hash']),
  );
  const context = record(
    await input.postgrest.call('get_export_context', {
      p_run_id: input.runId,
      p_artifact_ids: approvedIds,
    }),
    'export context',
  );
  const providerJobs = records(context['provider_jobs'], 'provider jobs');
  const contextReservation = record(context['reservation'], 'context reservation');
  const contextCaptured = integer(contextReservation['captured_micros'], 'context captured');
  const contextReleased = integer(contextReservation['released_micros'], 'context released');
  const contextAmount = integer(contextReservation['amount_micros'], 'context amount');
  const providerSummary = routeSummary(providerJobs);
  const providerCapture = providerJobs.reduce(
    (sum, job) => sum + integer(job['capture_micros'], 'provider capture'),
    0n,
  );
  const firstReviewableAt = earliestReviewable(terminalArtifacts);
  const confirmedAt = text(run['confirmed_at'], 'run.confirmed_at');
  const terminalAt = text(run['updated_at'], 'run.updated_at');
  const exportMemberRows = lineage.filter((row) => row['relationship'] === 'export_member').length;
  const complete =
    run['status'] === 'succeeded' &&
    reservedMicros === PACK_MICROS &&
    capturedMicros === PACK_MICROS &&
    releasedMicros === 0n &&
    refundedMicros === 0n &&
    residual === 0n &&
    captureLedgerMicros === PACK_MICROS &&
    contextAmount === PACK_MICROS &&
    contextCaptured === PACK_MICROS &&
    contextReleased === 0n &&
    providerCapture === PACK_MICROS &&
    providerSummary.jobs === EXPECTED_PROVIDER_OUTPUTS &&
    providerSummary.unique_attempts === EXPECTED_PROVIDER_OUTPUTS &&
    providerSummary.duplicate_attempts === 0 &&
    providerSummary.all_terminal_succeeded &&
    finalApproved.length === EXPECTED_PROVIDER_OUTPUTS &&
    finalExports.length === 1 &&
    allAvailable &&
    allPrivateExactKey &&
    allContentAddressed &&
    ledgerArtifactIds.size === EXPECTED_PROVIDER_OUTPUTS &&
    approvedIds.every((id) => ledgerArtifactIds.has(id)) &&
    exportMemberRows === EXPECTED_PROVIDER_OUTPUTS;
  if (!complete)
    throw new Error('Final run reconciliation did not satisfy every golden-pack invariant');
  return {
    brief_id: input.brief.briefId,
    outcome: 'completed',
    workspace_id: input.prepared.workspaceId,
    project_id: input.prepared.projectId,
    canvas_id: input.prepared.canvasId,
    revision_id: input.prepared.revisionId,
    revision_hash: input.prepared.revisionHash,
    quote: {
      quote_id: input.prepared.quoteId,
      quoted_micros: input.prepared.totalMicros.toString(10),
      expires_at: input.prepared.expiresAt,
    },
    wallet_credit: input.walletCredit,
    run: {
      run_id: input.runId,
      reservation_id: input.reservationId,
      status: text(run['status'], 'run status'),
      confirmed_at: confirmedAt,
      terminal_at: terminalAt,
      first_reviewable_at: firstReviewableAt,
      time_to_first_reviewable_ms: Date.parse(firstReviewableAt) - Date.parse(confirmedAt),
      time_to_terminal_ms: Date.parse(terminalAt) - Date.parse(confirmedAt),
    },
    money: {
      reserved_micros: reservedMicros.toString(10),
      captured_micros: capturedMicros.toString(10),
      released_micros: releasedMicros.toString(10),
      refunded_micros: refundedMicros.toString(10),
      residual_micros: residual.toString(10),
      capture_ledger_micros: captureLedgerMicros.toString(10),
      catalog_landed_cost_micros: capturedMicros.toString(10),
      external_provider_cost_micros: null,
      external_provider_cost_observability: 'not_observable',
    },
    providers: providerSummary,
    artifacts: {
      customer_reads: customerReads.length,
      approved_outputs: finalApproved.length,
      exports: finalExports.length,
      all_available: allAvailable,
      all_private_exact_key: allPrivateExactKey,
      all_content_addressed: allContentAddressed,
      export_content_hash: firstExportHash,
      export_byte_size: Number(integer(firstExportArtifact['byte_size'], 'export byte_size')),
    },
    approval: { approved: Number(approved['approved']), replayed: Number(replayed['replayed']) },
    export: {
      deterministic: firstExportHash === secondExportHash,
      first_content_hash: firstExportHash,
      second_content_hash: secondExportHash,
    },
    receipt: {
      customer_path_read: true,
      ledger_capture_rows: captureRows.length,
      ledger_artifact_links_complete:
        ledgerArtifactIds.size === EXPECTED_PROVIDER_OUTPUTS &&
        approvedIds.every((id) => ledgerArtifactIds.has(id)),
      lineage_rows: lineage.length,
      export_member_rows: exportMemberRows,
      provider_model_cost_complete: providerJobs.every(
        (job) =>
          typeof job['provider'] === 'string' &&
          typeof job['provider_model_id'] === 'string' &&
          typeof job['route_id'] === 'string' &&
          integer(job['capture_micros'], 'provider capture') > 0n,
      ),
    },
    recovery: input.recovery,
  };
}

export function percentileNearestRank(
  values: readonly number[],
  percentile: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1] ?? null;
}

export function summarizeGolden20Records(
  records: readonly Golden20BriefRecord[],
  duplicateRuns: readonly DuplicateGoldenRunFinding[] = [],
): SafeRecord {
  const completed = records.filter((entry) => entry.outcome === 'completed');
  const failed = records.filter((entry) => entry.outcome === 'failed');
  const deferred = records.filter((entry) => entry.outcome === 'cap_deferred');
  const paidAttempts = records.filter((entry) => entry.run !== undefined);
  const moneyRecords = [...records, ...duplicateRuns];
  const latency = completed
    .map((entry) => entry.run?.time_to_first_reviewable_ms)
    .filter((value): value is number => value !== undefined);
  const total = (field: 'quoted_micros' | 'captured_micros' | 'released_micros'): string => {
    const sum = moneyRecords.reduce((result, entry) => {
      if (field === 'quoted_micros') return result + BigInt(entry.quote?.quoted_micros ?? '0');
      return result + BigInt(entry.money?.[field] ?? '0');
    }, 0n);
    return sum.toString(10);
  };
  const median = percentileNearestRank(latency, 0.5);
  const p90 = percentileNearestRank(latency, 0.9);
  const completedIntegrityPass = completed.every(
    (entry) =>
      entry.money?.residual_micros === '0' &&
      entry.providers?.duplicate_attempts === 0 &&
      entry.artifacts?.all_private_exact_key === true &&
      entry.receipt?.provider_model_cost_complete === true,
  );
  return {
    recorded_at: new Date().toISOString(),
    registered_briefs: records.length,
    paid_attempts: paidAttempts.length + duplicateRuns.length,
    paid_attempt_brief_ids: [
      ...paidAttempts.map((entry) => entry.brief_id),
      ...duplicateRuns.map((entry) => entry.brief_id),
    ],
    duplicate_run_findings: duplicateRuns.length,
    duplicate_brief_ids: duplicateRuns.map((entry) => entry.brief_id),
    completed: completed.length,
    completed_brief_ids: completed.map((entry) => entry.brief_id),
    failed: failed.length,
    failed_brief_ids: failed.map((entry) => entry.brief_id),
    cap_deferred: deferred.length,
    cap_deferred_brief_ids: deferred.map((entry) => entry.brief_id),
    latency: {
      sample_size: latency.length,
      median_first_reviewable_ms: median,
      p90_first_reviewable_ms: p90,
    },
    money: {
      quoted_micros: total('quoted_micros'),
      reserved_micros: moneyRecords
        .reduce((sum, entry) => sum + BigInt(entry.money?.reserved_micros ?? '0'), 0n)
        .toString(10),
      captured_micros: total('captured_micros'),
      released_micros: total('released_micros'),
      residual_micros: moneyRecords
        .reduce((sum, entry) => sum + BigInt(entry.money?.residual_micros ?? '0'), 0n)
        .toString(10),
    },
    acceptance: {
      at_least_16_of_20_complete: completed.length >= 16,
      median_first_reviewable_at_most_10_minutes: median !== null && median <= 600_000,
      p90_first_reviewable_at_most_15_minutes: p90 !== null && p90 <= 900_000,
      zero_duplicate_submissions_or_unexplained_ledger_differences:
        duplicateRuns.length === 0 && completedIntegrityPass,
      completed_runs_have_private_artifacts_lineage_and_receipts: completedIntegrityPass,
      representative_run_completion_and_latency:
        completed.length >= 16 &&
        median !== null &&
        median <= 600_000 &&
        p90 !== null &&
        p90 <= 900_000,
    },
  };
}

async function persist(
  outDirectory: string,
  recordValue: Golden20BriefRecord,
  recordsValue: readonly Golden20BriefRecord[],
): Promise<void> {
  await writeFile(
    `${outDirectory}/${recordValue.brief_id}.json`,
    `${JSON.stringify(recordValue, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    `${outDirectory}/summary.json`,
    `${JSON.stringify(summarizeGolden20Records(recordsValue), null, 2)}\n`,
    'utf8',
  );
}

async function existingRecord(
  outDirectory: string,
  briefId: string,
): Promise<Golden20BriefRecord | null> {
  try {
    return JSON.parse(
      await readFile(`${outDirectory}/${briefId}.json`, 'utf8'),
    ) as Golden20BriefRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function preparedFromRecord(recordValue: Golden20BriefRecord): PreparedGoldenBrief {
  if (
    recordValue.workspace_id === undefined ||
    recordValue.project_id === undefined ||
    recordValue.canvas_id === undefined ||
    recordValue.revision_id === undefined ||
    recordValue.revision_hash === undefined ||
    recordValue.quote === undefined ||
    recordValue.run === undefined
  ) {
    throw new Error(`Paid recovery metadata is incomplete for ${recordValue.brief_id}`);
  }
  return {
    briefId: recordValue.brief_id,
    workspaceId: recordValue.workspace_id,
    projectId: recordValue.project_id,
    canvasId: recordValue.canvas_id,
    revisionId: recordValue.revision_id,
    revisionHash: recordValue.revision_hash,
    quoteId: recordValue.quote.quote_id,
    confirmationToken: 'already-started-run-do-not-replay',
    totalMicros: BigInt(recordValue.quote.quoted_micros),
    expiresAt: recordValue.quote.expires_at,
    startedAt: Date.now(),
    context: {
      workspace_id: recordValue.workspace_id,
      actor_id: 'golden-brief-harness',
      request_id: `golden-20-recover-${recordValue.brief_id}`,
    },
    startIdempotencyKey: `golden-20-recover-${recordValue.brief_id}-never-called`,
  };
}

export async function runGolden20StagingHarness(options: {
  readonly briefs: readonly GoldenCampaignBrief[];
  readonly outDirectory: string;
  readonly accessToken: string;
  readonly log: (message: string) => void;
}): Promise<number> {
  const configuration = await loadStagingAdminConfiguration();
  const postgrest = createPostgrestClient(configuration);
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, options.accessToken);
  const client = createMustBeViralRestClient({
    baseUrl: STAGING_CORE_URL,
    getAccessToken: async () => options.accessToken,
  });
  const invocationId = randomUUID();
  const results: Golden20BriefRecord[] = [];
  await mkdir(options.outDirectory, { recursive: true });
  for (const brief of options.briefs) {
    const prior = await existingRecord(options.outDirectory, brief.briefId);
    if (prior?.outcome === 'completed' || prior?.outcome === 'cap_deferred') {
      results.push(prior);
      continue;
    }
    if (prior?.run !== undefined) {
      try {
        const prepared = preparedFromRecord(prior);
        const walletCredit = prior.wallet_credit ?? (await creditWorkspace(postgrest, prepared));
        options.log(
          `RESUMING brief=${brief.briefId} run_id=${prior.run.run_id} reservation_id=${prior.run.reservation_id} observed_at=${new Date().toISOString()}`,
        );
        const polled = await pollWithRecovery(
          transport,
          prepared,
          prior.run.run_id,
          postgrest,
          options.log,
        );
        const completed = await approveExportAndReconcile({
          brief,
          prepared,
          runId: prior.run.run_id,
          reservationId: prior.run.reservation_id,
          terminal: polled.terminal,
          recovery: {
            exercised: true,
            reason: prior.failure?.code ?? 'harness_process_resume',
          },
          walletCredit,
          client,
          postgrest,
        });
        results.push(completed);
        await persist(options.outDirectory, completed, results);
        options.log(
          `RECOVERED brief=${brief.briefId} run_id=${prior.run.run_id} observed_at=${new Date().toISOString()}`,
        );
        continue;
      } catch (error) {
        const failed = { ...prior, outcome: 'failed' as const, failure: safeFailure(error) };
        results.push(failed);
        await persist(options.outDirectory, failed, results);
        options.log(
          `RECOVERY_FAILED brief=${brief.briefId} code=${failed.failure.code} observed_at=${new Date().toISOString()}`,
        );
        continue;
      }
    }
    const exposure = await getSpendExposure(postgrest);
    const safeCount = safeGoldenPackCount(exposure);
    options.log(
      `CAP brief=${brief.briefId} remaining_micros=${exposure.global_remaining_micros} safe_pack_count=${String(safeCount)} observed_at=${exposure.observed_at}`,
    );
    if (safeCount < 1) {
      const deferred: Golden20BriefRecord = {
        brief_id: brief.briefId,
        outcome: 'cap_deferred',
        cap_observation: exposure,
        failure: {
          code: 'GLOBAL_CAP_HEADROOM_RESERVED',
          message: 'Deferred to preserve the required operator self-session headroom.',
        },
      };
      results.push(deferred);
      await persist(options.outDirectory, deferred, results);
      continue;
    }
    let prepared: PreparedGoldenBrief | undefined;
    let walletCredit: NonNullable<Golden20BriefRecord['wallet_credit']> | undefined;
    let runId: string | undefined;
    let reservationId: string | undefined;
    try {
      prepared = await prepareGoldenBrief(brief, transport, Date.now, invocationId);
      if (prepared.totalMicros !== PACK_MICROS) {
        throw new Error(
          `Quote was ${prepared.totalMicros.toString(10)} micros, expected ${PACK_MICROS.toString(10)}`,
        );
      }
      walletCredit = await creditWorkspace(postgrest, prepared);
      const started = await startPreparedGoldenBrief(prepared, transport, false);
      runId = text(started.run_id, 'started run id');
      reservationId = text(started.reservation_id, 'started reservation id');
      options.log(
        `STARTED brief=${brief.briefId} run_id=${runId} reservation_id=${reservationId} observed_at=${new Date().toISOString()}`,
      );
      const checkpoint: Golden20BriefRecord = {
        brief_id: brief.briefId,
        outcome: 'failed',
        workspace_id: prepared.workspaceId,
        project_id: prepared.projectId,
        canvas_id: prepared.canvasId,
        revision_id: prepared.revisionId,
        revision_hash: prepared.revisionHash,
        quote: {
          quote_id: prepared.quoteId,
          quoted_micros: prepared.totalMicros.toString(10),
          expires_at: prepared.expiresAt,
        },
        wallet_credit: walletCredit,
        run: {
          run_id: runId,
          reservation_id: reservationId,
          status: started.initial_status ?? 'queued',
        },
        cap_observation: exposure,
        failure: {
          code: 'RUN_IN_PROGRESS_CHECKPOINT',
          message: 'Confirmed run checkpoint; resume this run and never start the brief again.',
        },
      };
      results.push(checkpoint);
      await persist(options.outDirectory, checkpoint, results);
      results.pop();
      const polled = await pollWithRecovery(transport, prepared, runId, postgrest, options.log);
      const completed = await approveExportAndReconcile({
        brief,
        prepared,
        runId,
        reservationId,
        terminal: polled.terminal,
        recovery: polled.recovery,
        walletCredit,
        client,
        postgrest,
      });
      results.push(completed);
      await persist(options.outDirectory, completed, results);
      options.log(
        `COMPLETED brief=${brief.briefId} run_id=${runId} captured_micros=${completed.money?.captured_micros ?? 'unknown'} observed_at=${new Date().toISOString()}`,
      );
    } catch (error) {
      const failure: Golden20BriefRecord = {
        brief_id: brief.briefId,
        outcome: 'failed',
        ...(prepared === undefined
          ? {}
          : {
              workspace_id: prepared.workspaceId,
              project_id: prepared.projectId,
              canvas_id: prepared.canvasId,
              revision_id: prepared.revisionId,
              revision_hash: prepared.revisionHash,
              quote: {
                quote_id: prepared.quoteId,
                quoted_micros: prepared.totalMicros.toString(10),
                expires_at: prepared.expiresAt,
              },
            }),
        ...(walletCredit === undefined ? {} : { wallet_credit: walletCredit }),
        ...(runId === undefined || reservationId === undefined
          ? {}
          : {
              run: {
                run_id: runId,
                reservation_id: reservationId,
                status: 'finding',
              },
            }),
        cap_observation: exposure,
        failure: safeFailure(error),
      };
      results.push(failure);
      await persist(options.outDirectory, failure, results);
      options.log(
        `FAILED brief=${brief.briefId} code=${failure.failure?.code ?? 'unknown'} observed_at=${new Date().toISOString()}`,
      );
    }
  }
  const summary = summarizeGolden20Records(results);
  options.log(`GOLDEN_20_SUMMARY ${JSON.stringify(summary)}`);
  return results.some((entry) => entry.outcome === 'failed') ? 1 : 0;
}
