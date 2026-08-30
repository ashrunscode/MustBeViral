import { describe, expect, it, vi } from 'vitest';

import { createDatabaseRepositories, type Json } from '../../../../packages/db/src/index';
import {
  createSupabaseHandlerPorts,
  safeRunNodeRecoveryCode,
} from '../../src/composition/supabase';
import { SupabaseDataApiExecutor } from '../../src/data/supabase-data-api';

describe('safe run recovery composition', () => {
  it.each([
    [
      'failed provider policy code',
      'failed',
      { provider_error_code: 'content_policy_violation' },
      'content_policy_violation',
    ],
    [
      'failed timeout code',
      'failed',
      { provider_error_code: 'provider_timeout' },
      'provider_timeout',
    ],
    [
      'failed webhook code',
      'failed',
      { provider_error_code: 'fal_webhook_failed' },
      'fal_webhook_failed',
    ],
    [
      'ambiguous submit wins over a stale terminal code',
      'reconciliation_required',
      {
        provider_error_code: 'content_policy_violation',
        ambiguity: 'submit_acceptance_unknown',
      },
      'ambiguous_submit',
    ],
    [
      'ambiguous submit wins over a stale terminal code even when the node row is failed',
      'failed',
      {
        provider_error_code: 'content_policy_violation',
        ambiguity: 'submit_acceptance_unknown',
      },
      'ambiguous_submit',
    ],
    [
      'bounded reconciliation code',
      'reconciliation_required',
      { reconciliation_error_code: 'provider_timeout' },
      'provider_timeout',
    ],
    [
      'unsafe reconciliation code falls back closed',
      'reconciliation_required',
      {
        reconciliation_error_code: 'https://signed.example.test/object?token=secret',
        msg: 'raw provider payload',
        input: { prompt: 'customer prompt' },
      },
      'reconciliation_required',
    ],
    [
      'raw fields never become a failed-node code',
      'failed',
      {
        msg: 'raw provider payload',
        url: 'https://signed.example.test/object?token=secret',
      },
      undefined,
    ],
  ] as const)('%s', (_name, status, evidence, expected) => {
    const code = safeRunNodeRecoveryCode(evidence as Json, status);
    expect(code).toBe(expected);
    expect(JSON.stringify(code) ?? '').not.toMatch(
      /raw provider|signed\.example|customer prompt|secret/iu,
    );
  });

  it('maps the authoritative reservation to exact bigint micros without a migration', async () => {
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/cost_reservations?')) {
        return Response.json({
          id: '10000000-0000-4000-8000-000000000004',
          workspace_id: '10000000-0000-4000-8000-000000000001',
          quote_id: '10000000-0000-4000-8000-000000000003',
          run_id: '10000000-0000-4000-8000-000000000002',
          amount_micros: 4_550_000,
          captured_micros: 672_574,
          released_micros: 3_000_000,
          refunded_micros: 125_000,
          status: 'partially_captured',
          created_at: '2026-08-29T00:00:00.000Z',
          updated_at: '2026-08-29T00:00:00.000Z',
        });
      }
      throw new Error(`Unexpected recovery fixture request: ${url}`);
    });
    const executor = new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co',
      publishableKey: 'public-fixture-key',
      callerJwt: 'verified-caller-jwt',
      fetch: fetchImplementation,
    });
    const ports = createSupabaseHandlerPorts(executor, createDatabaseRepositories(executor), {
      CONFIRMATION_SIGNING_KEY: 'recovery-fixture-signing-key-32-characters',
    });

    await expect(
      ports.runs.getSettlement(
        {
          workspace_id: '10000000-0000-4000-8000-000000000001',
          actor_id: '10000000-0000-4000-8000-000000000005',
          request_id: 'request-recovery-1',
        },
        '10000000-0000-4000-8000-000000000002',
      ),
    ).resolves.toEqual({
      reservationMicros: 4_550_000n,
      capturedMicros: 672_574n,
      releasedMicros: 3_000_000n,
      refundedMicros: 125_000n,
      pendingMicros: 877_426n,
      settlementStatus: 'partially_captured',
    });
  });

  it('keeps a persisted ambiguous submit safety-first over later provider failures', async () => {
    const workspaceId = '10000000-0000-4000-8000-000000000021';
    const runId = '10000000-0000-4000-8000-000000000022';
    const ambiguousNodeId = '10000000-0000-4000-8000-000000000023';
    const webhookNodeId = '10000000-0000-4000-8000-000000000024';
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/run_nodes?')) {
        return Response.json([
          {
            id: ambiguousNodeId,
            workspace_id: workspaceId,
            run_id: runId,
            node_key: 'master-ambiguous',
            model_route_id: 'route-image',
            status: 'failed',
            dispatch_wave: 1,
            created_at: '2026-08-29T00:00:00.000Z',
            updated_at: '2026-08-29T00:00:00.000Z',
          },
          {
            id: webhookNodeId,
            workspace_id: workspaceId,
            run_id: runId,
            node_key: 'master-webhook',
            model_route_id: 'route-image',
            status: 'failed',
            dispatch_wave: 1,
            created_at: '2026-08-29T00:00:00.000Z',
            updated_at: '2026-08-29T00:00:00.000Z',
          },
        ]);
      }
      if (url.includes('/attempts?')) {
        return Response.json([
          { id: 'attempt-ambiguous', run_node_id: ambiguousNodeId, attempt_number: 1 },
          { id: 'attempt-policy', run_node_id: ambiguousNodeId, attempt_number: 2 },
          { id: 'attempt-webhook', run_node_id: webhookNodeId, attempt_number: 1 },
        ]);
      }
      if (url.includes('/provider_jobs?')) {
        return Response.json([
          {
            attempt_id: 'attempt-policy',
            normalized_evidence: { provider_error_code: 'content_policy_violation' },
          },
          {
            attempt_id: 'attempt-ambiguous',
            normalized_evidence: { ambiguity: 'submit_acceptance_unknown' },
          },
          {
            attempt_id: 'attempt-webhook',
            normalized_evidence: { provider_error_code: 'fal_webhook_failed' },
          },
        ]);
      }
      throw new Error(`Unexpected recovery fixture request: ${url}`);
    });
    const executor = new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co',
      publishableKey: 'public-fixture-key',
      callerJwt: 'verified-caller-jwt',
      fetch: fetchImplementation,
    });
    const ports = createSupabaseHandlerPorts(executor, createDatabaseRepositories(executor), {
      CONFIRMATION_SIGNING_KEY: 'recovery-fixture-signing-key-32-characters',
    });

    await expect(
      ports.runs.listNodes(
        {
          workspace_id: workspaceId,
          actor_id: '10000000-0000-4000-8000-000000000025',
          request_id: 'request-recovery-ambiguous',
        },
        runId,
      ),
    ).resolves.toMatchObject([
      { nodeKey: 'master-ambiguous', providerErrorCode: 'ambiguous_submit' },
      { nodeKey: 'master-webhook', providerErrorCode: 'fal_webhook_failed' },
    ]);
  });
});
