import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OutboxDispatcher,
  ProviderError,
  falFlux2ProDescriptor,
  type PendingProviderOutboxEvent,
  type ProviderSubmission,
  type VersionedProviderDriver,
} from '../../../../packages/provider/src/index';
import type { CoreBindings } from '../../src/bindings';
import {
  SupabaseProviderOutboxPort,
  runProviderScheduled,
} from '../../src/composition/provider-outbox';

const privilegedBindingName = ['SUPABASE', 'SECRET', 'KEY'].join('_');
const bindings = {
  SUPABASE_URL: 'https://project.supabase.co',
  [privilegedBindingName]: 'fixture-privileged-key',
} as unknown as CoreBindings;

function rpcName(input: Parameters<typeof fetch>[0]): string {
  return String(input).split('/').at(-1) ?? '';
}

function expandedAttempt(index: number) {
  const suffix = String(index).padStart(2, '0');
  return {
    event_id: 'event-1',
    workspace_id: 'workspace-1',
    run_id: 'run-1',
    attempt_id: `attempt-${suffix}`,
    provider_registration_id: 'provider-registration-1',
    route_id: falFlux2ProDescriptor.routeId,
    billing_idempotency_key: `run-1:master-${suffix}:1`,
    // Shaped like a real pinned graph node, which carries semantic brief fragments and no prompt.
    // This fixture previously supplied `prompt` directly, which encoded the passthrough assumption
    // and is why the missing payload adapter went unnoticed until a live run failed on it.
    node_parameters: {
      asset_role: 'master_static',
      master: index,
      product: `Fixture product ${suffix}`,
      packshots: `Fixture packshot direction ${suffix}`,
      creative_constraints_rights: 'Fixture rights constraint',
    },
    execution_plan_line: {
      ready: true,
      node_id: `master-${suffix}`,
      model_route_id: falFlux2ProDescriptor.routeId,
    },
  };
}

const pendingEvent: PendingProviderOutboxEvent = {
  eventId: 'event-1',
  workspaceId: 'workspace-1',
  runId: 'run-1',
  attemptId: 'attempt-01',
  providerRegistrationId: 'provider-registration-1',
  routeId: falFlux2ProDescriptor.routeId,
  billingIdempotencyKey: 'run-1:master-01:1',
  payload: { prompt: 'Fixture master 01.' },
  executionPlanLine: { node_id: 'master-01' },
};

describe('provider outbox composition', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('real network access is forbidden in provider outbox tests');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('expands one run event into 13 stable per-attempt billing keys', async () => {
    const attempts = Array.from({ length: 13 }, (_, index) => expandedAttempt(index + 1));
    const fetchImplementation = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(new Headers(init?.headers).get('apikey')).toBe('fixture-privileged-key');
        const name = rpcName(input);
        if (name === 'claim_outbox_events') {
          return Response.json([
            {
              id: 'event-1',
              event_type: 'run.dispatch_requested',
              aggregate_id: 'run-1',
            },
          ]);
        }
        if (name === 'get_outbox_dispatch_attempts') return Response.json(attempts);
        throw new Error(`Unexpected RPC ${name}`);
      },
    );
    const port = new SupabaseProviderOutboxPort({
      bindings,
      leaseOwner: 'fixture-lease-owner',
      fetch: fetchImplementation,
    });

    const expanded = await port.claimPending(10);

    expect(expanded).toHaveLength(13);
    expect(expanded.map((event) => event.billingIdempotencyKey)).toEqual(
      attempts.map((attempt) => attempt.billing_idempotency_key),
    );
    // The adapter must compose a provider prompt from the node's brief fragments, not pass them
    // through: fal validates a non-empty `prompt` and would reject the raw parameters.
    expect(expanded[0]?.executionPlanLine).toMatchObject({ node_id: 'master-01' });
    const firstPayload = expanded[0]?.payload as { prompt?: unknown };
    expect(typeof firstPayload.prompt).toBe('string');
    expect(firstPayload.prompt).toContain('Fixture packshot direction 01');
    expect(firstPayload.prompt).toContain('Fixture rights constraint');
    expect(firstPayload).not.toHaveProperty('asset_role');
  });

  it('persists ambiguous submission as unknown without another provider call', async () => {
    const requests: Readonly<{ name: string; body: unknown }>[] = [];
    const mutableRequests = requests as { name: string; body: unknown }[];
    const fetchImplementation = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        mutableRequests.push({
          name: rpcName(input),
          body: JSON.parse(String(init?.body)) as unknown,
        });
        return Response.json({ status: 'unknown' });
      },
    );
    const port = new SupabaseProviderOutboxPort({
      bindings,
      leaseOwner: 'fixture-lease-owner',
      fetch: fetchImplementation,
    });

    await port.recordAmbiguity(
      pendingEvent,
      new ProviderError('ambiguous_submit', 'fixture acceptance unknown', false),
    );

    expect(requests).toEqual([
      {
        name: 'record_provider_ambiguity',
        body: {
          p_event_id: 'event-1',
          p_attempt_id: 'attempt-01',
          p_route_id: falFlux2ProDescriptor.routeId,
          p_billing_idempotency_key: 'run-1:master-01:1',
        },
      },
    ]);
  });

  it('drains once across overlapping scheduled invocations', async () => {
    let claimed = false;
    const fetchImplementation = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const name = rpcName(input);
      if (name === 'claim_outbox_events') {
        if (claimed) return Response.json([]);
        claimed = true;
        return Response.json([{ id: 'event-1' }]);
      }
      if (name === 'get_outbox_dispatch_attempts') {
        return Response.json([expandedAttempt(1)]);
      }
      if (name === 'find_provider_submission_by_billing_key') return Response.json(null);
      if (name === 'record_provider_submission') return Response.json({ status: 'submitted' });
      if (name === 'publish_outbox_event') return Response.json({ published: true });
      throw new Error(`Unexpected RPC ${name}`);
    });
    const port = new SupabaseProviderOutboxPort({
      bindings,
      leaseOwner: 'overlap-owner',
      fetch: fetchImplementation,
    });
    const submit = vi.fn<() => Promise<ProviderSubmission>>().mockResolvedValue({
      provider: 'fal',
      routeId: falFlux2ProDescriptor.routeId,
      providerJobId: 'fal-job-1',
      state: 'queued',
    });
    const driver: VersionedProviderDriver = {
      descriptor: {
        ...falFlux2ProDescriptor,
        enableGates: { priceConfirmed: true, retentionCleared: true },
      },
      submit,
    };
    const dispatcher = new OutboxDispatcher([driver], port);
    const lifecycle = {
      dispatchPending: (limit: number) => dispatcher.dispatchPending(limit),
      reconcilePending: async () => ({ checked: 0, updated: 0, failed: 0 }),
      reapDeadDispatch: async () => ({ runs_examined: 0 }),
      finalizeCancelRequested: async () => ({ examined: 0, finalized: 0 }),
      reapStrandedSynchronousJobs: async () => ({ examined: 0, settled: 0, failed: 0 }),
    };

    const [first, second] = await Promise.all([
      runProviderScheduled({} as CoreBindings, lifecycle),
      runProviderScheduled({} as CoreBindings, lifecycle),
    ]);

    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    expect(submit).toHaveBeenCalledOnce();
    expect(
      fetchImplementation.mock.calls.filter(([input]) => rpcName(input) === 'publish_outbox_event'),
    ).toHaveLength(1);
  });

  it('maps a rejected privileged key to a non-retryable deployment fault', async () => {
    const port = new SupabaseProviderOutboxPort({
      bindings,
      leaseOwner: 'fixture-lease-owner',
      fetch: vi.fn(async () => Response.json({}, { status: 401 })),
    });

    await expect(port.claimPending(1)).rejects.toMatchObject({
      code: 'provider_error',
      retryable: false,
      details: { reason: 'provider_outbox_forbidden' },
    });
  });
});
