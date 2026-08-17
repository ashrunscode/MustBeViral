import { describe, expect, it } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { composeReviewConcepts, InMemoryReviewPort, WorkerReviewPort } from './review-port';

describe('InMemoryReviewPort', () => {
  it('persists approve and reject transitions', () => {
    const port = new InMemoryReviewPort();
    const approved = port.decideVariant({
      variantId: 'hero-b',
      decision: 'approved',
      expectedRevisionId: '7f3a',
    });
    expect(approved.type).toBe('ok');
    expect(port.read()[0]!.variants.find((variant) => variant.id === 'hero-b')?.decision).toBe(
      'approved',
    );

    const rejected = port.decideVariant({
      variantId: 'story-a',
      decision: 'rejected',
      reason: 'Missing required disclaimer',
      expectedRevisionId: '7f3a',
    });
    expect(rejected.type).toBe('ok');
    expect(port.read()[0]!.variants.find((variant) => variant.id === 'story-a')).toMatchObject({
      decision: 'rejected',
      rejectionReason: 'Missing required disclaimer',
    });
  });

  it('requires a rejection reason', () => {
    expect(
      new InMemoryReviewPort().decideVariant({
        variantId: 'story-a',
        decision: 'rejected',
        expectedRevisionId: '7f3a',
      }),
    ).toEqual({ type: 'reason_required', variant_id: 'story-a' });
  });

  it('persists named group approval', () => {
    const port = new InMemoryReviewPort();
    const result = port.approveGroup({
      groupId: 'visuals',
      reviewer: 'Maya Chen',
      expectedRevisionId: '7f3a',
    });
    expect(result.type).toBe('ok');
    expect(port.read()[0]).toMatchObject({ decision: 'approved', reviewer: 'Maya Chen' });
  });

  it('stores operator-authored accessibility descriptions', () => {
    const port = new InMemoryReviewPort();
    port.describeVariant({ variantId: 'hero-b', description: '  Alternate hero still life.  ' });
    expect(port.read()[0]!.variants.find((variant) => variant.id === 'hero-b')).toMatchObject({
      accessibilityDescription: 'Alternate hero still life.',
    });
  });

  it('returns conflict and not-found branches', () => {
    expect(
      new InMemoryReviewPort('conflict').approveGroup({
        groupId: 'visuals',
        reviewer: 'Maya Chen',
        expectedRevisionId: '7f3a',
      }),
    ).toEqual({ type: 'conflict', actual_revision_id: '81c2' });
    expect(
      new InMemoryReviewPort().approveGroup({
        groupId: 'missing',
        reviewer: 'Maya Chen',
        expectedRevisionId: '7f3a',
      }),
    ).toEqual({ type: 'not_found', artifact_id: 'missing' });
  });
});

describe('WorkerReviewPort', () => {
  const timestamp = '2026-08-11T12:00:00.000Z';
  const hash = 'a'.repeat(64);
  const artifact = {
    accessibility_description: 'A product still life on a neutral background.',
    approved_at: null,
    approved_by: null,
    artifact_kind: 'provider_output',
    byte_size: 2048,
    canvas_revision_id: 'revision-live',
    content_hash: hash,
    created_at: timestamp,
    id: 'artifact-live',
    mime_type: 'image/png',
    object_key: 'private/artifact-live.png',
    project_id: 'project-live',
    rights_attestation: { provider_model_id: 'provider/model-live' },
    run_id: 'run-live',
    run_node_id: 'run-node-live',
    status: 'available',
    updated_at: timestamp,
    workspace_id: 'workspace-live',
  };
  const receiptResponse = (
    accessibilityDescription: string | null = artifact.accessibility_description,
  ) => ({
    data: {
      receipt: {
        run: {
          canvas_id: 'canvas-live',
          canvas_revision_hash: hash,
          canvas_revision_id: 'revision-live',
          confirmed_at: timestamp,
          confirmed_by: 'user-live',
          created_at: timestamp,
          dispatch_epoch: 0,
          dispatch_wave: 1,
          id: 'run-live',
          project_id: 'project-live',
          quote_id: 'quote-live',
          status: 'succeeded',
          updated_at: timestamp,
          workspace_id: 'workspace-live',
        },
        reservation: {
          amount_micros: 4_550_000,
          captured_micros: 672_574,
          created_at: timestamp,
          id: 'reservation-live',
          quote_id: 'quote-live',
          refunded_micros: 0,
          released_micros: 3_877_426,
          run_id: 'run-live',
          status: 'released',
          updated_at: timestamp,
          workspace_id: 'workspace-live',
        },
        ledger: [],
        artifacts: [{ ...artifact, accessibility_description: accessibilityDescription }],
        lineage: [],
      },
    },
    meta: { request_id: 'request-review-0001' },
  });

  it('reads receipt artifacts and records approval with exact description and stable idempotency', async () => {
    const calls: Array<Readonly<{ body: string | undefined; headers: Headers; url: string }>> = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-review-0001',
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({
          body: init?.body === undefined ? undefined : String(init.body),
          headers: new Headers(init?.headers),
          url,
        });
        const payload = url.endsWith('/receipt')
          ? receiptResponse()
          : url.includes('/artifacts/artifact-live')
            ? {
                data: {
                  artifact,
                  access: {
                    url: 'https://core.example.test/v1/artifacts/artifact-live/content?token=review',
                    expires_at: timestamp,
                    purpose: 'review_preview',
                  },
                  copy: null,
                },
                meta: { request_id: 'request-review-0001' },
              }
            : url.endsWith('/approvals')
              ? {
                  data: {
                    run_id: 'run-live',
                    approved: 1,
                    replayed: 0,
                    artifacts: [{ artifact_id: 'artifact-live', artifact_kind: 'approved_output' }],
                  },
                  meta: { request_id: 'request-review-0001' },
                }
              : url.includes('/projects/')
                ? {
                    data: {
                      project: {
                        brand_kit_id: null,
                        brief_id: null,
                        created_at: timestamp,
                        created_by: 'user-live',
                        id: 'project-live',
                        name: 'Stillroom compost caddy launch pack',
                        status: 'active',
                        updated_at: timestamp,
                        workspace_id: 'workspace-live',
                      },
                    },
                    meta: { request_id: 'request-review-0001' },
                  }
                : {
                    data: {
                      run: {
                        runId: 'run-live',
                        projectId: 'project-live',
                        canvasId: 'canvas-live',
                        canvasRevisionId: 'revision-live',
                        quoteId: 'quote-live',
                        status: 'succeeded',
                        reservationId: 'reservation-live',
                      },
                      nodes: [
                        {
                          runNodeId: 'run-node-live',
                          nodeKey: 'master-1',
                          modelRouteId: 'provider/model-live',
                          status: 'succeeded',
                          dispatchWave: 2,
                        },
                      ],
                    },
                    meta: { request_id: 'request-review-0001' },
                  };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerReviewPort(client, 'run-live', 'user-live', () => 'approval-idem-1');
    const read = await port.read();
    expect(read).toMatchObject({
      type: 'ok',
      groups: [
        {
          id: 'masters',
          revision: 'revision-live',
          variants: [
            {
              label: 'Master · Packshot',
              format: 'Master still',
              nodeKey: 'master-1',
              previewUrl:
                'https://core.example.test/v1/artifacts/artifact-live/content?token=review',
            },
          ],
        },
      ],
      summary: {
        quotedMicros: 4_550_000n,
        capturedMicros: 672_574n,
        campaignName: 'Stillroom compost caddy launch pack',
      },
    });
    const input = {
      variantId: 'artifact-live',
      decision: 'approved' as const,
      expectedRevisionId: 'revision-live',
    };
    await expect(port.decideVariant(input)).resolves.toMatchObject({
      type: 'ok',
      groups: [{ variants: [{ decision: 'approved' }] }],
    });
    await port.decideVariant(input);
    const approvals = calls.filter(({ url }) => url.endsWith('/approvals'));
    expect(approvals.map(({ headers }) => headers.get('idempotency-key'))).toEqual([
      'approval-idem-1',
      'approval-idem-1',
    ]);
    expect(JSON.parse(approvals[0]?.body ?? '{}')).toEqual({
      approvals: [
        {
          artifact_id: 'artifact-live',
          accessibility_description: artifact.accessibility_description,
        },
      ],
    });
  });

  it('keeps rejection local and refuses approval without an accessibility description', async () => {
    let approvalCalls = 0;
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-review-0002',
      fetch: async (input) => {
        if (String(input).endsWith('/approvals')) approvalCalls += 1;
        return new Response(JSON.stringify(receiptResponse(null)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerReviewPort(client, 'run-live', 'user-live', () => 'approval-idem-2');
    await port.read();
    await expect(
      port.decideVariant({
        variantId: 'artifact-live',
        decision: 'rejected',
        reason: 'Needs correction',
        expectedRevisionId: 'revision-live',
      }),
    ).resolves.toMatchObject({ type: 'ok', groups: [{ variants: [{ decision: 'rejected' }] }] });
    await port.read();
    await expect(
      port.decideVariant({
        variantId: 'artifact-live',
        decision: 'approved',
        expectedRevisionId: 'revision-live',
      }),
    ).resolves.toEqual({ type: 'description_required', artifact_id: 'artifact-live' });
    expect(approvalCalls).toBe(0);
  });

  it('approves after the operator supplies a missing accessibility description', async () => {
    const bodies: string[] = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-review-0003',
      fetch: async (input, init) => {
        if (String(input).endsWith('/approvals')) {
          bodies.push(String(init?.body ?? ''));
          return new Response(
            JSON.stringify({
              data: {
                run_id: 'run-live',
                approved: 1,
                replayed: 0,
                artifacts: [{ artifact_id: 'artifact-live', artifact_kind: 'approved_output' }],
              },
              meta: { request_id: 'request-review-0003' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(receiptResponse(null)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerReviewPort(client, 'run-live', 'user-live', () => 'approval-idem-3');
    await port.read();
    port.describeVariant({
      variantId: 'artifact-live',
      description: 'Stillroom compost caddy on a sand countertop, product-only.',
    });
    await expect(
      port.decideVariant({
        variantId: 'artifact-live',
        decision: 'approved',
        expectedRevisionId: 'revision-live',
      }),
    ).resolves.toMatchObject({ type: 'ok', groups: [{ variants: [{ decision: 'approved' }] }] });
    expect(JSON.parse(bodies[0] ?? '{}')).toEqual({
      approvals: [
        {
          artifact_id: 'artifact-live',
          accessibility_description: 'Stillroom compost caddy on a sand countertop, product-only.',
        },
      ],
    });
  });

  it('approves every selected concept member through the existing approval operation', async () => {
    const second = {
      ...artifact,
      id: 'artifact-live-2',
      run_node_id: 'run-node-adaptation',
    };
    const bodies: string[] = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-review-0006',
      fetch: async (input, init) => {
        const url = String(input);
        let payload: unknown = {
          data: {
            run: {
              runId: 'run-live',
              projectId: 'project-live',
              canvasId: 'canvas-live',
              canvasRevisionId: 'revision-live',
              quoteId: 'quote-live',
              status: 'succeeded',
              reservationId: 'reservation-live',
            },
            nodes: [
              {
                runNodeId: 'run-node-live',
                nodeKey: 'master-1',
                modelRouteId: 'provider/model-live',
                status: 'succeeded',
                dispatchWave: 2,
              },
              {
                runNodeId: 'run-node-adaptation',
                nodeKey: 'adaptation-1-1',
                modelRouteId: 'provider/model-live',
                status: 'succeeded',
                dispatchWave: 3,
              },
            ],
          },
          meta: { request_id: 'request-review-0006' },
        };
        if (url.endsWith('/approvals')) {
          bodies.push(String(init?.body ?? ''));
          payload = {
            data: {
              run_id: 'run-live',
              approved: 2,
              replayed: 0,
              artifacts: [
                { artifact_id: 'artifact-live', artifact_kind: 'approved_output' },
                { artifact_id: 'artifact-live-2', artifact_kind: 'approved_output' },
              ],
            },
            meta: { request_id: 'request-review-0006' },
          };
        } else if (url.endsWith('/receipt')) {
          payload = {
            data: {
              receipt: {
                ...receiptResponse().data.receipt,
                artifacts: [artifact, second],
              },
            },
            meta: { request_id: 'request-review-0006' },
          };
        } else if (url.includes('/projects/')) {
          payload = {
            data: {
              project: {
                brand_kit_id: null,
                brief_id: null,
                created_at: timestamp,
                created_by: 'user-live',
                id: 'project-live',
                name: 'Stillroom compost caddy launch pack',
                status: 'active',
                updated_at: timestamp,
                workspace_id: 'workspace-live',
              },
            },
            meta: { request_id: 'request-review-0006' },
          };
        } else if (url.includes('/artifacts/')) {
          payload = {
            data: {
              artifact: url.includes('artifact-live-2') ? second : artifact,
              access: null,
              copy: null,
            },
            meta: { request_id: 'request-review-0006' },
          };
        }
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerReviewPort(client, 'run-live', 'user-live', () => 'approval-idem-6');
    await port.read();
    await expect(
      port.approveMembers({
        variantIds: ['artifact-live', 'artifact-live-2'],
        expectedRevisionId: 'revision-live',
      }),
    ).resolves.toMatchObject({
      type: 'ok',
      groups: [{ variants: [{ decision: 'approved' }] }, { variants: [{ decision: 'approved' }] }],
    });
    expect(JSON.parse(bodies[0] ?? '{}')).toEqual({
      approvals: [
        {
          artifact_id: 'artifact-live',
          accessibility_description: artifact.accessibility_description,
        },
        {
          artifact_id: 'artifact-live-2',
          accessibility_description: second.accessibility_description,
        },
      ],
    });
  });

  it('maps JSON copy artifacts to headline and primary text instead of a private well', async () => {
    const copyArtifact = {
      ...artifact,
      id: 'artifact-copy',
      mime_type: 'application/json',
      object_key: 'private/artifact-copy.json',
      run_node_id: 'run-node-copy',
      accessibility_description: 'Problem-recognition copy set for the launch pack.',
    };
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-review-0004',
      fetch: async (input) => {
        const url = String(input);
        const payload = url.endsWith('/receipt')
          ? {
              data: {
                receipt: {
                  ...receiptResponse().data.receipt,
                  artifacts: [copyArtifact],
                },
              },
              meta: { request_id: 'request-review-0004' },
            }
          : url.includes('/artifacts/artifact-copy')
            ? {
                data: {
                  artifact: copyArtifact,
                  access: null,
                  copy: {
                    headline: 'Keep nights simple',
                    primary_text: '200 mg glycinate. Take one capsule.',
                    description: 'Dietary supplement. FDA has not evaluated this statement.',
                  },
                },
                meta: { request_id: 'request-review-0004' },
              }
            : {
                data: {
                  run: {
                    runId: 'run-live',
                    projectId: 'project-live',
                    canvasId: 'canvas-live',
                    canvasRevisionId: 'revision-live',
                    quoteId: 'quote-live',
                    status: 'succeeded',
                    reservationId: 'reservation-live',
                  },
                  nodes: [
                    {
                      runNodeId: 'run-node-copy',
                      nodeKey: 'copy-1',
                      modelRouteId: 'openrouter/moonshot',
                      status: 'succeeded',
                      dispatchWave: 1,
                    },
                  ],
                },
                meta: { request_id: 'request-review-0004' },
              };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerReviewPort(client, 'run-live', 'user-live', () => 'approval-idem-4');
    const read = await port.read();
    expect(read).toMatchObject({
      type: 'ok',
      groups: [
        {
          id: 'copy',
          name: 'Copy system',
          variants: [
            {
              label: 'Copy · Problem-recognition',
              format: 'Copy set',
              nodeKey: 'copy-1',
              copy: {
                headline: 'Keep nights simple',
                primaryText: '200 mg glycinate. Take one capsule.',
                description: 'Dietary supplement. FDA has not evaluated this statement.',
              },
            },
          ],
        },
      ],
      summary: { qaNoteCount: 0, qaFindings: [] },
    });
  });

  it('surfaces client copy QA when primary text exceeds the Meta visible limit', async () => {
    const longPrimary = 'A'.repeat(140);
    const copyArtifact = {
      ...artifact,
      id: 'artifact-copy-long',
      mime_type: 'application/json',
      object_key: 'private/artifact-copy-long.json',
      run_node_id: 'run-node-copy',
    };
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-review-0005',
      fetch: async (input) => {
        const url = String(input);
        const payload = url.endsWith('/receipt')
          ? {
              data: {
                receipt: {
                  ...receiptResponse().data.receipt,
                  artifacts: [copyArtifact],
                },
              },
              meta: { request_id: 'request-review-0005' },
            }
          : url.includes('/artifacts/')
            ? {
                data: {
                  artifact: copyArtifact,
                  access: null,
                  copy: {
                    headline: 'Keep nights simple',
                    primary_text: longPrimary,
                    description: '',
                  },
                },
                meta: { request_id: 'request-review-0005' },
              }
            : {
                data: {
                  run: {
                    runId: 'run-live',
                    projectId: 'project-live',
                    canvasId: 'canvas-live',
                    canvasRevisionId: 'revision-live',
                    quoteId: 'quote-live',
                    status: 'succeeded',
                    reservationId: 'reservation-live',
                  },
                  nodes: [
                    {
                      runNodeId: 'run-node-copy',
                      nodeKey: 'copy-1',
                      modelRouteId: 'openrouter/moonshot',
                      status: 'succeeded',
                      dispatchWave: 1,
                    },
                  ],
                },
                meta: { request_id: 'request-review-0005' },
              };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerReviewPort(client, 'run-live', 'user-live', () => 'approval-idem-5');
    await expect(port.read()).resolves.toMatchObject({
      type: 'ok',
      summary: {
        qaNoteCount: 1,
        qaFindings: [{ code: 'COPY_PRIMARY_TOO_LONG', variantId: 'artifact-copy-long' }],
      },
    });
  });
});

describe('composeReviewConcepts', () => {
  it('pairs copy, master, and placements into three concepts', () => {
    const variant = (
      id: string,
      nodeKey: string,
      extras: Partial<import('./review-port').ReviewVariant> = {},
    ) => ({
      id,
      groupId: 'visuals',
      label: nodeKey,
      format: 'Still',
      model: 'route',
      decision: 'approved' as const,
      accessibilityDescription: 'desc',
      hasPrior: false,
      nodeKey,
      ...extras,
    });
    const concepts = composeReviewConcepts([
      {
        id: 'copy',
        name: 'Copy system',
        reviewer: 'You',
        decision: 'approved',
        revision: 'rev',
        variants: [
          variant('c1', 'copy-1', {
            groupId: 'copy',
            copy: { headline: 'Keep nights simple', primaryText: '200 mg.', description: '' },
          }),
        ],
      },
      {
        id: 'masters',
        name: 'Masters',
        reviewer: 'You',
        decision: 'approved',
        revision: 'rev',
        variants: [variant('m1', 'master-1')],
      },
      {
        id: 'adaptations',
        name: 'Adaptations',
        reviewer: 'You',
        decision: 'approved',
        revision: 'rev',
        variants: [
          variant('a11', 'adaptation-1-1'),
          variant('a12', 'adaptation-1-2'),
          variant('a13', 'adaptation-1-3'),
        ],
      },
    ]);
    expect(concepts).toHaveLength(1);
    expect(concepts[0]).toMatchObject({
      id: 'concept-1',
      angle: 'Problem-recognition',
      title: 'Packshot',
      copy: { headline: 'Keep nights simple' },
      master: { id: 'm1' },
      placements: {
        '4:5': { id: 'a11' },
        '1:1': { id: 'a12' },
        '9:16': { id: 'a13' },
      },
    });
  });
});
