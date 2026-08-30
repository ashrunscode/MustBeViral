import { describe, expect, it, vi } from 'vitest';

import type { DatabaseRow, DatabaseTableName } from '../../../../packages/db/src/index';
import type { CoreBindings } from '../../src/bindings';
import {
  composeReceiptProviderJobs,
  createSupabaseRequestDependencies,
} from '../../src/composition/supabase';

function databaseRow<Table extends DatabaseTableName>(
  _table: Table,
  value: Readonly<Record<string, unknown>>,
): DatabaseRow<Table> {
  return value as unknown as DatabaseRow<Table>;
}

describe('receipt provider-job lineage composition', () => {
  it('orders attempts deterministically and derives exact capture strings only from ledger facts', () => {
    const attempts = [
      databaseRow('attempts', {
        id: 'attempt-b',
        run_node_id: 'node-b',
        provider_registration_id: 'provider-fal',
        attempt_number: 2,
      }),
      databaseRow('attempts', {
        id: 'attempt-a',
        run_node_id: 'node-a',
        provider_registration_id: 'provider-openrouter',
        attempt_number: 1,
      }),
      databaseRow('attempts', {
        id: 'attempt-c',
        run_node_id: 'node-c',
        provider_registration_id: 'provider-fal',
        attempt_number: 3,
      }),
    ];
    const providerJobs = [
      databaseRow('provider_jobs', {
        id: 'job-c',
        attempt_id: 'attempt-c',
        provider_registration_id: 'provider-fal',
        status: 'failed',
        provider_request_id: 'must-not-project-c',
        normalized_evidence: {
          msg: 'raw provider message',
          url: 'https://signed.example.test/private?token=secret',
        },
      }),
      databaseRow('provider_jobs', {
        id: 'job-a',
        attempt_id: 'attempt-a',
        provider_registration_id: 'provider-openrouter',
        status: 'succeeded',
        provider_request_id: 'must-not-project-a',
        normalized_evidence: { object_key: 'private/customer/object' },
      }),
      databaseRow('provider_jobs', {
        id: 'job-b',
        attempt_id: 'attempt-b',
        provider_registration_id: 'provider-fal',
        status: 'running',
        provider_request_id: 'must-not-project-b',
        normalized_evidence: {},
      }),
    ];
    const runNodes = [
      databaseRow('run_nodes', { id: 'node-c', model_route_id: 'route-motion' }),
      databaseRow('run_nodes', { id: 'node-a', model_route_id: 'route-copy' }),
      databaseRow('run_nodes', { id: 'node-b', model_route_id: 'route-image' }),
    ];
    const providerRegistrations = [
      databaseRow('provider_registrations', {
        id: 'provider-fal',
        provider_key: 'fal',
        evidence_ref: 'must-not-project-provider-evidence',
      }),
      databaseRow('provider_registrations', {
        id: 'provider-openrouter',
        provider_key: 'openrouter',
        evidence_ref: 'must-not-project-provider-evidence',
      }),
    ];
    const modelRoutes = [
      databaseRow('model_routes', {
        id: 'route-image',
        provider_registration_id: 'provider-fal',
        provider_model_id: 'fal-ai/flux-pro',
        route_key: 'fal/flux-pro',
      }),
      databaseRow('model_routes', {
        id: 'route-copy',
        provider_registration_id: 'provider-openrouter',
        provider_model_id: 'moonshotai/kimi-k2',
        route_key: 'openrouter/kimi-copy',
      }),
      databaseRow('model_routes', {
        id: 'route-motion',
        provider_registration_id: 'provider-fal',
        provider_model_id: 'fal-ai/seedance',
        route_key: 'fal/seedance-motion',
      }),
    ];
    const captureLedger = [
      databaseRow('ledger_transactions', {
        id: 'ledger-credit-a',
        transaction_id: 'capture-a',
        entry_type: 'capture',
        account_code: 'usage_expense',
        direction: 'credit',
        amount_micros: 150_000,
        metadata: { attempt_id: 'attempt-a' },
      }),
      databaseRow('ledger_transactions', {
        id: 'ledger-debit-c',
        transaction_id: 'capture-c',
        entry_type: 'capture',
        account_code: 'wallet_reserved',
        direction: 'debit',
        amount_micros: 800_000,
        metadata: {
          attempt_id: 'attempt-c',
          provider_request_id: 'must-not-project-ledger-request',
          url: 'https://signed.example.test/ledger?token=secret',
        },
      }),
      databaseRow('ledger_transactions', {
        id: 'ledger-debit-a',
        transaction_id: 'capture-a',
        entry_type: 'capture',
        account_code: 'wallet_reserved',
        direction: 'debit',
        amount_micros: 150_000,
        metadata: { attempt_id: 'attempt-a', object_key: 'private/customer/object' },
      }),
    ];

    const result = composeReceiptProviderJobs({
      attempts,
      providerJobs,
      runNodes,
      providerRegistrations,
      modelRoutes,
      captureLedger,
    });

    expect(result).toEqual([
      {
        attempt_id: 'attempt-a',
        provider: 'openrouter',
        provider_model_id: 'moonshotai/kimi-k2',
        route_id: 'openrouter/kimi-copy',
        status: 'succeeded',
        captured_micros: '150000',
      },
      {
        attempt_id: 'attempt-b',
        provider: 'fal',
        provider_model_id: 'fal-ai/flux-pro',
        route_id: 'fal/flux-pro',
        status: 'running',
        captured_micros: '0',
      },
      {
        attempt_id: 'attempt-c',
        provider: 'fal',
        provider_model_id: 'fal-ai/seedance',
        route_id: 'fal/seedance-motion',
        status: 'failed',
        captured_micros: '800000',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /provider_request|normalized_evidence|raw provider|signed\.example|token=|object_key|private\/customer/iu,
    );
  });

  it('composes GET receipt from the existing tenant-scoped tables without projecting raw rows', async () => {
    const workspaceId = '10000000-0000-4000-8000-000000000001';
    const runId = '10000000-0000-4000-8000-000000000002';
    const attemptId = '10000000-0000-4000-8000-000000000003';
    const nodeId = '10000000-0000-4000-8000-000000000004';
    const registrationId = '10000000-0000-4000-8000-000000000005';
    const routeId = '10000000-0000-4000-8000-000000000006';
    const timestamp = '2026-08-29T00:00:00.000Z';
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/runs?')) {
        return Response.json({
          id: runId,
          workspace_id: workspaceId,
          project_id: '10000000-0000-4000-8000-000000000007',
          canvas_id: '10000000-0000-4000-8000-000000000008',
          canvas_revision_id: '10000000-0000-4000-8000-000000000009',
          canvas_revision_hash: 'a'.repeat(64),
          quote_id: '10000000-0000-4000-8000-000000000010',
          status: 'succeeded',
          dispatch_wave: 1,
          confirmed_by: '10000000-0000-4000-8000-000000000011',
          confirmed_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
      if (url.includes('/cost_reservations?')) {
        return Response.json({
          id: '10000000-0000-4000-8000-000000000012',
          workspace_id: workspaceId,
          quote_id: '10000000-0000-4000-8000-000000000010',
          run_id: runId,
          amount_micros: 150_000,
          captured_micros: 150_000,
          released_micros: 0,
          refunded_micros: 0,
          status: 'captured',
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
      if (url.includes('/artifacts?')) {
        return Response.json([
          {
            id: '10000000-0000-4000-8000-000000000017',
            workspace_id: workspaceId,
            project_id: '10000000-0000-4000-8000-000000000007',
            run_id: runId,
            run_node_id: nodeId,
            canvas_revision_id: '10000000-0000-4000-8000-000000000009',
            artifact_kind: 'approved_output',
            status: 'available',
            object_key: 'private/customer/object',
            content_hash: 'b'.repeat(64),
            mime_type: 'image/png',
            byte_size: 24,
            rights_attestation: { evidence: 'raw customer/provider payload' },
            accessibility_description: 'Buyer-safe product still.',
            approved_by: '10000000-0000-4000-8000-000000000011',
            approved_at: timestamp,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ]);
      }
      if (url.includes('/artifact_lineage?')) {
        return Response.json([
          {
            id: '10000000-0000-4000-8000-000000000018',
            workspace_id: workspaceId,
            parent_artifact_id: '10000000-0000-4000-8000-000000000019',
            child_artifact_id: '10000000-0000-4000-8000-000000000017',
            relationship: 'input_to_output',
            created_at: timestamp,
          },
        ]);
      }
      if (url.includes('/attempts?')) {
        return Response.json([
          {
            id: attemptId,
            run_node_id: nodeId,
            provider_registration_id: registrationId,
            attempt_number: 1,
          },
        ]);
      }
      if (url.includes('/provider_jobs?')) {
        return Response.json([
          {
            id: '10000000-0000-4000-8000-000000000013',
            attempt_id: attemptId,
            provider_registration_id: registrationId,
            status: 'succeeded',
            provider_request_id: 'private-provider-request',
            normalized_evidence: { msg: 'raw provider message' },
          },
        ]);
      }
      if (url.includes('/run_nodes?')) {
        return Response.json([{ id: nodeId, model_route_id: routeId }]);
      }
      if (url.includes('/provider_registrations?')) {
        return Response.json([
          {
            id: registrationId,
            provider_key: 'openrouter',
            evidence_ref: 'private/provider/evidence',
          },
        ]);
      }
      if (url.includes('/model_routes?')) {
        return Response.json([
          {
            id: routeId,
            provider_registration_id: registrationId,
            provider_model_id: 'moonshotai/kimi-k2',
            route_key: 'openrouter/kimi-copy',
          },
        ]);
      }
      if (url.includes('/ledger_transactions?')) {
        if (!url.includes('entry_type=eq.capture')) {
          return Response.json([
            {
              id: '10000000-0000-4000-8000-000000000020',
              workspace_id: workspaceId,
              transaction_id: '10000000-0000-4000-8000-000000000021',
              reservation_id: '10000000-0000-4000-8000-000000000012',
              run_id: runId,
              entry_type: 'capture',
              account_code: 'wallet_reserved',
              direction: 'debit',
              amount_micros: 150_000,
              causative_key: 'private-causative-key',
              metadata: { provider_request_id: 'private-provider-request' },
              created_at: timestamp,
            },
          ]);
        }
        return Response.json([
          {
            id: '10000000-0000-4000-8000-000000000014',
            transaction_id: '10000000-0000-4000-8000-000000000015',
            entry_type: 'capture',
            account_code: 'wallet_reserved',
            direction: 'debit',
            amount_micros: 150_000,
            metadata: {
              attempt_id: attemptId,
              provider_request_id: 'private-provider-request',
              object_key: 'private/customer/object',
            },
          },
        ]);
      }
      throw new Error(`Unexpected receipt fixture request: ${url}`);
    });
    const dependencies = createSupabaseRequestDependencies(
      {
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'public-fixture-key',
        CONFIRMATION_SIGNING_KEY: 'receipt-fixture-signing-key-32-characters',
      } as unknown as CoreBindings,
      'verified-caller-jwt',
      {
        actorId: '10000000-0000-4000-8000-000000000016',
        authenticationMethod: 'supabase_jwt',
      },
      fetchImplementation,
    );
    if (dependencies === null) throw new Error('Receipt dependencies were unavailable');

    const result = await dependencies.handlers.get_receipt({
      context: {
        workspace_id: workspaceId,
        actor_id: '10000000-0000-4000-8000-000000000016',
        request_id: 'request-receipt-lineage',
      },
      run_id: runId,
    });

    expect(result).toMatchObject({
      status: 'ok',
      receipt: {
        artifacts: [
          {
            id: '10000000-0000-4000-8000-000000000017',
            artifact_kind: 'approved_output',
            content_hash: 'b'.repeat(64),
            mime_type: 'image/png',
            byte_size: 24,
          },
        ],
        ledger: [
          {
            id: '10000000-0000-4000-8000-000000000020',
            amount_micros: 150_000,
          },
        ],
        provider_jobs: [
          {
            attempt_id: attemptId,
            provider: 'openrouter',
            provider_model_id: 'moonshotai/kimi-k2',
            route_id: 'openrouter/kimi-copy',
            status: 'succeeded',
            captured_micros: '150000',
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private-provider-request|normalized_evidence|raw provider|object_key|private\/customer|rights_attestation|raw customer|causative_key|private-causative/iu,
    );
    const requestedTables = fetchImplementation.mock.calls.map(([request]) => String(request));
    for (const table of [
      'attempts',
      'provider_jobs',
      'run_nodes',
      'provider_registrations',
      'model_routes',
      'ledger_transactions',
    ]) {
      expect(requestedTables.some((url) => url.includes(`/rest/v1/${table}?`))).toBe(true);
    }
  });
});
