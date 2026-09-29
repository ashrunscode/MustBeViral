import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, URL as NodeUrl } from 'node:url';

import {
  buildGoldenLaunchPackGraph,
  createMustBeViralRestClient,
  type GoldenBriefId,
  type GoldenCampaignBrief,
} from '@mustbeviral/contracts';

import { HarnessFlowError } from './launch-pack-harness-lib';
import { loadGoldenBriefRegistry } from './golden-brief-registry';
import {
  authenticateDisposableStagingUser,
  createConfirmedDisposableStagingUser,
  loadStagingAdminConfiguration,
  type DisposableIdentity,
  type StagingAdminConfiguration,
} from './staging-auth';

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const STAGING_WEB_URL = 'https://mustbeviral-web-staging.vercel.app';
const CREDENTIALS_PATH = fileURLToPath(
  new NodeUrl('../../../.scratch/self-session-kit-credentials.md', import.meta.url),
);

export const PACK_QUOTE_MICROS = 4_550_000n;
export const WALLET_CREDIT_MICROS = 22_750_000n;
export const SELF_SESSION_BRIEF_IDS = [
  'GB-02',
  'GB-04',
  'GB-10',
] as const satisfies readonly GoldenBriefId[];

interface SeededBrief {
  readonly briefId: GoldenBriefId;
  readonly product: string;
  readonly projectId: string;
  readonly canvasId: string;
  readonly revisionId: string;
}

interface KitRecord {
  readonly userId: string;
  readonly workspaceId: string;
  readonly creditTransactionId: string;
  readonly creditReplayed: boolean;
  readonly creditedMicros: string;
  readonly packQuoteMicros: string;
  readonly quoteId: string;
  readonly quoteMicros: string;
  readonly quoteResponseParsed: true;
  readonly seededBriefs: readonly SeededBrief[];
  readonly observedAt: string;
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HarnessFlowError({
      code: 'INVALID_RESPONSE',
      message: `${label} returned an invalid response.`,
    });
  }
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessFlowError({
      code: 'INVALID_RESPONSE',
      message: `${label} did not return a string identifier.`,
    });
  }
  return value;
}

function requireData<
  Response extends Readonly<{ data: unknown }> | Readonly<{ error: { code: string } }>,
>(response: Response, operation: string): Extract<Response, { data: unknown }>['data'] {
  if ('error' in response) {
    throw new HarnessFlowError({
      code: response.error.code,
      message: `${operation} failed closed.`,
    });
  }
  return response.data as Extract<Response, { data: unknown }>['data'];
}

export function stableBriefSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]/gu, '-')
      .slice(0, 60) || 'studio'
  );
}

export function briefBootstrapKey(operation: string, identity: string): string {
  return `web-brief-${operation}-${stableBriefSegment(identity)}`;
}

export function createSelfSessionIdentity(now: () => number = Date.now): DisposableIdentity {
  return {
    email: `ernijs.ansons+self-session-${String(now())}-${randomBytes(12).toString('hex')}@gmail.com`,
    password: `Ss!9-${randomBytes(32).toString('base64url')}`,
  };
}

export function credentialsDocument(
  identity: DisposableIdentity,
  input: Readonly<{ userId: string; workspaceId?: string; seededBriefs?: readonly SeededBrief[] }>,
): string {
  const workspacePath =
    input.workspaceId === undefined
      ? 'Provisioning in progress'
      : `${STAGING_WEB_URL}/login?next=${encodeURIComponent(`/studio/${input.workspaceId}/brief`)}`;
  const seeded =
    input.seededBriefs === undefined
      ? '- Provisioning in progress'
      : input.seededBriefs
          .map(
            (brief) =>
              `- ${brief.briefId} ${brief.product}: ${STAGING_WEB_URL}/studio/${input.workspaceId}/canvas?canvas=${brief.canvasId}`,
          )
          .join('\n');
  return `# MustBeViral staging operator self-session credentials

This ignored local file contains staging-only sign-in credentials. Never commit, paste into evidence,
or use against production.

- Email: ${identity.email}
- Password: ${identity.password}
- Staging user ID: ${input.userId}
- Staging workspace ID: ${input.workspaceId ?? 'Provisioning in progress'}
- Sign-in and brief start: ${workspacePath}

Seeded registered-brief canvases:

${seeded}

Each confirmed full-pack run captures 4,550,000 micros. The wallet contains five pack credits
(22,750,000 micros). Same-UTC-day retry is allowed only after a fail-evaluation record returns
evaluated_retry; never bypass or raise the $25/workspace/day transactional cap.
`;
}

async function persistCredentials(
  identity: DisposableIdentity,
  input: Readonly<{ userId: string; workspaceId?: string; seededBriefs?: readonly SeededBrief[] }>,
): Promise<void> {
  await mkdir(dirname(CREDENTIALS_PATH), { recursive: true });
  await writeFile(CREDENTIALS_PATH, credentialsDocument(identity, input), 'utf8');
}

async function creditWorkspace(
  configuration: StagingAdminConfiguration,
  workspaceId: string,
): Promise<Readonly<{ transactionId: string; replayed: boolean }>> {
  const response = await fetch(`${configuration.supabaseUrl}/rest/v1/rpc/record_ledger_movement`, {
    method: 'POST',
    headers: {
      apikey: configuration.serviceRoleKey,
      authorization: `Bearer ${configuration.serviceRoleKey}`,
      'content-type': 'application/json',
      'user-agent': 'mustbeviral-self-session-kit/1',
    },
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_entry_type: 'credit',
      p_amount_micros: Number(WALLET_CREDIT_MICROS),
      p_causative_key: `operator-self-session-kit:${workspaceId}:five-pack-credit`,
      p_reservation_id: null,
      p_run_id: null,
      p_request_id: `self-session-credit-${randomUUID()}`,
      p_metadata: {
        purpose: 'operator_self_sessions',
        pack_count: 5,
        pack_quote_micros: Number(PACK_QUOTE_MICROS),
      },
    }),
  });
  if (!response.ok) {
    throw new HarnessFlowError({
      code: 'WALLET_CREDIT_FAILED',
      message: 'The staging operator wallet credit failed closed through PostgREST.',
      http_status: response.status,
    });
  }
  const body = record((await response.json()) as unknown, 'record_ledger_movement');
  return {
    transactionId: text(body['transaction_id'], 'record_ledger_movement.transaction_id'),
    replayed: body['replayed'] === true,
  };
}

async function seedBrief(
  client: ReturnType<typeof createMustBeViralRestClient>,
  workspaceId: string,
  brief: GoldenCampaignBrief,
): Promise<SeededBrief> {
  const campaignName = `${brief.product} launch pack`;
  const project = requireData(
    await client.request('create_project', {
      id: workspaceId,
      idempotencyKey: briefBootstrapKey('project', `${workspaceId}-${campaignName}`),
      body: { name: campaignName },
    }),
    'create_project',
  );
  const projectId = project.project.id;
  const canvas = requireData(
    await client.request('create_canvas', {
      id: projectId,
      idempotencyKey: briefBootstrapKey('canvas', projectId),
      body: { name: `${campaignName} canvas` },
    }),
    'create_canvas',
  );
  const graph = buildGoldenLaunchPackGraph(brief);
  const patched = requireData(
    await client.request('apply_canvas_patch', {
      id: canvas.canvasId,
      idempotencyKey: `self-session-seed-${brief.briefId.toLowerCase()}-${canvas.canvasId}`,
      body: {
        expected_revision_id: canvas.revisionId,
        reason: `Seed ${brief.briefId} for operator self-sessions`,
        patch: {
          upsert_nodes: [...graph.nodes],
          remove_node_ids: [],
          upsert_edges: [...graph.edges],
          remove_edge_ids: [],
        },
      },
    }),
    'apply_canvas_patch',
  );
  const validation = requireData(
    await client.request('validate_graph', { id: canvas.canvasId, body: {} }),
    'validate_graph',
  );
  if (!validation.valid || validation.revisionId !== patched.revisionId) {
    throw new HarnessFlowError({
      code: 'GRAPH_INVALID',
      message: `${brief.briefId} did not validate at the seeded revision.`,
    });
  }
  const briefId = SELF_SESSION_BRIEF_IDS.find((id) => id === brief.briefId);
  if (briefId === undefined) {
    throw new HarnessFlowError({
      code: 'GRAPH_INVALID',
      message: `${brief.briefId} is not a self-session brief.`,
    });
  }
  return {
    briefId,
    product: brief.product,
    projectId,
    canvasId: canvas.canvasId,
    revisionId: patched.revisionId,
  };
}

async function main(): Promise<void> {
  const configuration = await loadStagingAdminConfiguration();
  const identity = createSelfSessionIdentity();
  const userId = await createConfirmedDisposableStagingUser({ configuration, identity });
  await persistCredentials(identity, { userId });
  const authentication = await authenticateDisposableStagingUser({
    configuration,
    identity,
    log: () => undefined,
  });
  const client = createMustBeViralRestClient({
    baseUrl: STAGING_CORE_URL,
    getAccessToken: async () => authentication.accessToken,
    createRequestId: () => `self-session-${randomUUID()}`,
  });
  const workspace = requireData(
    await client.request('create_workspace', {
      idempotencyKey: `operator-self-session-workspace-${userId}`,
      body: { name: 'Operator self-session workspace' },
    }),
    'create_workspace',
  );
  const workspaceId = workspace.workspace_id;
  await persistCredentials(identity, { userId, workspaceId });

  const registry = await loadGoldenBriefRegistry();
  const selected = SELF_SESSION_BRIEF_IDS.map((briefId) => {
    const brief = registry.find((candidate) => candidate.briefId === briefId);
    if (brief === undefined) throw new TypeError(`${briefId} is absent from the golden registry.`);
    return brief;
  });
  const seededBriefs: SeededBrief[] = [];
  for (const brief of selected) seededBriefs.push(await seedBrief(client, workspaceId, brief));
  await persistCredentials(identity, { userId, workspaceId, seededBriefs });

  const credit = await creditWorkspace(configuration, workspaceId);
  const smokeCanvas = seededBriefs[0];
  if (smokeCanvas === undefined) throw new TypeError('No self-session canvas was seeded.');
  const quote = requireData(
    await client.request('quote_run', {
      id: smokeCanvas.canvasId,
      idempotencyKey: `self-session-contract-smoke-${smokeCanvas.canvasId}`,
      body: { expected_revision_id: smokeCanvas.revisionId },
    }),
    'quote_run',
  );
  if (
    quote.quote.maximumChargeMicros !== PACK_QUOTE_MICROS.toString() ||
    quote.spend.runCapMicros !== '8000000' ||
    quote.spend.workspaceDayCapMicros !== '25000000'
  ) {
    throw new HarnessFlowError({
      code: 'QUOTE_CONTRACT_MISMATCH',
      message: 'The typed staging quote parsed but its monetary invariants did not match the kit.',
    });
  }
  const proof: KitRecord = {
    userId,
    workspaceId,
    creditTransactionId: credit.transactionId,
    creditReplayed: credit.replayed,
    creditedMicros: WALLET_CREDIT_MICROS.toString(),
    packQuoteMicros: PACK_QUOTE_MICROS.toString(),
    quoteId: quote.quote.quoteId,
    quoteMicros: quote.quote.maximumChargeMicros,
    quoteResponseParsed: true,
    seededBriefs,
    observedAt: new Date().toISOString(),
  };
  console.log(`SELF_SESSION_KIT_PROOF ${JSON.stringify(proof)}`);
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await main();
}
