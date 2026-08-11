import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

import {
  GOLDEN_BRIEF_IDS,
  buildGoldenLaunchPackGraph,
  type GoldenCampaignBrief,
} from '@mustbeviral/contracts';

import {
  StagingLaunchPackTransport,
  type HarnessResult,
  type HarnessTransport,
} from './launch-pack-harness-lib';
import { authenticateDisposableStagingUser, loadStagingAuthConfiguration } from './staging-auth';

/**
 * Runs one real launch pack for WashBodega, the trial customer, against staging.
 *
 * Deliberately two-phase. `--prepare` builds the canvas and takes a named-price quote but starts
 * nothing; `--start` spends. The wallet credit happens between them, out of band, so the money
 * boundary is an explicit operator step rather than something this tool can do on its own.
 *
 * Not merged into the golden-brief harness: that harness sweeps 20 synthetic briefs to prove the
 * quote path fails closed, while this spends real money on one real brand and follows the run to a
 * terminal receipt.
 */

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const DEFAULT_BRIEF_SOURCE = new URL(
  '../../../governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/briefs.md',
  import.meta.url,
);
const DEFAULT_BRIEF_SECTION = 'WB-01';
/** Must match RunStatus in packages/domain: 'canceled' (one l), 'partial_succeeded' (not -ly). */
const TERMINAL_RUN_STATUSES: readonly string[] = [
  'succeeded',
  'partial_succeeded',
  'failed',
  'canceled',
];
const DEFAULT_TIMEOUT_MINUTES = 45;
const POLL_INTERVAL_MS = 10_000;
const PROGRESS_HEARTBEAT_MS = 60_000;

const FIELD_LABELS = {
  product: 'Product',
  category: 'Category',
  packshots: 'Packshots',
  features: 'Features',
  benefits: 'Benefits',
  evidence: 'Evidence',
  approvedFacts: 'Approved facts',
  offer: 'Offer',
  pricePresentation: 'Price presentation',
  urgency: 'Urgency',
  destination: 'Destination',
  brandKit: 'Brand kit',
  audienceAndAwareness: 'Audience and awareness',
  painsDesiresObjections: 'Pains, desires, objections',
  requiredClaimsLegal: 'Required claims/legal',
  prohibitedClaims: 'Prohibited claims',
  creativeConstraintsRights: 'Creative constraints/rights',
  stressVector: 'Stress vector',
} as const satisfies Readonly<Record<keyof Omit<GoldenCampaignBrief, 'briefId'>, string>>;

function nativePath(source: URL): string {
  const pathname = decodeURIComponent(source.pathname);
  return /^\/[A-Za-z]:\//u.test(pathname) ? pathname.slice(1).replaceAll('/', '\\') : pathname;
}

/**
 * `briefId` is a registry label, not a claim that this is a golden brief. The contract type only
 * admits GB-01..GB-20, so the first slot is borrowed while every field carries WashBodega content.
 */
async function loadWashBodegaBrief(
  sectionId: string,
  source: URL = DEFAULT_BRIEF_SOURCE,
): Promise<GoldenCampaignBrief> {
  const markdown = await readFile(nativePath(source), 'utf8');
  const section = new RegExp(`^## ${sectionId}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'mu').exec(
    markdown,
  );
  const body = section?.[1];
  if (body === undefined) {
    throw new TypeError(`Brief ${sectionId} is missing from ${nativePath(source)}`);
  }
  const fields = new Map<string, string>();
  for (const match of body.matchAll(/^- ([^:]+): (.+)$/gmu)) {
    const [, label, value] = match;
    if (label !== undefined && value !== undefined) fields.set(label.trim(), value.trim());
  }
  const value = (key: keyof typeof FIELD_LABELS): string => {
    const found = fields.get(FIELD_LABELS[key]);
    if (found === undefined || found.length === 0) {
      throw new TypeError(`${sectionId} is missing the ${FIELD_LABELS[key]} field`);
    }
    return found;
  };
  const brief = { briefId: GOLDEN_BRIEF_IDS[0] } as Record<string, string>;
  for (const key of Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]) {
    brief[key] = value(key);
  }
  return brief as unknown as GoldenCampaignBrief;
}

interface PreparedSession {
  readonly accessToken: string;
  readonly email: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly canvasId: string;
  readonly revisionId: string;
  readonly quoteId: string;
  readonly confirmationToken: string;
  readonly totalMicros: string;
  readonly quoteExpiresAt: string;
  readonly briefSource: string;
  readonly briefSection: string;
  /**
   * Written back the instant `start_run` returns, before anything can throw. Without it a crash
   * during the 20-minute poll leaves a paid reservation live with nothing on disk naming the run.
   */
  readonly startedRunId?: string;
}

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} missing`);
  return value;
};
const record = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} missing`);
  }
  return value as Record<string, unknown>;
};

function requireOk(result: HarnessResult, operation: string): Readonly<Record<string, unknown>> {
  if (!result.ok) throw new Error(`${operation} failed: ${JSON.stringify(result.error)}`);
  return result.data;
}

interface RunProgress {
  readonly status: string;
  readonly artifactCount: number;
  readonly capturedMicros: string;
  readonly releasedMicros: string;
}

interface PollRunOptions {
  readonly timeoutMs: number;
  readonly pollIntervalMs?: number;
  readonly heartbeatMs?: number;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly stderr?: (message: string) => void;
}

interface TerminalRunProgress {
  readonly status: string;
  readonly receipt: Readonly<Record<string, unknown>>;
}

function progressFrom(
  status: string,
  receipt: Readonly<Record<string, unknown>> | null,
): RunProgress {
  const reservationValue = receipt?.['reservation'];
  const reservation =
    typeof reservationValue === 'object' &&
    reservationValue !== null &&
    !Array.isArray(reservationValue)
      ? (reservationValue as Readonly<Record<string, unknown>>)
      : null;
  const artifacts = receipt?.['artifacts'];
  return {
    status,
    artifactCount: Array.isArray(artifacts) ? artifacts.length : 0,
    capturedMicros: String(
      reservation?.['captured_micros'] ?? reservation?.['capturedMicros'] ?? 'unavailable',
    ),
    releasedMicros: String(
      reservation?.['released_micros'] ?? reservation?.['releasedMicros'] ?? 'unavailable',
    ),
  };
}

function progressLine(progress: RunProgress, elapsedMs: number, observedAt: number): string {
  return [
    'PROGRESS',
    `status=${progress.status}`,
    `artifacts=${progress.artifactCount}`,
    `captured_micros=${progress.capturedMicros}`,
    `released_micros=${progress.releasedMicros}`,
    `elapsed_seconds=${Math.floor(elapsedMs / 1000)}`,
    `observed_at=${new Date(observedAt).toISOString()}`,
  ].join(' ');
}

/**
 * Polls the authoritative run resource for state and the receipt resource for observable money and
 * artifact progress. A heartbeat is emitted even when nothing changes, so an unattended stall is
 * visible instead of looking like a successful early exit.
 */
export async function pollRunUntilTerminal(
  transport: HarnessTransport,
  context: () => Readonly<Record<string, unknown>>,
  runId: string,
  options: PollRunOptions,
): Promise<TerminalRunProgress> {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new TypeError('poll timeout must be a positive number of milliseconds');
  }
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const stderr = options.stderr ?? console.error;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const heartbeatMs = options.heartbeatMs ?? PROGRESS_HEARTBEAT_MS;
  const startedAt = now();
  const deadline = startedAt + options.timeoutMs;
  let lastProgressSignature = '';
  let lastProgressAt = Number.NEGATIVE_INFINITY;
  let lastErrorSignature = '';
  let lastProgress: RunProgress | null = null;

  while (now() < deadline) {
    const observedAt = now();
    const polled = await transport.call('get_run', { context: context(), run_id: runId });
    if (!polled.ok) {
      const signature = JSON.stringify(polled.error);
      if (signature !== lastErrorSignature || observedAt - lastProgressAt >= heartbeatMs) {
        stderr(
          `POLL_ERROR operation=get_run code=${polled.error.code} http_status=${polled.error.http_status ?? 'unavailable'} observed_at=${new Date(observedAt).toISOString()}`,
        );
        lastErrorSignature = signature;
        lastProgressAt = observedAt;
      }
      await sleep(pollIntervalMs);
      continue;
    }

    const run = record(polled.data['run'], 'run');
    const status = text(run['status'], 'run.status');
    const receiptResult = await transport.call('get_receipt', {
      context: context(),
      run_id: runId,
    });
    let receipt: Readonly<Record<string, unknown>> | null = null;
    if (receiptResult.ok) {
      receipt = record(receiptResult.data['receipt'], 'receipt');
    } else {
      const signature = JSON.stringify(receiptResult.error);
      if (signature !== lastErrorSignature) {
        stderr(
          `POLL_ERROR operation=get_receipt code=${receiptResult.error.code} http_status=${receiptResult.error.http_status ?? 'unavailable'} observed_at=${new Date(observedAt).toISOString()}`,
        );
        lastErrorSignature = signature;
      }
    }

    const progress = progressFrom(status, receipt);
    const signature = JSON.stringify(progress);
    if (signature !== lastProgressSignature || observedAt - lastProgressAt >= heartbeatMs) {
      stderr(progressLine(progress, observedAt - startedAt, observedAt));
      lastProgressSignature = signature;
      lastProgressAt = observedAt;
    }
    lastProgress = progress;

    if (TERMINAL_RUN_STATUSES.includes(status)) {
      if (receipt === null) {
        throw new Error(
          `Run ${runId} reached terminal status ${status}, but its receipt is unavailable`,
        );
      }
      return { status, receipt };
    }
    await sleep(pollIntervalMs);
  }

  const finalProgress = lastProgress ?? progressFrom('unobserved', null);
  throw new Error(
    `Run ${runId} reached the explicit ${Math.floor(options.timeoutMs / 1000)}-second timeout ` +
      `(last status: ${finalProgress.status}, artifacts: ${finalProgress.artifactCount}, ` +
      `captured_micros: ${finalProgress.capturedMicros}, released_micros: ${finalProgress.releasedMicros})`,
  );
}

function positiveNumberOption(argv: readonly string[], flag: string, defaultValue: number): number {
  const index = argv.indexOf(flag);
  if (index < 0) return defaultValue;
  const parsed = Number(argv[index + 1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`${flag} must be followed by a positive number`);
  }
  return parsed;
}

async function prepare(
  sessionPath: string,
  briefSource: URL,
  briefSection: string,
  log: (m: string) => void,
): Promise<void> {
  const brief = await loadWashBodegaBrief(briefSection, briefSource);
  log(`BRIEF ${briefSection} from ${nativePath(briefSource)}`);
  const runId = randomBytes(4).toString('hex');
  const auth = await authenticateDisposableStagingUser({
    configuration: await loadStagingAuthConfiguration(),
    log,
  });
  log(`AUTHENTICATED ${auth.email}`);
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, auth.accessToken);
  const key = (op: string): string => `washbodega-${runId}-${op}`;
  const ctx = (workspaceId: string): Record<string, unknown> => ({
    workspace_id: workspaceId,
    request_id: `washbodega-${runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const bootstrap = requireOk(
    await transport.call('create_workspace', {
      context: ctx('00000000-0000-4000-8000-000000000000'),
      name: `WashBodega Wash & Fold ${runId}`,
      idempotency_key: key('workspace'),
    }),
    'create_workspace',
  );
  const workspaceId = text(bootstrap['workspace_id'], 'workspace_id');
  log(`WORKSPACE ${workspaceId}`);

  const project = requireOk(
    await transport.call('create_project', {
      context: ctx(workspaceId),
      workspace_id: workspaceId,
      name: 'WashBodega Wash & Fold launch pack',
      idempotency_key: key('project'),
    }),
    'create_project',
  );
  const projectId = text(record(project['project'], 'project')['id'], 'project.id');

  const canvas = requireOk(
    await transport.call('create_canvas', {
      context: ctx(workspaceId),
      project_id: projectId,
      name: 'WashBodega Wash & Fold launch pack',
      idempotency_key: key('canvas'),
    }),
    'create_canvas',
  );
  const canvasId = text(canvas['canvasId'], 'canvasId');

  const graph = buildGoldenLaunchPackGraph(brief);
  const patched = requireOk(
    await transport.call('apply_canvas_patch', {
      context: ctx(workspaceId),
      canvas_id: canvasId,
      expected_revision_id: text(canvas['revisionId'], 'revisionId'),
      reason: 'Build WashBodega Wash & Fold launch-pack graph',
      patch: {
        upsert_nodes: graph.nodes,
        remove_node_ids: [],
        upsert_edges: graph.edges,
        remove_edge_ids: [],
      },
      idempotency_key: key('patch'),
    }),
    'apply_canvas_patch',
  );
  const revisionId = text(patched['revisionId'], 'revisionId');

  const validation = requireOk(
    await transport.call('validate_graph', { context: ctx(workspaceId), canvas_id: canvasId }),
    'validate_graph',
  );
  if (validation['valid'] !== true) throw new Error('WashBodega graph failed validation');

  const quoted = requireOk(
    await transport.call('quote_run', {
      context: ctx(workspaceId),
      canvas_id: canvasId,
      expected_revision_id: revisionId,
      idempotency_key: key('quote'),
    }),
    'quote_run',
  );
  const quote = record(quoted['quote'], 'quote');
  const session: PreparedSession = {
    accessToken: auth.accessToken,
    email: auth.email,
    runId,
    workspaceId,
    canvasId,
    revisionId,
    quoteId: text(quote['quoteId'], 'quote.quoteId'),
    // Server-minted consent token; start_run refuses anything else.
    confirmationToken: text(quoted['confirmationToken'], 'confirmationToken'),
    totalMicros: String(quote['maximumChargeMicros']),
    quoteExpiresAt: text(quote['expiresAt'], 'quote.expiresAt'),
    briefSource: nativePath(briefSource),
    briefSection,
  };
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  log(`QUOTED ${session.totalMicros} micros, quote ${session.quoteId}`);
  log(`QUOTE_EXPIRES_AT ${session.quoteExpiresAt}`);
  log(`CREDIT_THIS_WORKSPACE ${workspaceId}`);
  log('PREPARED. Credit the workspace, then run with --start before the quote expires.');
}

async function start(
  sessionPath: string,
  outDirectory: string,
  timeoutMinutes: number,
  log: (m: string) => void,
): Promise<void> {
  const session = JSON.parse(await readFile(sessionPath, 'utf8')) as PreparedSession;
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, session.accessToken);
  const ctx = (): Record<string, unknown> => ({
    workspace_id: session.workspaceId,
    request_id: `washbodega-${session.runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  let runId: string;
  if (session.startedRunId !== undefined && session.startedRunId.length > 0) {
    // Resuming an already-paid run. The quote is spent, so its expiry is irrelevant here - checking
    // it would refuse to poll a live reservation, which is the opposite of what a resume is for.
    runId = session.startedRunId;
    log(`RESUMING run ${runId} (reservation already taken)`);
  } else {
    if (Date.parse(session.quoteExpiresAt) <= Date.now()) {
      throw new Error(
        `Quote ${session.quoteId} expired at ${session.quoteExpiresAt}; re-run --prepare`,
      );
    }
    const started = await transport.call('start_run', {
      context: ctx(),
      quote_id: session.quoteId,
      confirmed: true,
      confirmation_token: session.confirmationToken,
      idempotency_key: `washbodega-${session.runId}-start`,
    });
    const startData = requireOk(started, 'start_run');
    // start_run answers { status: 'ok', run }, and the run record uses camelCase like every other
    // wire record. An earlier version guessed only snake_case and threw "run_id missing" *after*
    // the reservation was already taken, stranding a live run with no poller. Fail with the real
    // shape instead, so a future mismatch is diagnosable without going to the database.
    const runRecord = record(startData['run'] ?? startData, 'run');
    const runIdValue = runRecord['runId'] ?? runRecord['id'] ?? startData['run_id'];
    if (typeof runIdValue !== 'string' || runIdValue.length === 0) {
      throw new Error(
        `start_run succeeded but no run id was found. Reservation is live. Response: ${JSON.stringify(startData)}`,
      );
    }
    runId = runIdValue;
    // Persist before anything else can throw: from here on the money is committed, and a crash
    // during the poll must still leave the run findable.
    await writeFile(
      sessionPath,
      `${JSON.stringify({ ...session, startedRunId: runId }, null, 2)}\n`,
      'utf8',
    );
    log(`STARTED run ${runId}`);
  }

  await mkdir(outDirectory, { recursive: true });
  // A pack is 16 provider calls behind a queue and a webhook, so this polls rather than assuming.
  // Four dispatch waves on a one-minute cron put a hard floor of several minutes under this.
  const terminal = await pollRunUntilTerminal(transport, ctx, runId, {
    timeoutMs: timeoutMinutes * 60 * 1000,
    stderr: log,
  });
  await writeFile(
    `${outDirectory}/receipt.json`,
    `${JSON.stringify(
      {
        session: { ...session, accessToken: '[redacted]' },
        terminal_status: terminal.status,
        receipt: terminal.receipt,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  log(`TERMINAL status=${terminal.status} run_id=${runId}`);
}

export async function runWashBodegaPack(
  argv: readonly string[],
  log: (message: string) => void = console.error,
): Promise<number> {
  const sessionIndex = argv.indexOf('--session');
  const sessionPath =
    sessionIndex >= 0 && argv[sessionIndex + 1] !== undefined
      ? (argv[sessionIndex + 1] as string)
      : fileURLToPath(new URL('../../../.scratch/washbodega-session.json', import.meta.url));
  const outIndex = argv.indexOf('--out');
  const outDirectory =
    outIndex >= 0 && argv[outIndex + 1] !== undefined
      ? (argv[outIndex + 1] as string)
      : fileURLToPath(new URL('../../../.scratch/washbodega-pack/', import.meta.url));
  const briefFileIndex = argv.indexOf('--brief-file');
  const briefSource =
    briefFileIndex >= 0 && argv[briefFileIndex + 1] !== undefined
      ? pathToFileURL(resolve(argv[briefFileIndex + 1] as string))
      : DEFAULT_BRIEF_SOURCE;
  const briefIndex = argv.indexOf('--brief');
  const briefSection =
    briefIndex >= 0 && argv[briefIndex + 1] !== undefined
      ? (argv[briefIndex + 1] as string)
      : DEFAULT_BRIEF_SECTION;
  const timeoutMinutes = positiveNumberOption(argv, '--timeout-minutes', DEFAULT_TIMEOUT_MINUTES);

  if (argv.includes('--prepare')) {
    await prepare(sessionPath, briefSource, briefSection, log);
    return 0;
  }
  if (argv.includes('--start')) {
    await start(sessionPath, outDirectory, timeoutMinutes, log);
    return 0;
  }
  log('Select exactly one mode: --prepare or --start.');
  log(
    'Options: --session <path> --out <dir> --brief-file <path> --brief <section-id> --timeout-minutes <number>',
  );
  return 1;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  runWashBodegaPack(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
