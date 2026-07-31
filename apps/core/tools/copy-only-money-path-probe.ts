import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { StagingLaunchPackTransport, type HarnessResult } from './launch-pack-harness-lib';
import { authenticateDisposableStagingUser, loadStagingAuthConfiguration } from './staging-auth';

/**
 * The whole money path for less than a tenth of a cent. Quoted $0.45 (three copy_set nodes at
 * 150,000 micros), real OpenRouter cost roughly $0.0004. Exercises exactly what a real launch pack
 * exercises - artifact registration, capture, attempt advance, wave promotion, run terminalization,
 * terminal release, zero residual, and the receipt - at 1% of the cost of proving it with images.
 *
 * Deliberately three copy nodes rather than one: create_quote's wave walk puts every copy_set node
 * in wave 1 regardless of count, but this exercises settle_attempt_transition's readiness advance
 * being called three times against the same run (once per copy attempt) rather than once, which one
 * node alone would not.
 *
 * Two-phase like washbodega-pack-run.ts. `--prepare` builds the canvas and takes a named-price quote
 * but starts nothing; `--start` spends. The wallet credit happens between them, out of band, so the
 * money boundary is an explicit operator step rather than something this tool can do on its own -
 * record_ledger_movement requires the postgres or service_role identity, which no REST caller has.
 */

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const EXPECTED_QUOTE_MICROS = 450_000n;
const COPY_UNIT_PRICE_MICROS = 150_000n;

function copyOnlyGraph(): Readonly<{
  nodes: readonly Readonly<Record<string, unknown>>[];
  edges: readonly Readonly<Record<string, unknown>>[];
}> {
  const nodes = [
    {
      id: 'brief',
      kind: 'brief',
      parameter_schema_version: 1,
      parameters: {
        brief_id: 'copy-only-money-path-probe',
        product: 'MustBeViral staging probe - copy-only money path',
        category: 'internal validation',
        offer: 'No promotional offer.',
        price_presentation: 'Not applicable - no priced product in this probe.',
        audience_and_awareness: 'Internal engineering validation, not a real audience.',
        required_claims_legal: 'None.',
        prohibited_claims: 'None.',
        creative_constraints_rights: 'Synthetic validation content only.',
      },
    },
    {
      id: 'brand-context',
      kind: 'brand_context',
      parameter_schema_version: 1,
      parameters: {
        brand_kit: 'internal-probe',
        approved_facts: 'This is a synthetic staging probe, not a real campaign.',
        evidence: 'None.',
      },
    },
    ...[1, 2, 3].map((index) => ({
      id: `copy-${String(index)}`,
      kind: 'planner_text',
      parameter_schema_version: 1,
      parameters: {
        asset_role: 'copy_set',
        copy_set: index,
        product: 'MustBeViral staging probe',
        offer: 'No promotional offer.',
        urgency: 'None.',
        approved_facts: 'This is a synthetic staging probe, not a real campaign.',
        stress_vector: `Money-path variant ${String(index)} of 3.`,
      },
    })),
  ];
  const edges = [
    {
      id: 'edge-brief-brand-context',
      kind: 'dependency',
      source_node_id: 'brief',
      target_node_id: 'brand-context',
    },
    ...[1, 2, 3].map((index) => ({
      id: `edge-brand-context-copy-${String(index)}`,
      kind: 'dependency',
      source_node_id: 'brand-context',
      target_node_id: `copy-${String(index)}`,
    })),
  ];
  return { nodes, edges };
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
  const runId = randomBytes(4).toString('hex');
  const auth = await authenticateDisposableStagingUser({
    configuration: await loadStagingAuthConfiguration(),
    log,
  });
  log(`AUTHENTICATED ${auth.email}`);
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, auth.accessToken);
  const key = (op: string): string => `copy-probe-${runId}-${op}`;
  const ctx = (workspaceId: string): Record<string, unknown> => ({
    workspace_id: workspaceId,
    request_id: `copy-probe-${runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const bootstrap = requireOk(
    await transport.call('create_workspace', {
      context: ctx('00000000-0000-4000-8000-000000000000'),
      name: `Copy-only money path probe ${runId}`,
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
      name: 'Copy-only money path probe',
      idempotency_key: key('project'),
    }),
    'create_project',
  );
  const projectId = text(record(project['project'], 'project')['id'], 'project.id');

  const canvas = requireOk(
    await transport.call('create_canvas', {
      context: ctx(workspaceId),
      project_id: projectId,
      name: 'Copy-only money path probe',
      idempotency_key: key('canvas'),
    }),
    'create_canvas',
  );
  const canvasId = text(canvas['canvasId'], 'canvasId');

  const graph = copyOnlyGraph();
  const patched = requireOk(
    await transport.call('apply_canvas_patch', {
      context: ctx(workspaceId),
      canvas_id: canvasId,
      expected_revision_id: text(canvas['revisionId'], 'revisionId'),
      reason: 'Build the copy-only money-path probe graph.',
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
  if (validation['valid'] !== true) {
    throw new Error(`Copy-only probe graph failed validation: ${JSON.stringify(validation)}`);
  }

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
  const totalMicros = String(quote['maximumChargeMicros']);
  if (totalMicros !== EXPECTED_QUOTE_MICROS.toString(10)) {
    throw new Error(
      `Expected ${EXPECTED_QUOTE_MICROS.toString(10)} micros (3 x ${COPY_UNIT_PRICE_MICROS.toString(10)}), got ${totalMicros}`,
    );
  }
  const session: PreparedSession = {
    accessToken: auth.accessToken,
    email: auth.email,
    runId,
    workspaceId,
    canvasId,
    revisionId,
    quoteId: text(quote['quoteId'], 'quote.quoteId'),
    confirmationToken: text(quoted['confirmationToken'], 'confirmationToken'),
    totalMicros,
    quoteExpiresAt: text(quote['expiresAt'], 'quote.expiresAt'),
  };
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  log(
    `QUOTED ${session.totalMicros} micros (expected exactly ${EXPECTED_QUOTE_MICROS.toString(10)}), quote ${session.quoteId}`,
  );
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
    request_id: `copy-probe-${session.runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const started = await transport.call('start_run', {
    context: ctx(),
    quote_id: session.quoteId,
    confirmed: true,
    confirmation_token: session.confirmationToken,
    idempotency_key: `copy-probe-${session.runId}-start`,
  });
  const startData = requireOk(started, 'start_run');
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
  const deadline = Date.now() + 10 * 60 * 1000;
  let last = '';
  let terminalStatus: string | null = null;
  while (Date.now() < deadline) {
    // get_run, not get_receipt: the run's own status field, read correctly. (get_receipt nests it
    // under receipt.run.status - reading receipt.status directly always returns 'unknown'.)
    const polled = await transport.call('get_run', { context: ctx(), run_id: runId });
    if (polled.ok) {
      const run = record(polled.data['run'], 'run');
      const status = text(run['status'], 'run.status');
      if (status !== last) {
        log(`STATUS ${status} @ ${new Date().toISOString()}`);
        last = status;
      }
      if (['succeeded', 'failed', 'canceled', 'partial_succeeded'].includes(status)) {
        terminalStatus = status;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (terminalStatus === null) {
    throw new Error(`Run ${runId} did not reach a terminal state within 10 minutes`);
  }

  const receipt = requireOk(
    await transport.call('get_receipt', { context: ctx(), run_id: runId }),
    'get_receipt',
  );
  const receiptBody = record(receipt['receipt'], 'receipt');
  await writeFile(
    `${outDirectory}/receipt.json`,
    `${JSON.stringify({ session, terminal_status: terminalStatus, receipt: receiptBody }, null, 2)}\n`,
    'utf8',
  );
  log(`TERMINAL ${terminalStatus}`);

  // Assertions. Every one of these is the money path, not incidental state.
  const reservation = record(receiptBody['reservation'], 'receipt.reservation');
  const capturedMicros = String(reservation['captured_micros'] ?? reservation['capturedMicros']);
  const releasedMicros = String(reservation['released_micros'] ?? reservation['releasedMicros']);
  const amountMicros = String(reservation['amount_micros'] ?? reservation['amountMicros']);
  const residual = BigInt(amountMicros) - BigInt(capturedMicros) - BigInt(releasedMicros);
  const artifacts = Array.isArray(receiptBody['artifacts']) ? receiptBody['artifacts'] : [];
  const ledger = Array.isArray(receiptBody['ledger']) ? receiptBody['ledger'] : [];

  const failures: string[] = [];
  if (terminalStatus !== 'succeeded')
    failures.push(`run terminal status is ${terminalStatus}, not succeeded`);
  if (capturedMicros !== EXPECTED_QUOTE_MICROS.toString(10)) {
    failures.push(
      `captured ${capturedMicros} micros, expected exactly ${EXPECTED_QUOTE_MICROS.toString(10)}`,
    );
  }
  if (residual !== 0n) failures.push(`residual is ${residual.toString(10)} micros, expected 0`);
  if (artifacts.length !== 3) failures.push(`${artifacts.length} artifacts registered, expected 3`);
  for (const artifact of artifacts) {
    const mime = record(artifact, 'artifact')['mime_type'];
    if (mime !== 'application/json')
      failures.push(`artifact mime_type is ${String(mime)}, expected application/json`);
  }
  const ledgerBalance = ledger.reduce((sum: bigint, entry: unknown) => {
    const row = record(entry, 'ledger entry');
    const direction = row['direction'];
    const amount = BigInt(String(row['amount_micros'] ?? row['amountMicros'] ?? '0'));
    return direction === 'credit' ? sum + amount : sum - amount;
  }, 0n);

  log(`CAPTURED ${capturedMicros} micros`);
  log(`RESIDUAL ${residual.toString(10)} micros`);
  log(`ARTIFACTS ${artifacts.length}`);
  log(`WORKSPACE_LEDGER_BALANCE ${ledgerBalance.toString(10)} micros`);

  if (failures.length > 0) {
    throw new Error(`Money-path assertions failed:\n  - ${failures.join('\n  - ')}`);
  }
  log('ALL ASSERTIONS PASSED');
}

export async function runCopyOnlyMoneyPathProbe(
  argv: readonly string[],
  log: (message: string) => void = console.log,
): Promise<number> {
  const sessionIndex = argv.indexOf('--session');
  const sessionPath =
    sessionIndex >= 0 && argv[sessionIndex + 1] !== undefined
      ? (argv[sessionIndex + 1] as string)
      : fileURLToPath(new URL('../../../.scratch/copy-probe-session.json', import.meta.url));
  const outIndex = argv.indexOf('--out');
  const outDirectory =
    outIndex >= 0 && argv[outIndex + 1] !== undefined
      ? (argv[outIndex + 1] as string)
      : fileURLToPath(new URL('../../../.scratch/copy-probe/', import.meta.url));

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
  runCopyOnlyMoneyPathProbe(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
