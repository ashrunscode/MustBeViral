import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  GOLDEN_BRIEF_IDS,
  buildGoldenLaunchPackGraph,
  type GoldenCampaignBrief,
} from '@mustbeviral/contracts';

import { StagingLaunchPackTransport, type HarnessResult } from './launch-pack-harness-lib';
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
const BRIEF_SOURCE = new URL(
  '../../../governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/briefs.md',
  import.meta.url,
);

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
async function loadWashBodegaBrief(sectionId: string): Promise<GoldenCampaignBrief> {
  const markdown = await readFile(nativePath(BRIEF_SOURCE), 'utf8');
  const section = new RegExp(`^## ${sectionId}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'mu').exec(
    markdown,
  );
  const body = section?.[1];
  if (body === undefined) throw new TypeError(`Brief ${sectionId} is missing from briefs.md`);
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

async function prepare(sessionPath: string, log: (m: string) => void): Promise<void> {
  const brief = await loadWashBodegaBrief('WB-01');
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
  log: (m: string) => void,
): Promise<void> {
  const session = JSON.parse(await readFile(sessionPath, 'utf8')) as PreparedSession;
  if (Date.parse(session.quoteExpiresAt) <= Date.now()) {
    throw new Error(
      `Quote ${session.quoteId} expired at ${session.quoteExpiresAt}; re-run --prepare`,
    );
  }
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, session.accessToken);
  const ctx = (): Record<string, unknown> => ({
    workspace_id: session.workspaceId,
    request_id: `washbodega-${session.runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

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
  const runId = runIdValue;
  log(`STARTED run ${runId}`);

  await mkdir(outDirectory, { recursive: true });
  // A pack is 16 provider calls behind a queue and a webhook, so this polls rather than assuming.
  const deadline = Date.now() + 20 * 60 * 1000;
  let last = '';
  while (Date.now() < deadline) {
    const receipt = await transport.call('get_receipt', { context: ctx(), run_id: runId });
    if (receipt.ok) {
      const body = record(receipt.data['receipt'] ?? receipt.data, 'receipt');
      const status = String(body['status'] ?? body['runStatus'] ?? 'unknown');
      if (status !== last) {
        log(`STATUS ${status} @ ${new Date().toISOString()}`);
        last = status;
      }
      if (['succeeded', 'failed', 'cancelled', 'partially_succeeded'].includes(status)) {
        await writeFile(
          `${outDirectory}/receipt.json`,
          `${JSON.stringify({ session, receipt: body }, null, 2)}\n`,
          'utf8',
        );
        log(`TERMINAL ${status}`);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`Run ${runId} did not reach a terminal state within 20 minutes`);
}

export async function runWashBodegaPack(
  argv: readonly string[],
  log: (message: string) => void = console.log,
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

  if (argv.includes('--prepare')) {
    await prepare(sessionPath, log);
    return 0;
  }
  if (argv.includes('--start')) {
    await start(sessionPath, outDirectory, log);
    return 0;
  }
  log('Select exactly one mode: --prepare or --start.');
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
