import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGoldenLaunchPackGraph,
  type GoldenCampaignBrief,
  type QuoteRunResult,
} from '@mustbeviral/contracts';
import { createDatabaseRepositories } from '../../../../packages/db/src/index';
import {
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceProFastDescriptor,
  moonshotKimiK26Descriptor,
} from '../../../../packages/provider/src/catalog';
import {
  createSupabaseHandlerPorts,
  createSupabaseRequestDependencies,
} from '../../src/composition/supabase';
import { SupabaseDataApiExecutor } from '../../src/data/supabase-data-api';

const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const workspaceId = '10000000-0000-4000-8000-000000000001';
const otherWorkspaceId = '10000000-0000-4000-8000-000000000002';
const projectId = '20000000-0000-4000-8000-000000000001';
const canvasId = '30000000-0000-4000-8000-000000000001';
const revisionId = '40000000-0000-4000-8000-000000000001';
const catalogId = '50000000-0000-4000-8000-000000000001';

const brief = Object.fromEntries(
  [
    'product',
    'category',
    'packshots',
    'features',
    'benefits',
    'evidence',
    'approvedFacts',
    'offer',
    'pricePresentation',
    'urgency',
    'destination',
    'brandKit',
    'audienceAndAwareness',
    'painsDesiresObjections',
    'requiredClaimsLegal',
    'prohibitedClaims',
    'creativeConstraintsRights',
    'stressVector',
  ].map((field) => [field, `${field} fixture`]),
) as unknown as GoldenCampaignBrief;
const launchGraph = buildGoldenLaunchPackGraph({ ...brief, briefId: 'GB-01' });

const routeFixtures = [
  [moonshotKimiK26Descriptor, '60000000-0000-4000-8000-000000000001', 'request', 150_000],
  [falFlux2ProDescriptor, '60000000-0000-4000-8000-000000000002', 'image', 500_000],
  [falFluxKontextProDescriptor, '60000000-0000-4000-8000-000000000003', 'image', 200_000],
  [falSeedanceProFastDescriptor, '60000000-0000-4000-8000-000000000004', 'video_second', 100_000],
] as const;

interface QuoteFixtureState {
  quote: Readonly<Record<string, unknown>> | null;
  quoteInserts: number;
}

function quoteFixtureFetch(state: QuoteFixtureState): typeof fetch {
  return vi.fn(async (request: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(request);
    const method = init?.method ?? 'GET';
    if (url.includes('/rpc/create_quote') && method === 'POST') {
      if (state.quote === null) {
        const createdAt = new Date().toISOString();
        const executionPlan = launchGraph.nodes.flatMap((node) => {
          const role = node.parameters.asset_role;
          const routeIndex: number =
            role === 'copy_set'
              ? 0
              : role === 'master_static'
                ? 1
                : role === 'adaptation'
                  ? 2
                  : role === 'motion_branch'
                    ? 3
                    : -1;
          if (routeIndex < 0) return [];
          const route = routeFixtures[routeIndex];
          if (route === undefined) throw new Error(`Missing route fixture for ${String(role)}`);
          const [, modelRouteId, unit, unitPriceMicros] = route;
          const quantity = role === 'motion_branch' ? 8 : 1;
          const lineTotal = quantity * unitPriceMicros;
          return [
            {
              ready: true,
              node_id: node.id,
              model_route_id: modelRouteId,
              provider_model_id: route[0].modelId,
              price_components: [
                {
                  unit,
                  quantity: String(quantity),
                  unit_price_micros: String(unitPriceMicros),
                  total_micros: String(lineTotal),
                },
              ],
              total_micros: String(lineTotal),
            },
          ];
        });
        state.quoteInserts += 1;
        state.quote = {
          id: '70000000-0000-4000-8000-000000000001',
          workspace_id: workspaceId,
          project_id: projectId,
          canvas_id: canvasId,
          canvas_revision_id: revisionId,
          price_catalog_version_id: catalogId,
          execution_plan: executionPlan,
          quote_hash: 'b'.repeat(64),
          maximum_charge_micros: 4_550_000,
          currency: 'USD',
          created_by: actorId,
          created_at: createdAt,
          expires_at: new Date(Date.parse(createdAt) + 15 * 60 * 1000).toISOString(),
        };
      }
      return Response.json({
        quote_id: state.quote.id,
        maximum_charge_micros: String(state.quote.maximum_charge_micros),
        price_catalog_version_id: state.quote.price_catalog_version_id,
        expires_at: state.quote.expires_at,
      });
    }
    if (url.includes('/workspace_memberships?')) return Response.json({ id: 'membership-1' });
    if (url.includes('/canvases?')) {
      return Response.json({
        id: canvasId,
        workspace_id: workspaceId,
        project_id: projectId,
        head_revision_id: revisionId,
      });
    }
    if (url.includes('/canvas_revisions?')) {
      return Response.json({
        id: revisionId,
        workspace_id: workspaceId,
        canvas_id: canvasId,
        graph_schema_version: 1,
        graph_snapshot: launchGraph,
        canonical_hash: 'a'.repeat(64),
      });
    }
    if (url.includes('/price_catalog_versions?')) {
      return Response.json([
        {
          id: catalogId,
          effective_at: '2026-07-19T00:00:00.000Z',
          status: 'active',
        },
      ]);
    }
    if (url.includes('/model_routes?')) {
      return Response.json(
        routeFixtures.map(([descriptor, id]) => ({
          id,
          provider_model_id: descriptor.modelId,
          route_key: descriptor.routeId,
        })),
      );
    }
    if (url.includes('/model_route_prices?')) {
      return Response.json(
        routeFixtures.map(([, modelRouteId, unit, unitPriceMicros]) => ({
          model_route_id: modelRouteId,
          price_catalog_version_id: catalogId,
          unit,
          unit_price_micros: unitPriceMicros,
        })),
      );
    }
    if (url.includes('/quotes?') && method === 'GET') {
      const requestedWorkspace = new URL(url).searchParams.get('workspace_id');
      if (state.quote === null || requestedWorkspace !== `eq.${workspaceId}`) {
        return Response.json({ code: 'PGRST116', message: 'not found' }, { status: 406 });
      }
      return Response.json(state.quote);
    }
    if (url.includes('/workspaces?')) {
      return Response.json({
        id: workspaceId,
        per_run_spend_cap_micros: 8_000_000,
        daily_spend_cap_micros: 25_000_000,
      });
    }
    if (url.includes('/ledger_transactions?') || url.includes('/cost_reservations?')) {
      return Response.json([]);
    }
    throw new Error(`Unexpected quote fixture request: ${method} ${url}`);
  });
}

function context(workspace_id = workspaceId) {
  return {
    workspace_id,
    actor_id: actorId,
    request_id: 'request-quote-composition-1',
  };
}

function dependencies(state: QuoteFixtureState) {
  const composed = createSupabaseRequestDependencies(
    {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'public-fixture-key',
    } as unknown as PlatformBindings,
    'verified-caller-jwt',
    { actorId, authenticationMethod: 'supabase_jwt' },
    quoteFixtureFetch(state),
  );
  if (composed === null) throw new Error('Expected configured Supabase composition');
  return composed;
}

function ports(state: QuoteFixtureState) {
  const executor = new SupabaseDataApiExecutor({
    baseUrl: 'https://project.supabase.co',
    publishableKey: 'public-fixture-key',
    callerJwt: 'verified-caller-jwt',
    fetch: quoteFixtureFetch(state),
  });
  return createSupabaseHandlerPorts(executor, createDatabaseRepositories(executor));
}

async function quote(state: QuoteFixtureState): Promise<QuoteRunResult> {
  return dependencies(state).handlers.quote_run({
    context: context(),
    canvas_id: canvasId,
    expected_revision_id: revisionId,
    idempotency_key: 'quote-idempotency-1',
  }) as Promise<QuoteRunResult>;
}

describe('composed quote and billing ports', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('plans and persists the named launch-pack quote without provider execution', async () => {
    const state: QuoteFixtureState = { quote: null, quoteInserts: 0 };
    const result = await quote(state);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected quote success');
    expect(result.quote.maximumChargeMicros).toBe(4_550_000n);
    expect(Date.parse(result.quote.expiresAt) - Date.parse(result.quote.createdAt)).toBe(
      15 * 60 * 1000,
    );
    expect(state.quoteInserts).toBe(1);
    expect(state.quote?.execution_plan).toEqual(
      expect.arrayContaining([expect.objectContaining({ ready: true, node_id: 'motion-1' })]),
    );
    await expect(ports(state).billing.get(context())).resolves.toMatchObject({
      availableBalanceMicros: 0n,
      workspaceDayExposureMicros: 0n,
      globalDayExposureMicros: 0n,
    });
  });

  it('replays the same quote idempotency key without a second insert', async () => {
    const state: QuoteFixtureState = { quote: null, quoteInserts: 0 };
    const first = await quote(state);
    const replay = await quote(state);

    expect(first.status).toBe('ok');
    expect(replay).toEqual(first);
    expect(state.quoteInserts).toBe(1);
  });

  it('accepts persisted confirmation, rejects expiry, and hides a tenant mismatch', async () => {
    const state: QuoteFixtureState = { quote: null, quoteInserts: 0 };
    const quoted = await quote(state);
    if (quoted.status !== 'ok') throw new Error('Expected quote success');
    const confirmation = (workspace_id = workspaceId) =>
      ports(state).confirmations.verify(context(workspace_id), {
        token: 'explicit-confirmation-token',
        quoteId: quoted.quote.quoteId,
        maximumChargeMicros: quoted.quote.maximumChargeMicros,
      });

    await expect(confirmation()).resolves.toBe(true);

    const expiresAt = new Date(Date.now() - 1_000).toISOString();
    state.quote = {
      ...state.quote,
      created_at: new Date(Date.parse(expiresAt) - 15 * 60 * 1000).toISOString(),
      expires_at: expiresAt,
    };
    await expect(confirmation()).resolves.toBe(false);
    await expect(confirmation(otherWorkspaceId)).resolves.toBe(false);
  });
});
