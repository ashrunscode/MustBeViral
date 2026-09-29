import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { StagingLaunchPackTransport, type HarnessResult } from './launch-pack-harness-lib';
import { authenticateDisposableStagingUser, loadStagingAuthConfiguration } from './staging-auth';

/**
 * Track E's live gate: one master plus one adaptation through the full pipeline, then approval and
 * export - the two operations no run has ever exercised end to end.
 *
 * What this is the FIRST live test of, all at once:
 *   - wave promotion driving real spend: the adaptation is wave 2 and dispatches only after the
 *     master's webhook settles wave 1;
 *   - the Track C dispatch payload: the adaptation's prompt comes entirely from the run's brief and
 *     brand context (the node carries none), and its image_url is a minted capability URL;
 *   - real Kontext spend through the repointed fal-ai/flux-pro/kontext application;
 *   - POST /runs/:id/approvals promoting provider_output -> approved_output in place;
 *   - POST /runs/:id/exports building the deterministic ZIP from approved artifacts.
 *
 * Quoted $0.70 (master 500,000 + adaptation 200,000 micros); real provider cost ~$0.075.
 *
 * Approval and export use raw fetch: the shared harness transport deliberately covers only the
 * proven quote-path operations, and extending it is Track G3's job (it is the code behind the 20/20
 * evidence, so it does not grow casually).
 */

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const EXPECTED_QUOTE_MICROS = 700_000n;

function probeGraph(): Readonly<{
  nodes: readonly Readonly<Record<string, unknown>>[];
  edges: readonly Readonly<Record<string, unknown>>[];
}> {
  return {
    nodes: [
      {
        id: 'brief',
        kind: 'brief',
        parameter_schema_version: 1,
        parameters: {
          brief_id: 'approve-export-probe',
          product: 'MustBeViral staging probe - approval and export',
          category: 'internal validation',
          offer: 'No promotional offer.',
          price_presentation: 'Not applicable.',
          audience_and_awareness: 'Internal engineering validation.',
          required_claims_legal: 'None.',
          prohibited_claims: 'None.',
          creative_constraints_rights: 'Synthetic validation content only. No people, no logos.',
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
          brand_voice: 'Clean, minimal, neutral.',
          palette: 'Warm neutrals with a single cobalt accent.',
        },
      },
      {
        id: 'master-1',
        kind: 'image_generation',
        parameter_schema_version: 1,
        parameters: {
          asset_role: 'master_static',
          master: 1,
          product: 'MustBeViral staging probe - approval and export',
          packshots:
            'A clean studio still life of a blank cobalt reusable bottle on a pale gray background.',
          creative_constraints_rights: 'Synthetic validation content only. No people, no logos.',
        },
      },
      {
        id: 'adaptation-1',
        kind: 'image_edit',
        parameter_schema_version: 1,
        parameters: {
          asset_role: 'adaptation',
          master: 1,
          adaptation: 1,
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
        id: 'edge-brand-context-master-1',
        kind: 'dependency',
        source_node_id: 'brand-context',
        target_node_id: 'master-1',
      },
      {
        id: 'edge-master-1-adaptation-1',
        kind: 'dependency',
        source_node_id: 'master-1',
        target_node_id: 'adaptation-1',
      },
    ],
  };
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
  startedRunId?: string;
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

async function rawCall(
  session: PreparedSession,
  method: 'POST' | 'GET',
  path: string,
  body: Readonly<Record<string, unknown>> | undefined,
  idempotencyKey: string | undefined,
): Promise<Readonly<{ status: number; body: Record<string, unknown> }>> {
  const response = await fetch(`${STAGING_CORE_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
      'x-request-id': `approve-export-${session.runId}-${Math.random().toString(36).slice(2, 10)}`,
      ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body: parsed };
}

async function prepare(sessionPath: string, log: (m: string) => void): Promise<void> {
  const runId = randomBytes(4).toString('hex');
  const auth = await authenticateDisposableStagingUser({
    configuration: await loadStagingAuthConfiguration(),
    log,
  });
  log(`AUTHENTICATED ${auth.email}`);
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, auth.accessToken);
  const key = (op: string): string => `approve-export-${runId}-${op}`;
  const ctx = (workspaceId: string): Record<string, unknown> => ({
    workspace_id: workspaceId,
    request_id: `approve-export-${runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const bootstrap = requireOk(
    await transport.call('create_workspace', {
      context: ctx('00000000-0000-4000-8000-000000000000'),
      name: `Approve-export probe ${runId}`,
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
      name: 'Approve-export probe',
      idempotency_key: key('project'),
    }),
    'create_project',
  );
  const projectId = text(record(project['project'], 'project')['id'], 'project.id');

  const canvas = requireOk(
    await transport.call('create_canvas', {
      context: ctx(workspaceId),
      project_id: projectId,
      name: 'Approve-export probe',
      idempotency_key: key('canvas'),
    }),
    'create_canvas',
  );
  const canvasId = text(canvas['canvasId'], 'canvasId');

  const graph = probeGraph();
  const patched = requireOk(
    await transport.call('apply_canvas_patch', {
      context: ctx(workspaceId),
      canvas_id: canvasId,
      expected_revision_id: text(canvas['revisionId'], 'revisionId'),
      reason: 'Build the approve-export probe graph.',
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
    throw new Error(`Probe graph failed validation: ${JSON.stringify(validation)}`);
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
      `Expected ${EXPECTED_QUOTE_MICROS.toString(10)} micros (master 500000 + adaptation 200000), got ${totalMicros}`,
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
  log(`QUOTED ${session.totalMicros} micros, quote ${session.quoteId}`);
  log(`QUOTE_EXPIRES_AT ${session.quoteExpiresAt}`);
  log(`CREDIT_THIS_WORKSPACE ${workspaceId}`);
  log('PREPARED. Credit the workspace, then run with --start before the quote expires.');
}

async function start(sessionPath: string, log: (m: string) => void): Promise<void> {
  const session = JSON.parse(await readFile(sessionPath, 'utf8')) as PreparedSession;
  if (Date.parse(session.quoteExpiresAt) <= Date.now()) {
    throw new Error(`Quote expired at ${session.quoteExpiresAt}; re-run --prepare`);
  }
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, session.accessToken);
  const ctx = (): Record<string, unknown> => ({
    workspace_id: session.workspaceId,
    request_id: `approve-export-${session.runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const started = await transport.call('start_run', {
    context: ctx(),
    quote_id: session.quoteId,
    confirmed: true,
    confirmation_token: session.confirmationToken,
    idempotency_key: `approve-export-${session.runId}-start`,
  });
  const startData = requireOk(started, 'start_run');
  const runRecord = record(startData['run'] ?? startData, 'run');
  const runIdValue = runRecord['runId'] ?? runRecord['id'] ?? startData['run_id'];
  if (typeof runIdValue !== 'string' || runIdValue.length === 0) {
    throw new Error(
      `start_run succeeded but no run id found. Reservation is live. ${JSON.stringify(startData)}`,
    );
  }
  const startedRunId = runIdValue;
  log(`STARTED run ${startedRunId}`);
  await writeFile(
    sessionPath,
    `${JSON.stringify({ ...session, startedRunId }, null, 2)}\n`,
    'utf8',
  );

  // Two provider generations behind a queue, a webhook, and one wave promotion.
  const deadline = Date.now() + 15 * 60 * 1000;
  let last = '';
  while (Date.now() < deadline) {
    const polled = await transport.call('get_run', { context: ctx(), run_id: startedRunId });
    if (polled.ok) {
      const run = record(polled.data['run'], 'run');
      const status = text(run['status'], 'run.status');
      if (status !== last) {
        log(`STATUS ${status} @ ${new Date().toISOString()}`);
        last = status;
      }
      if (['succeeded', 'failed', 'canceled', 'partial_succeeded'].includes(status)) {
        if (status !== 'succeeded') {
          throw new Error(`Run terminal status is ${status}, expected succeeded`);
        }
        log('TERMINAL succeeded');
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Run ${startedRunId} did not reach a terminal state within 15 minutes`);
}

async function approveAndExport(
  sessionPath: string,
  outDirectory: string,
  log: (m: string) => void,
): Promise<void> {
  const session = JSON.parse(await readFile(sessionPath, 'utf8')) as PreparedSession;
  const runId = session.startedRunId;
  if (runId === undefined) throw new Error('No started run recorded; run --start first');
  const transport = new StagingLaunchPackTransport(STAGING_CORE_URL, session.accessToken);
  const ctx = (): Record<string, unknown> => ({
    workspace_id: session.workspaceId,
    request_id: `approve-export-${session.runId}-${Math.random().toString(36).slice(2, 10)}`,
  });

  const receiptResult = requireOk(
    await transport.call('get_receipt', { context: ctx(), run_id: runId }),
    'get_receipt',
  );
  const receipt = record(receiptResult['receipt'], 'receipt');
  const artifacts = (receipt['artifacts'] as Record<string, unknown>[]) ?? [];
  const imageArtifacts = artifacts.filter((artifact) =>
    String(artifact['mime_type'] ?? '').startsWith('image/'),
  );
  if (imageArtifacts.length !== 2) {
    throw new Error(`Expected 2 image artifacts, found ${imageArtifacts.length}`);
  }
  const failures: string[] = [];

  // === approval ===
  const approvals = imageArtifacts.map((artifact, index) => ({
    artifact_id: String(artifact['id']),
    accessibility_description:
      index === 0
        ? 'Studio still life of a blank cobalt reusable bottle on a pale gray background.'
        : 'Square 1:1 adaptation of the cobalt bottle still life, subject centred.',
  }));
  const approved = await rawCall(
    session,
    'POST',
    `/v1/runs/${runId}/approvals`,
    { approvals },
    `approve-export-${session.runId}-approve`,
  );
  log(`APPROVE HTTP ${approved.status} ${JSON.stringify(approved.body).slice(0, 200)}`);
  const approvedData = record(approved.body['data'] ?? approved.body, 'approval data');
  if (approved.status !== 200 || Number(approvedData['approved']) !== 2) {
    failures.push(`approval: expected HTTP 200 with approved=2`);
  }

  // Replay must be idempotent and must not double-approve.
  const replayed = await rawCall(
    session,
    'POST',
    `/v1/runs/${runId}/approvals`,
    { approvals },
    `approve-export-${session.runId}-approve-replay`,
  );
  const replayedData = record(replayed.body['data'] ?? replayed.body, 'replay data');
  log(`APPROVE-REPLAY HTTP ${replayed.status} replayed=${String(replayedData['replayed'])}`);
  if (replayed.status !== 200 || Number(replayedData['replayed']) !== 2) {
    failures.push('approval replay: expected HTTP 200 with replayed=2');
  }

  // === export ===
  const exported = await rawCall(
    session,
    'POST',
    `/v1/runs/${runId}/exports`,
    { artifact_ids: approvals.map((entry) => entry.artifact_id), format: 'zip' },
    `approve-export-${session.runId}-export`,
  );
  log(`EXPORT HTTP ${exported.status} ${JSON.stringify(exported.body).slice(0, 300)}`);
  const exportData = record(exported.body['data'] ?? exported.body, 'export data');
  const exportArtifact = record(exportData['artifact'] ?? exportData, 'export artifact');
  const exportHash = String(exportArtifact['content_hash'] ?? exportArtifact['contentHash'] ?? '');
  if (exported.status !== 201 && exported.status !== 200) {
    failures.push(`export: HTTP ${exported.status}`);
  }
  if (!/^[0-9a-f]{64}$/u.test(exportHash)) failures.push('export: no content hash returned');

  // Determinism: exporting the same members again must produce byte-identical output, proven by
  // the content hash (which is the object key basis) matching exactly.
  const exportedAgain = await rawCall(
    session,
    'POST',
    `/v1/runs/${runId}/exports`,
    { artifact_ids: approvals.map((entry) => entry.artifact_id), format: 'zip' },
    `approve-export-${session.runId}-export-2`,
  );
  const exportAgainData = record(exportedAgain.body['data'] ?? exportedAgain.body, 'export2');
  const exportAgainArtifact = record(exportAgainData['artifact'] ?? exportAgainData, 'artifact2');
  const exportAgainHash = String(
    exportAgainArtifact['content_hash'] ?? exportAgainArtifact['contentHash'] ?? '',
  );
  log(`EXPORT-AGAIN hash match: ${String(exportHash === exportAgainHash)}`);
  if (exportHash !== exportAgainHash) {
    failures.push(`export determinism: ${exportHash} != ${exportAgainHash}`);
  }

  // === final money state ===
  const finalReceiptResult = requireOk(
    await transport.call('get_receipt', { context: ctx(), run_id: runId }),
    'get_receipt (final)',
  );
  const finalReceipt = record(finalReceiptResult['receipt'], 'final receipt');
  const reservation = record(finalReceipt['reservation'], 'reservation');
  const residual =
    BigInt(String(reservation['amount_micros'])) -
    BigInt(String(reservation['captured_micros'])) -
    BigInt(String(reservation['released_micros']));
  log(`CAPTURED ${String(reservation['captured_micros'])} micros`);
  log(`RESIDUAL ${residual.toString(10)} micros`);
  if (String(reservation['captured_micros']) !== EXPECTED_QUOTE_MICROS.toString(10)) {
    failures.push(
      `captured ${String(reservation['captured_micros'])}, expected ${EXPECTED_QUOTE_MICROS.toString(10)}`,
    );
  }
  if (residual !== 0n) failures.push(`residual ${residual.toString(10)}, expected 0`);

  await mkdir(outDirectory, { recursive: true });
  await writeFile(
    `${outDirectory}/approve-export-result.json`,
    `${JSON.stringify(
      {
        session: { ...session, accessToken: '[redacted]' },
        approval: approvedData,
        replay: replayedData,
        export: { content_hash: exportHash, deterministic: exportHash === exportAgainHash },
        final_receipt: finalReceipt,
        failures,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  if (failures.length > 0) {
    throw new Error(`Approve/export assertions failed:\n  - ${failures.join('\n  - ')}`);
  }
  log('ALL ASSERTIONS PASSED');
}

export async function runApproveExportProbe(
  argv: readonly string[],
  log: (message: string) => void = console.log,
): Promise<number> {
  const sessionIndex = argv.indexOf('--session');
  const sessionPath =
    sessionIndex >= 0 && argv[sessionIndex + 1] !== undefined
      ? (argv[sessionIndex + 1] as string)
      : fileURLToPath(new URL('../../../.scratch/approve-export-session.json', import.meta.url));
  const outIndex = argv.indexOf('--out');
  const outDirectory =
    outIndex >= 0 && argv[outIndex + 1] !== undefined
      ? (argv[outIndex + 1] as string)
      : fileURLToPath(new URL('../../../.scratch/approve-export/', import.meta.url));

  if (argv.includes('--prepare')) {
    await prepare(sessionPath, log);
    return 0;
  }
  if (argv.includes('--start')) {
    await start(sessionPath, log);
    return 0;
  }
  if (argv.includes('--approve-export')) {
    await approveAndExport(sessionPath, outDirectory, log);
    return 0;
  }
  log('Select exactly one mode: --prepare, --start, or --approve-export.');
  return 1;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  runApproveExportProbe(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
