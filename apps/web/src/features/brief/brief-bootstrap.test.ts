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
});
