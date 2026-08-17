import { describe, expect, it } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { WorkerBriefBootstrapPort } from './brief-bootstrap';

describe('WorkerBriefBootstrapPort', () => {
  it('resolves or creates the workspace, then creates a project and canvas in order', async () => {
    const timestamp = '2026-08-11T12:00:00.000Z';
    const calls: Array<Readonly<{ body: string | undefined; headers: Headers; url: string }>> = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-brief-0001',
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({
          body: init?.body === undefined ? undefined : String(init.body),
          headers: new Headers(init?.headers),
          url,
        });
        const payload = url.endsWith('/workspaces/lumen-skin')
          ? {
              error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                request_id: 'request-brief-0001',
                retryable: false,
              },
            }
          : url.endsWith('/workspaces')
            ? {
                data: { workspace_id: 'workspace-live', role: 'owner' },
                meta: { request_id: 'request-brief-0001' },
              }
            : url.endsWith('/projects')
              ? {
                  data: {
                    project: {
                      brand_kit_id: null,
                      brief_id: null,
                      created_at: timestamp,
                      created_by: 'user-live',
                      id: 'project-live',
                      name: 'Lumen Skin launch pack',
                      status: 'active',
                      updated_at: timestamp,
                      workspace_id: 'workspace-live',
                    },
                  },
                  meta: { request_id: 'request-brief-0001' },
                }
              : {
                  data: {
                    canvasId: 'canvas-live',
                    revisionId: 'revision-live',
                    canonicalHash: 'a'.repeat(64),
                  },
                  meta: { request_id: 'request-brief-0001' },
                };
        return new Response(JSON.stringify(payload), {
          status: 'error' in payload ? 404 : url.endsWith('/canvases') ? 201 : 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    await expect(
      new WorkerBriefBootstrapPort(client).bootstrap({
        workspaceRef: 'lumen-skin',
        campaignName: 'Lumen Skin launch pack',
      }),
    ).resolves.toEqual({
      type: 'ok',
      workspaceId: 'workspace-live',
      projectId: 'project-live',
      canvasId: 'canvas-live',
      revisionId: 'revision-live',
    });
    expect(calls.map(({ url }) => url)).toEqual([
      'https://api.example.test/v1/workspaces/lumen-skin',
      'https://api.example.test/v1/workspaces',
      'https://api.example.test/v1/workspaces/workspace-live/projects',
      'https://api.example.test/v1/projects/project-live/canvases',
    ]);
    expect(calls.slice(1).every(({ headers }) => headers.has('idempotency-key'))).toBe(true);
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({ name: 'lumen skin' });
  });

  it('applies the launch-pack graph onto the new canvas instead of leaving the empty brief root', async () => {
    const { buildGoldenLaunchPackGraph } = await import('@mustbeviral/contracts');
    const graph = buildGoldenLaunchPackGraph({
      briefId: 'studio-test',
      product: 'Test Serum',
      category: 'Skincare',
      packshots: 'front.png',
      features: 'Feature',
      benefits: 'Benefit',
      evidence: 'Evidence',
      approvedFacts: 'Fact',
      offer: '$10',
      pricePresentation: '$10',
      urgency: 'None',
      destination: 'https://example.com/p',
      brandKit: 'Black, white',
      audienceAndAwareness: 'Adults; problem-aware',
      painsDesiresObjections: 'Dry skin',
      requiredClaimsLegal: 'Results vary',
      prohibitedClaims: 'Cures acne',
      creativeConstraintsRights: 'Product only',
      stressVector: 'Claims pressure',
    });
    const calls: string[] = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-brief-0002',
      fetch: async (input, init) => {
        const url = String(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url.endsWith('/workspaces/campaign')) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                request_id: 'request-brief-0002',
                retryable: false,
              },
            }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/workspaces')) {
          return new Response(
            JSON.stringify({
              data: { workspace_id: 'workspace-live', role: 'owner' },
              meta: { request_id: 'request-brief-0002' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/projects')) {
          return new Response(
            JSON.stringify({
              data: {
                project: {
                  brand_kit_id: null,
                  brief_id: null,
                  created_at: '2026-08-15T12:00:00.000Z',
                  created_by: 'user-live',
                  id: 'project-live',
                  name: 'Test Serum launch pack',
                  status: 'active',
                  updated_at: '2026-08-15T12:00:00.000Z',
                  workspace_id: 'workspace-live',
                },
              },
              meta: { request_id: 'request-brief-0002' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/canvases')) {
          return new Response(
            JSON.stringify({
              data: {
                canvasId: 'canvas-live',
                revisionId: 'revision-initial',
                canonicalHash: 'a'.repeat(64),
              },
              meta: { request_id: 'request-brief-0002' },
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/canvases/canvas-live') && (init?.method ?? 'GET') === 'GET') {
          return new Response(
            JSON.stringify({
              data: {
                canvas: {
                  canvasId: 'canvas-live',
                  projectId: 'project-live',
                  headRevisionId: 'revision-initial',
                  graphSchemaVersion: 1,
                  graphSnapshot: {
                    nodes: [
                      { id: 'brief', kind: 'brief', parameter_schema_version: 1, parameters: {} },
                    ],
                    edges: [],
                  },
                  canonicalHash: 'a'.repeat(64),
                },
              },
              meta: { request_id: 'request-brief-0002' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            data: {
              canvasId: 'canvas-live',
              revisionId: 'revision-pack',
              canonicalHash: 'b'.repeat(64),
              affectedDescendants: ['copy-1'],
            },
            meta: { request_id: 'request-brief-0002' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    await expect(
      new WorkerBriefBootstrapPort(client).bootstrap({
        workspaceRef: 'campaign',
        campaignName: 'Test Serum launch pack',
        graph,
      }),
    ).resolves.toEqual({
      type: 'ok',
      workspaceId: 'workspace-live',
      projectId: 'project-live',
      canvasId: 'canvas-live',
      revisionId: 'revision-pack',
    });
    expect(calls.some((entry) => entry.includes('/patches'))).toBe(true);
  });

  it('re-applies the current draft graph onto a seeded launch-pack canvas', async () => {
    const { buildGoldenLaunchPackGraph } = await import('@mustbeviral/contracts');
    const graph = buildGoldenLaunchPackGraph({
      briefId: 'studio-northstar',
      product: 'Northstar Magnesium Glycinate Night Capsules.',
      category: 'Supplements; 60-capsule magnesium glycinate dietary supplement.',
      packshots: 'Amber bottle, Supplement Facts readable.',
      features: '200 mg magnesium',
      benefits: 'Evening routine',
      evidence: 'Supplement Facts',
      approvedFacts: 'Two capsules per serving',
      offer: '$54 or $45.90 subscription',
      pricePresentation: '$54 or $45.90 subscription',
      urgency: 'None',
      destination: 'https://northstar-night.example/products/magnesium',
      brandKit: 'Navy and mineral gray',
      audienceAndAwareness: 'Active adults; problem-aware',
      painsDesiresObjections: 'Absorption questions',
      requiredClaimsLegal: 'FDA dietary-supplement disclaimer',
      prohibitedClaims: 'No insomnia claims',
      creativeConstraintsRights: 'Product-only, no doctor imagery',
      stressVector: 'Supplement-claim pressure',
    });
    const calls: string[] = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-brief-0003',
      fetch: async (input, init) => {
        const url = String(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url.endsWith('/workspaces/campaign')) {
          return new Response(
            JSON.stringify({
              data: {
                workspace: {
                  created_at: '2026-08-17T12:00:00.000Z',
                  created_by: 'user-live',
                  daily_spend_cap_micros: 25_000_000,
                  id: 'workspace-live',
                  name: 'Campaign',
                  per_run_spend_cap_micros: 8_000_000,
                  slug: 'campaign',
                  status: 'active',
                  updated_at: '2026-08-17T12:00:00.000Z',
                },
              },
              meta: { request_id: 'request-brief-0003' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/projects')) {
          return new Response(
            JSON.stringify({
              data: {
                project: {
                  brand_kit_id: null,
                  brief_id: null,
                  created_at: '2026-08-17T12:00:00.000Z',
                  created_by: 'user-live',
                  id: 'project-live',
                  name: 'Northstar Magnesium Glycinate Night Capsules.',
                  status: 'active',
                  updated_at: '2026-08-17T12:00:00.000Z',
                  workspace_id: 'workspace-live',
                },
              },
              meta: { request_id: 'request-brief-0003' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/canvases')) {
          return new Response(
            JSON.stringify({
              data: {
                canvasId: 'canvas-seeded',
                revisionId: 'revision-seeded',
                canonicalHash: 'a'.repeat(64),
              },
              meta: { request_id: 'request-brief-0003' },
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/canvases/canvas-seeded') && (init?.method ?? 'GET') === 'GET') {
          return new Response(
            JSON.stringify({
              data: {
                canvas: {
                  canvasId: 'canvas-seeded',
                  projectId: 'project-live',
                  headRevisionId: 'revision-seeded',
                  graphSchemaVersion: 1,
                  graphSnapshot: {
                    nodes: [
                      {
                        id: 'brief',
                        kind: 'brief',
                        parameter_schema_version: 1,
                        parameters: { product: 'Northstar Magnesium Glycinate Night Capsules.' },
                      },
                      {
                        id: 'copy-1',
                        kind: 'planner_text',
                        parameter_schema_version: 1,
                        parameters: { asset_role: 'copy_set' },
                      },
                      {
                        id: 'master-1',
                        kind: 'image_generation',
                        parameter_schema_version: 1,
                        parameters: { asset_role: 'master_static' },
                      },
                      {
                        id: 'motion-1',
                        kind: 'video_generation',
                        parameter_schema_version: 1,
                        parameters: { asset_role: 'motion_branch' },
                      },
                    ],
                    edges: [],
                  },
                  canonicalHash: 'a'.repeat(64),
                },
              },
              meta: { request_id: 'request-brief-0003' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            data: {
              canvasId: 'canvas-seeded',
              revisionId: 'revision-refreshed',
              canonicalHash: 'c'.repeat(64),
              affectedDescendants: ['master-1'],
            },
            meta: { request_id: 'request-brief-0003' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    await expect(
      new WorkerBriefBootstrapPort(client).bootstrap({
        workspaceRef: 'campaign',
        campaignName: 'Northstar Magnesium Glycinate Night Capsules.',
        graph,
      }),
    ).resolves.toEqual({
      type: 'ok',
      workspaceId: 'workspace-live',
      projectId: 'project-live',
      canvasId: 'canvas-seeded',
      revisionId: 'revision-refreshed',
    });
    expect(calls.some((entry) => entry.includes('/patches'))).toBe(true);
  });
});
