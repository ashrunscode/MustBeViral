import { describe, expect, it } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { InMemoryReviewPort, WorkerReviewPort } from './review-port';

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
          : {
              data: {
                run_id: 'run-live',
                approved: 1,
                replayed: 0,
                artifacts: [{ artifact_id: 'artifact-live', artifact_kind: 'approved_output' }],
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
      groups: [{ id: 'visuals', revision: 'revision-live' }],
      summary: { quotedMicros: 4_550_000n, capturedMicros: 672_574n },
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
});
