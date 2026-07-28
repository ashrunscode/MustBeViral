import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  HarnessFlowError,
  StagingLaunchPackTransport,
  createInMemoryHarnessTransport,
  type HarnessResult,
  type HarnessTransport,
  type HarnessTransportOperation,
  type SafeHarnessError,
} from './launch-pack-harness-lib';
import { authenticateDisposableStagingUser, loadStagingAuthConfiguration } from './staging-auth';

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const EXPECTED_QUOTE_MICROS = 500_000n;
const DEFAULT_TIMEOUT_MILLISECONDS = 10 * 60 * 1000;
const DEFAULT_POLL_MILLISECONDS = 5_000;
const TERMINAL_RUN_STATES = new Set(['succeeded', 'failed', 'canceled']);
const FORBIDDEN_DELIVERY_HOSTS = ['fal.media', 'fal.run', 'fal.ai'] as const;

export interface SingleImageCanaryGraph {
  readonly nodes: readonly Readonly<Record<string, unknown>>[];
  readonly edges: readonly Readonly<Record<string, unknown>>[];
}

export function buildSingleImageCanaryGraph(): SingleImageCanaryGraph {
  return {
    nodes: [
      {
        id: 'brief',
        kind: 'brief',
        parameter_schema_version: 1,
        parameters: {
          brief_id: 'single-image-canary',
          product: 'MustBeViral staging canary',
          objective: 'Generate one private master-static validation image.',
        },
      },
      {
        id: 'brand-context',
        kind: 'brand_context',
        parameter_schema_version: 1,
        parameters: {
          approved_facts: 'Synthetic canary content only.',
          visual_direction: 'Clean studio product still life with no logos or people.',
        },
      },
      {
        id: 'master-static',
        kind: 'image_generation',
        parameter_schema_version: 1,
        parameters: {
          asset_role: 'master_static',
          prompt:
            'A clean studio still life of a blank cobalt reusable bottle on a pale gray background.',
          aspect_ratio: '1:1',
        },
      },
    ],
    edges: [
      {
        id: 'edge-brief-brand-context',
        kind: 'dependency',
        source_node_id: 'brief',
        target_node_id: 'brand-context',
      },
      {
        id: 'edge-brand-context-master-static',
        kind: 'dependency',
        source_node_id: 'brand-context',
        target_node_id: 'master-static',
      },
    ],
  };
}

interface CanaryArguments {
  readonly mode: 'dry-run' | 'staging';
  readonly workspaceId: string;
  readonly outDirectory: string;
  readonly timeoutMilliseconds: number;
  readonly pollMilliseconds: number;
}

interface AssertionDefinition {
  readonly id: string;
  readonly check: string;
}

const ASSERTION_DEFINITIONS = [
  {
    id: 'graph_exact_shape',
    check: 'Graph has exactly three nodes and two legal dependency edges.',
  },
  {
    id: 'graph_one_priced_node',
    check: "Graph has exactly one priced output and its asset_role is 'master_static'.",
  },
  { id: 'validate_graph', check: 'validate_graph returns valid=true.' },
  { id: 'quote_one_line', check: 'Quote contains exactly one priced node line.' },
  { id: 'quote_total', check: 'Quote total is exactly 500000 USD micros.' },
  { id: 'quote_window', check: 'Quote expiry is exactly 15 minutes after creation.' },
  {
    id: 'start_run_accepted',
    check: 'Explicitly confirmed start_run succeeds; MODEL_UNAVAILABLE is a failure.',
  },
  { id: 'terminal_before_timeout', check: 'get_run reaches a terminal state before timeout.' },
  { id: 'run_succeeded', check: "Terminal run status is exactly 'succeeded'." },
  { id: 'one_attempt', check: 'Exactly one persisted attempt exists for the run.' },
  { id: 'one_provider_job', check: 'Exactly one persisted provider job exists for the run.' },
  {
    id: 'attempt_provider_job_link',
    check: 'The provider job links to the sole succeeded attempt and priced run node.',
  },
  { id: 'one_artifact', check: 'Exactly one persisted artifact exists for the run.' },
  {
    id: 'artifact_provider_output',
    check: "The artifact artifact_kind is exactly 'provider_output'.",
  },
  { id: 'artifact_available', check: "The artifact status is exactly 'available'." },
  {
    id: 'artifact_content_hash',
    check: 'The artifact content_hash is a lowercase 64-character SHA-256 hex digest.',
  },
  { id: 'artifact_nonempty', check: 'The artifact byte_size is greater than zero.' },
  {
    id: 'artifact_workspace_run_prefix',
    check: 'The artifact object_key is scoped under the exact workspace and run prefix.',
  },
  { id: 'artifact_key_private', check: "The artifact object_key contains no '://' sequence." },
  { id: 'reservation_amount', check: 'The reservation amount is exactly 500000 micros.' },
  { id: 'capture_total', check: 'The captured amount is exactly 500000 micros.' },
  {
    id: 'reservation_zero_residual',
    check: 'Reservation amount - captured - released equals zero.',
  },
  {
    id: 'receipt_provider_model_cost_lineage',
    check:
      'Receipt ledger, persisted provider job, model route, and artifact join to one real fal model and one capture transaction.',
  },
  {
    id: 'privacy_api_responses',
    check: 'No forbidden provider delivery host appears in any observed raw API response body.',
  },
  {
    id: 'privacy_artifact_fields',
    check: 'No forbidden provider delivery host appears in any observed persisted artifact field.',
  },
] as const satisfies readonly AssertionDefinition[];

type AssertionId = (typeof ASSERTION_DEFINITIONS)[number]['id'];

interface AssertionResult {
  readonly id: AssertionId;
  readonly check: string;
  readonly passed: boolean;
  readonly observed: unknown;
}

class Assertions {
  readonly #results = new Map<AssertionId, AssertionResult>();

  check(id: AssertionId, passed: boolean, observed: unknown): void {
    const definition = ASSERTION_DEFINITIONS.find((candidate) => candidate.id === id);
    if (definition === undefined) throw new TypeError(`Unknown assertion ${id}`);
    this.#results.set(id, { id, check: definition.check, passed, observed });
  }

  require(id: AssertionId, passed: boolean, observed: unknown): void {
    this.check(id, passed, observed);
    if (!passed) {
      throw new HarnessFlowError({
        code: 'CANARY_ASSERTION_FAILED',
        message: `Canary assertion failed: ${id}.`,
      });
    }
  }

  complete(): readonly AssertionResult[] {
    return ASSERTION_DEFINITIONS.map(
      (definition) =>
        this.#results.get(definition.id) ?? {
          id: definition.id,
          check: definition.check,
          passed: false,
          observed: 'not_reached',
        },
    );
  }
}

class PrivacyScanner {
  responseBodiesScanned = 0;
  artifactFieldsScanned = 0;
  readonly responseViolations: string[] = [];
  readonly artifactViolations: string[] = [];

  scanResponse(label: string, rawResponseText: string): void {
    this.responseBodiesScanned += 1;
    if (containsForbiddenDeliveryHost(rawResponseText)) this.responseViolations.push(label);
  }

  scanArtifact(label: string, artifact: Readonly<Record<string, unknown>>): void {
    this.artifactFieldsScanned += 1;
    if (containsForbiddenDeliveryHost(JSON.stringify(artifact))) {
      this.artifactViolations.push(label);
    }
  }
}

export function containsForbiddenDeliveryHost(value: string): boolean {
  const normalized = value.toLowerCase();
  return FORBIDDEN_DELIVERY_HOSTS.some((host) => normalized.includes(host));
}

function record(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HarnessFlowError({
      code: 'INVALID_RESPONSE',
      message: `${field} was not an object.`,
    });
  }
  return value as Readonly<Record<string, unknown>>;
}

function records(value: unknown, field: string): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value)) {
    throw new HarnessFlowError({
      code: 'INVALID_RESPONSE',
      message: `${field} was not an array.`,
    });
  }
  return value.map((entry, index) => record(entry, `${field}[${String(index)}]`));
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessFlowError({
      code: 'INVALID_RESPONSE',
      message: `${field} was missing.`,
    });
  }
  return value;
}

function micros(value: unknown, field: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^\d+$/u.test(value)) return BigInt(value);
  throw new HarnessFlowError({
    code: 'INVALID_RESPONSE',
    message: `${field} was not a non-negative integer-micros value.`,
  });
}

function integer(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new HarnessFlowError({
    code: 'INVALID_RESPONSE',
    message: `${field} was not a safe integer.`,
  });
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === 'bigint' ? entry.toString(10) : entry,
  );
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index < 0 ? undefined : argv[index + 1];
}

function positiveIntegerFlag(argv: readonly string[], flag: string, fallback: number): number {
  const raw = flagValue(argv, flag);
  if (raw === undefined) return fallback;
  if (!/^\d+$/u.test(raw)) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `${flag} requires a positive integer.`,
    });
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `${flag} requires a positive safe integer.`,
    });
  }
  return parsed;
}

export function singleImageCanaryArguments(argv: readonly string[]): CanaryArguments {
  const dryRun = argv.includes('--dry-run');
  const staging = argv.includes('--staging');
  if (dryRun === staging) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: 'Select exactly one mode: --dry-run or --staging.',
    });
  }
  const workspaceId = flagValue(argv, '--workspace');
  if (
    workspaceId === undefined ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(workspaceId)
  ) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--workspace requires an existing workspace UUID.',
    });
  }
  const outDirectory = flagValue(argv, '--out');
  if (outDirectory === undefined || outDirectory.length === 0 || outDirectory.startsWith('--')) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--out requires a directory path.',
    });
  }
  return {
    mode: dryRun ? 'dry-run' : 'staging',
    workspaceId,
    outDirectory,
    timeoutMilliseconds: positiveIntegerFlag(argv, '--timeout-ms', DEFAULT_TIMEOUT_MILLISECONDS),
    pollMilliseconds: positiveIntegerFlag(argv, '--poll-ms', DEFAULT_POLL_MILLISECONDS),
  };
}

function safeFailure(error: unknown): SafeHarnessError {
  if (error instanceof HarnessFlowError) return error.safe;
  return {
    code: 'CANARY_FAILURE',
    message: 'The single-image canary encountered an internal failure.',
  };
}

function requireOk(result: HarnessResult): Readonly<Record<string, unknown>> {
  if (!result.ok) throw new HarnessFlowError(result.error);
  return result.data;
}

interface PersistenceSnapshot {
  readonly attempts: readonly Readonly<Record<string, unknown>>[];
  readonly providerJobs: readonly Readonly<Record<string, unknown>>[];
  readonly artifacts: readonly Readonly<Record<string, unknown>>[];
  readonly runNodes: readonly Readonly<Record<string, unknown>>[];
  readonly modelRoutes: readonly Readonly<Record<string, unknown>>[];
  readonly providerRegistrations: readonly Readonly<Record<string, unknown>>[];
}

function dryRunPersistence(receipt: Readonly<Record<string, unknown>>): PersistenceSnapshot {
  return {
    attempts: records(receipt.attempts, 'receipt.attempts'),
    providerJobs: records(receipt.provider_jobs, 'receipt.provider_jobs'),
    artifacts: records(receipt.artifacts, 'receipt.artifacts'),
    runNodes: records(receipt.run_nodes, 'receipt.run_nodes'),
    modelRoutes: records(receipt.model_routes, 'receipt.model_routes'),
    providerRegistrations: records(
      receipt.provider_registrations,
      'receipt.provider_registrations',
    ),
  };
}

class StagingPersistenceProbe {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
    private readonly accessToken: string,
    private readonly scanner: PrivacyScanner,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async #query(
    table: string,
    select: string,
    filters: Readonly<Record<string, string>>,
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const url = new URL(`/rest/v1/${table}`, this.supabaseUrl);
    url.searchParams.set('select', select);
    for (const [field, value] of Object.entries(filters))
      url.searchParams.set(field, `eq.${value}`);
    const response = await this.fetchImplementation(url, {
      headers: {
        accept: 'application/json',
        apikey: this.publishableKey,
        authorization: `Bearer ${this.accessToken}`,
      },
    });
    const rawResponseText = await response.text();
    this.scanner.scanResponse(`supabase:${table}`, rawResponseText);
    if (!response.ok) {
      throw new HarnessFlowError({
        code: 'PERSISTENCE_PROBE_FAILED',
        message: `The staging persistence probe failed for ${table}.`,
        http_status: response.status,
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResponseText) as unknown;
    } catch {
      throw new HarnessFlowError({
        code: 'PERSISTENCE_PROBE_INVALID',
        message: `The staging persistence probe returned invalid JSON for ${table}.`,
      });
    }
    return records(parsed, table);
  }

  async inspect(workspaceId: string, runId: string): Promise<PersistenceSnapshot> {
    const runFilters = { workspace_id: workspaceId, run_id: runId };
    const [attempts, providerJobs, artifacts, runNodes] = await Promise.all([
      this.#query(
        'attempts',
        'id,run_id,run_node_id,provider_registration_id,attempt_number,status',
        runFilters,
      ),
      this.#query(
        'provider_jobs',
        'id,run_id,attempt_id,provider_registration_id,status',
        runFilters,
      ),
      this.#query(
        'artifacts',
        'id,run_id,artifact_kind,status,object_key,content_hash,byte_size',
        runFilters,
      ),
      this.#query('run_nodes', 'id,run_id,node_key,model_route_id,status', runFilters),
    ]);
    const runNode = runNodes[0];
    const attempt = attempts[0];
    const modelRouteId =
      runNode === undefined
        ? 'missing-model-route'
        : text(runNode.model_route_id, 'model_route_id');
    const providerRegistrationId =
      attempt === undefined
        ? 'missing-provider-registration'
        : text(attempt.provider_registration_id, 'provider_registration_id');
    const [modelRoutes, providerRegistrations] = await Promise.all([
      this.#query(
        'model_routes',
        'id,provider_registration_id,route_key,provider_model_id,status',
        { id: modelRouteId },
      ),
      this.#query('provider_registrations', 'id,provider_key,status', {
        id: providerRegistrationId,
      }),
    ]);
    return { attempts, providerJobs, artifacts, runNodes, modelRoutes, providerRegistrations };
  }
}

function quoteWindowMilliseconds(quote: Readonly<Record<string, unknown>>): number {
  const createdAt = text(quote.createdAt, 'quote.createdAt');
  const expiresAt = text(quote.expiresAt, 'quote.expiresAt');
  return Date.parse(expiresAt) - Date.parse(createdAt);
}

function matchingCaptureEntries(
  receipt: Readonly<Record<string, unknown>>,
  runId: string,
  attemptId: string,
): readonly Readonly<Record<string, unknown>>[] {
  const causativeKey = `run:${runId}:attempt:${attemptId}:capture`;
  return records(receipt.ledger, 'receipt.ledger').filter(
    (entry) => entry.entry_type === 'capture' && entry.causative_key === causativeKey,
  );
}

function uniqueTextValues(
  rows: readonly Readonly<Record<string, unknown>>[],
  field: string,
): readonly string[] {
  return [...new Set(rows.map((row) => text(row[field], field)))];
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

interface CanaryEvidence {
  schema_version: 1;
  mode: 'dry-run' | 'staging';
  workspace_id: string;
  graph_shape: Readonly<{
    nodes: readonly string[];
    edges: readonly string[];
    priced_nodes: readonly string[];
  }>;
  quote_micros: string | null;
  quote_id: string | null;
  run_id: string | null;
  artifact_id: string | null;
  content_hash: string | null;
  object_key: string | null;
  money: Readonly<{
    amount_micros: string | null;
    captured_micros: string | null;
    released_micros: string | null;
    residual_micros: string | null;
  }>;
  lineage: Readonly<{
    provider: string | null;
    model_id: string | null;
    capture_micros: string | null;
  }>;
  terminal_latency_ms: number | null;
  raw_response_bodies_scanned: number;
  artifact_records_scanned: number;
  assertions: readonly AssertionResult[];
  error: SafeHarnessError | null;
}

export async function runSingleImageCanary(
  argv: readonly string[],
  log: (message: string) => void = console.log,
): Promise<number> {
  const options = singleImageCanaryArguments(argv);
  const assertions = new Assertions();
  const scanner = new PrivacyScanner();
  const graph = buildSingleImageCanaryGraph();
  const pricedNodes = graph.nodes.filter((node) => {
    const parameters = record(node.parameters, 'node.parameters');
    return typeof parameters.asset_role === 'string';
  });
  assertions.require('graph_exact_shape', graph.nodes.length === 3 && graph.edges.length === 2, {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
  });
  assertions.require(
    'graph_one_priced_node',
    pricedNodes.length === 1 &&
      record(pricedNodes[0]?.parameters, 'priced_node.parameters').asset_role === 'master_static',
    {
      priced_node_count: pricedNodes.length,
      asset_role:
        pricedNodes[0] === undefined
          ? null
          : record(pricedNodes[0].parameters, 'priced_node.parameters').asset_role,
    },
  );

  await mkdir(options.outDirectory, { recursive: true });
  const runSuffix = randomBytes(6).toString('hex');
  const context = {
    workspace_id: options.workspaceId,
    actor_id: 'single-image-canary',
    request_id: `single-image-canary-${runSuffix}`,
  };
  const idempotency = (operation: string): string =>
    `single-image-canary:${runSuffix}:${operation}`;
  let transport: HarnessTransport;
  let stagingProbe: StagingPersistenceProbe | null = null;
  if (options.mode === 'dry-run') {
    transport = createInMemoryHarnessTransport({ providerResult: 'succeeded' });
  } else {
    const configuration = await loadStagingAuthConfiguration();
    const authentication = await authenticateDisposableStagingUser({
      configuration,
      log,
      observeResponseBody: (body) => scanner.scanResponse('supabase:auth', body),
    });
    log(`AUTHENTICATED staging test user: ${authentication.email}`);
    transport = new StagingLaunchPackTransport(
      STAGING_CORE_URL,
      authentication.accessToken,
      fetch,
      (body) => scanner.scanResponse('core', body),
    );
    stagingProbe = new StagingPersistenceProbe(
      configuration.supabaseUrl,
      configuration.publishableKey,
      authentication.accessToken,
      scanner,
    );
  }

  const call = async (
    operation: HarnessTransportOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<HarnessResult> => {
    const result = await transport.call(operation, input);
    if (options.mode === 'dry-run')
      scanner.scanResponse(`in-memory:${operation}`, safeJson(result));
    return result;
  };

  let quoteMicros: bigint | null = null;
  let quoteId: string | null = null;
  let runId: string | null = null;
  let artifactId: string | null = null;
  let contentHash: string | null = null;
  let objectKey: string | null = null;
  let amountMicros: bigint | null = null;
  let capturedMicros: bigint | null = null;
  let releasedMicros: bigint | null = null;
  let residualMicros: bigint | null = null;
  let terminalLatencyMilliseconds: number | null = null;
  let lineageProvider: string | null = null;
  let lineageModel: string | null = null;
  let lineageCaptureMicros: bigint | null = null;
  let failure: SafeHarnessError | null = null;

  try {
    const projectResult = requireOk(
      await call('create_project', {
        context,
        workspace_id: options.workspaceId,
        name: `Single-image canary ${runSuffix}`,
        idempotency_key: idempotency('project'),
      }),
    );
    const projectId = text(record(projectResult.project, 'project').id, 'project.id');
    const canvasResult = requireOk(
      await call('create_canvas', {
        context,
        project_id: projectId,
        name: `Single-image canary ${runSuffix}`,
        idempotency_key: idempotency('canvas'),
      }),
    );
    const canvasId = text(canvasResult.canvasId, 'canvasId');
    const initialRevisionId = text(canvasResult.revisionId, 'revisionId');
    const patchResult = requireOk(
      await call('apply_canvas_patch', {
        context,
        canvas_id: canvasId,
        expected_revision_id: initialRevisionId,
        reason: 'Build the single-image provider canary graph.',
        patch: {
          upsert_nodes: graph.nodes,
          remove_node_ids: [],
          upsert_edges: graph.edges,
          remove_edge_ids: [],
        },
        idempotency_key: idempotency('patch'),
      }),
    );
    const revisionId = text(patchResult.revisionId, 'revisionId');
    const validation = requireOk(await call('validate_graph', { context, canvas_id: canvasId }));
    assertions.require('validate_graph', validation.valid === true, {
      valid: validation.valid === true,
    });

    const quoteResult = requireOk(
      await call('quote_run', {
        context,
        canvas_id: canvasId,
        expected_revision_id: revisionId,
        idempotency_key: idempotency('quote'),
      }),
    );
    const quote = record(quoteResult.quote, 'quote');
    quoteId = text(quote.quoteId, 'quote.quoteId');
    const quoteLines = records(quote.nodeLines, 'quote.nodeLines');
    quoteMicros = micros(quote.maximumChargeMicros, 'quote.maximumChargeMicros');
    assertions.require('quote_one_line', quoteLines.length === 1, {
      node_line_count: quoteLines.length,
    });
    assertions.require('quote_total', quoteMicros === EXPECTED_QUOTE_MICROS, {
      total_micros: quoteMicros.toString(10),
    });
    const quoteWindow = quoteWindowMilliseconds(quote);
    assertions.require('quote_window', quoteWindow === 15 * 60 * 1000, {
      window_ms: quoteWindow,
    });

    const startRequestedAt = Date.now();
    const startResult = await call('start_run', {
      context,
      quote_id: quoteId,
      confirmed: true,
      confirmation_token: `single-image-canary-confirmation-${runSuffix}`,
      idempotency_key: idempotency('start'),
    });
    assertions.require(
      'start_run_accepted',
      startResult.ok,
      startResult.ok ? { accepted: true } : { accepted: false, error_code: startResult.error.code },
    );
    const startedRun = record(requireOk(startResult).run, 'run');
    runId = text(startedRun.runId, 'run.runId');

    let terminalRun: Readonly<Record<string, unknown>> | null = null;
    while (Date.now() - startRequestedAt <= options.timeoutMilliseconds) {
      const polled = requireOk(await call('get_run', { context, run_id: runId }));
      const run = record(polled.run, 'run');
      const status = text(run.status, 'run.status');
      if (TERMINAL_RUN_STATES.has(status)) {
        terminalRun = run;
        terminalLatencyMilliseconds = Math.max(0, Date.now() - startRequestedAt);
        break;
      }
      await sleep(options.pollMilliseconds);
    }
    assertions.require(
      'terminal_before_timeout',
      terminalRun !== null,
      terminalRun === null
        ? { timeout_ms: options.timeoutMilliseconds }
        : { latency_ms: terminalLatencyMilliseconds },
    );
    const terminalStatus = text(terminalRun?.status, 'terminal_run.status');
    assertions.require('run_succeeded', terminalStatus === 'succeeded', {
      status: terminalStatus,
    });

    const receiptResult = requireOk(await call('get_receipt', { context, run_id: runId }));
    const receipt = record(receiptResult.receipt, 'receipt');
    const persistence =
      options.mode === 'dry-run'
        ? dryRunPersistence(receipt)
        : await (stagingProbe as StagingPersistenceProbe).inspect(options.workspaceId, runId);
    assertions.require('one_attempt', persistence.attempts.length === 1, {
      count: persistence.attempts.length,
    });
    assertions.require('one_provider_job', persistence.providerJobs.length === 1, {
      count: persistence.providerJobs.length,
    });
    const attempt = record(persistence.attempts[0], 'attempt');
    const providerJob = record(persistence.providerJobs[0], 'provider_job');
    const runNode = record(persistence.runNodes[0], 'run_node');
    const attemptId = text(attempt.id, 'attempt.id');
    const providerJobAttemptId = text(providerJob.attempt_id, 'provider_job.attempt_id');
    const attemptRunNodeId = text(attempt.run_node_id, 'attempt.run_node_id');
    const runNodeId = text(runNode.id, 'run_node.id');
    assertions.require(
      'attempt_provider_job_link',
      providerJobAttemptId === attemptId &&
        attemptRunNodeId === runNodeId &&
        attempt.status === 'succeeded' &&
        providerJob.status === 'succeeded' &&
        runNode.status === 'succeeded',
      {
        linked: providerJobAttemptId === attemptId && attemptRunNodeId === runNodeId,
        attempt_status: attempt.status,
        provider_job_status: providerJob.status,
        run_node_status: runNode.status,
      },
    );

    assertions.require('one_artifact', persistence.artifacts.length === 1, {
      count: persistence.artifacts.length,
    });
    const artifact = record(persistence.artifacts[0], 'artifact');
    scanner.scanArtifact('persisted-artifact', artifact);
    artifactId = text(artifact.id, 'artifact.id');
    contentHash = text(artifact.content_hash, 'artifact.content_hash');
    objectKey = text(artifact.object_key, 'artifact.object_key');
    assertions.require('artifact_provider_output', artifact.artifact_kind === 'provider_output', {
      artifact_kind: artifact.artifact_kind,
    });
    assertions.require('artifact_available', artifact.status === 'available', {
      status: artifact.status,
    });
    assertions.require('artifact_content_hash', /^[0-9a-f]{64}$/u.test(contentHash), {
      content_hash: contentHash,
    });
    const byteSize = integer(artifact.byte_size, 'artifact.byte_size');
    assertions.require('artifact_nonempty', byteSize > 0, { byte_size: byteSize });
    const expectedObjectPrefix = `workspaces/${options.workspaceId}/runs/${runId}/`;
    assertions.require(
      'artifact_workspace_run_prefix',
      objectKey.startsWith(expectedObjectPrefix),
      { expected_prefix: expectedObjectPrefix, object_key: objectKey },
    );
    assertions.require('artifact_key_private', !objectKey.includes('://'), {
      contains_uri_scheme: objectKey.includes('://'),
    });

    const reservation = record(receipt.reservation, 'receipt.reservation');
    amountMicros = micros(reservation.amount_micros, 'reservation.amount_micros');
    capturedMicros = micros(reservation.captured_micros, 'reservation.captured_micros');
    releasedMicros = micros(reservation.released_micros, 'reservation.released_micros');
    residualMicros = amountMicros - capturedMicros - releasedMicros;
    assertions.require('reservation_amount', amountMicros === EXPECTED_QUOTE_MICROS, {
      amount_micros: amountMicros.toString(10),
    });
    assertions.require('capture_total', capturedMicros === EXPECTED_QUOTE_MICROS, {
      captured_micros: capturedMicros.toString(10),
    });
    assertions.require('reservation_zero_residual', residualMicros === 0n, {
      amount_micros: amountMicros.toString(10),
      captured_micros: capturedMicros.toString(10),
      released_micros: releasedMicros.toString(10),
      residual_micros: residualMicros.toString(10),
    });

    const modelRoute = record(persistence.modelRoutes[0], 'model_route');
    const providerRegistration = record(
      persistence.providerRegistrations[0],
      'provider_registration',
    );
    lineageProvider = text(providerRegistration.provider_key, 'provider.provider_key');
    lineageModel = text(modelRoute.provider_model_id, 'model_route.provider_model_id');
    const captureEntries = matchingCaptureEntries(receipt, runId, attemptId);
    const captureTransactions = uniqueTextValues(captureEntries, 'transaction_id');
    lineageCaptureMicros =
      captureEntries[0] === undefined
        ? null
        : micros(captureEntries[0].amount_micros, 'capture.amount_micros');
    const receiptArtifacts = records(receipt.artifacts, 'receipt.artifacts');
    assertions.require(
      'receipt_provider_model_cost_lineage',
      lineageProvider === 'fal' &&
        lineageModel === text(quoteLines[0]?.providerModelId, 'quote.line.providerModelId') &&
        !/mock|fixture|fake/iu.test(lineageModel) &&
        text(modelRoute.id, 'model_route.id') ===
          text(runNode.model_route_id, 'run_node.model_route_id') &&
        text(modelRoute.provider_registration_id, 'model_route.provider_registration_id') ===
          text(attempt.provider_registration_id, 'attempt.provider_registration_id') &&
        text(providerJob.provider_registration_id, 'provider_job.provider_registration_id') ===
          text(attempt.provider_registration_id, 'attempt.provider_registration_id') &&
        captureEntries.length === 2 &&
        captureTransactions.length === 1 &&
        captureEntries.every(
          (entry) => micros(entry.amount_micros, 'capture.amount_micros') === EXPECTED_QUOTE_MICROS,
        ) &&
        receiptArtifacts.length === 1 &&
        receiptArtifacts[0]?.id === artifactId,
      {
        provider: lineageProvider,
        model_id: lineageModel,
        capture_micros: lineageCaptureMicros?.toString(10) ?? null,
        capture_ledger_entries: captureEntries.length,
        capture_transactions: captureTransactions.length,
        receipt_artifacts: receiptArtifacts.length,
      },
    );
  } catch (error) {
    failure = safeFailure(error);
  }

  assertions.check('privacy_api_responses', scanner.responseViolations.length === 0, {
    scanned: scanner.responseBodiesScanned,
    violation_locations: scanner.responseViolations,
  });
  assertions.check('privacy_artifact_fields', scanner.artifactViolations.length === 0, {
    scanned: scanner.artifactFieldsScanned,
    violation_locations: scanner.artifactViolations,
  });
  const assertionResults = assertions.complete();
  const passed = failure === null && assertionResults.every((assertion) => assertion.passed);
  if (!passed && failure === null) {
    failure = {
      code: 'CANARY_ASSERTION_FAILED',
      message: 'One or more single-image canary assertions failed.',
    };
  }

  const evidence: CanaryEvidence = {
    schema_version: 1,
    mode: options.mode,
    workspace_id: options.workspaceId,
    graph_shape: {
      nodes: graph.nodes.map((node) => text(node.id, 'graph.node.id')),
      edges: graph.edges.map((edge) => text(edge.id, 'graph.edge.id')),
      priced_nodes: pricedNodes.map((node) => text(node.id, 'graph.priced_node.id')),
    },
    quote_micros: quoteMicros?.toString(10) ?? null,
    quote_id: quoteId,
    run_id: runId,
    artifact_id: artifactId,
    content_hash: contentHash,
    object_key: objectKey,
    money: {
      amount_micros: amountMicros?.toString(10) ?? null,
      captured_micros: capturedMicros?.toString(10) ?? null,
      released_micros: releasedMicros?.toString(10) ?? null,
      residual_micros: residualMicros?.toString(10) ?? null,
    },
    lineage: {
      provider: lineageProvider,
      model_id: lineageModel,
      capture_micros: lineageCaptureMicros?.toString(10) ?? null,
    },
    terminal_latency_ms: terminalLatencyMilliseconds,
    raw_response_bodies_scanned: scanner.responseBodiesScanned,
    artifact_records_scanned: scanner.artifactFieldsScanned,
    assertions: assertionResults,
    error: failure,
  };
  const evidencePath = `${options.outDirectory}/single-image-canary-evidence.json`;
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  const summary = {
    mode: options.mode,
    passed,
    quote_micros: evidence.quote_micros,
    run_id: evidence.run_id,
    artifact_id: evidence.artifact_id,
    terminal_latency_ms: evidence.terminal_latency_ms,
    assertions_passed: assertionResults.filter((assertion) => assertion.passed).length,
    assertions_total: assertionResults.length,
    evidence_path: evidencePath,
    error_code: failure?.code ?? null,
  };
  log(`SINGLE_IMAGE_CANARY_SUMMARY ${JSON.stringify(summary)}`);
  if (!passed) {
    const failedIds = assertionResults
      .filter((assertion) => !assertion.passed)
      .map((assertion) => assertion.id);
    log(`SINGLE_IMAGE_CANARY_FAILED ${failedIds.join(',')}`);
  }
  return passed ? 0 : 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  runSingleImageCanary(process.argv.slice(2)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      const safe = safeFailure(error);
      console.error(`SINGLE_IMAGE_CANARY_ERROR ${safe.code}: ${safe.message}`);
      process.exitCode = 1;
    },
  );
}
