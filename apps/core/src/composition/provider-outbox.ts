import {
  FalQueueDriver,
  MoonshotKimiK26Driver,
  OutboxDispatcher,
  ProviderError,
  ProviderReconciler,
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceLiteDescriptor,
  moonshotKimiK26Descriptor,
  type PendingProviderOutboxEvent,
  type PendingProviderReconciliationJob,
  type ProviderJobStatus,
  type ProviderOutboxPort,
  type ProviderReconciliationPort,
  type ProviderSubmission,
  type ProviderTransport,
  type ProviderTransportRequest,
  type ProviderTransportResponse,
} from '../../../../packages/provider/src/index';

import type { CoreBindings } from '../bindings';

const OUTBOX_LEASE_SECONDS = 90;
const OUTBOX_MAX_ATTEMPTS = 5;
const OUTBOX_RETRY_SECONDS = 30;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw unavailable(`provider outbox RPC result is missing ${field}`);
  }
  return value;
}

function unavailable(message = 'provider outbox persistence is unavailable', cause?: unknown) {
  return new ProviderError(
    'provider_error',
    message,
    true,
    { reason: 'provider_outbox_unavailable' },
    cause === undefined ? undefined : { cause },
  );
}

function misconfigured(): ProviderError {
  return new ProviderError(
    'provider_error',
    'provider outbox persistence rejected the privileged credential',
    false,
    { reason: 'provider_outbox_forbidden' },
  );
}

export function buildProviderAttemptPayload(
  nodeParameters: unknown,
  executionPlanLine: unknown,
): Readonly<Record<string, unknown>> {
  if (!isRecord(nodeParameters) || !isRecord(executionPlanLine)) {
    throw new ProviderError(
      'payload_invalid',
      'run dispatch expansion returned invalid provider input',
      false,
    );
  }
  const payload: Record<string, unknown> = { ...nodeParameters };
  if (payload.duration === undefined && typeof payload.duration_seconds === 'number') {
    payload.duration = payload.duration_seconds;
  }
  return payload;
}

interface PrivilegedRpcOptions {
  readonly bindings: CoreBindings;
  readonly leaseOwner: string;
  readonly fetch?: typeof fetch;
}

export class SupabaseProviderOutboxPort implements ProviderOutboxPort, ProviderReconciliationPort {
  readonly #baseUrl: string | undefined;
  readonly #privilegedKey: string | undefined;
  readonly #leaseOwner: string;
  readonly #fetch: typeof fetch;

  constructor(options: PrivilegedRpcOptions) {
    this.#baseUrl = options.bindings.SUPABASE_URL?.replace(/\/$/u, '');
    this.#privilegedKey =
      options.bindings.SUPABASE_SECRET_KEY ?? options.bindings.SUPABASE_SERVICE_ROLE_KEY;
    this.#leaseOwner = options.leaseOwner;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async #rpc(functionName: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (!this.#baseUrl || !this.#privilegedKey) throw unavailable();
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: this.#privilegedKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw unavailable(undefined, cause);
    }
    if (response.status === 401 || response.status === 403) throw misconfigured();
    if (!response.ok) throw unavailable();
    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw unavailable(undefined, cause);
    }
  }

  async claimPending(limit: number): Promise<readonly PendingProviderOutboxEvent[]> {
    const claimed = await this.#rpc('claim_outbox_events', {
      p_limit: limit,
      p_lease_owner: this.#leaseOwner,
      p_lease_seconds: OUTBOX_LEASE_SECONDS,
    });
    if (!Array.isArray(claimed)) throw unavailable();
    const expanded = await Promise.all(
      claimed.map(async (rawEvent) => {
        if (!isRecord(rawEvent)) throw unavailable();
        const eventId = requiredString(rawEvent.id, 'event id');
        const attempts = await this.#rpc('get_outbox_dispatch_attempts', {
          p_event_id: eventId,
          p_lease_owner: this.#leaseOwner,
        });
        if (!Array.isArray(attempts)) throw unavailable();
        return attempts.map((rawAttempt): PendingProviderOutboxEvent => {
          if (!isRecord(rawAttempt)) throw unavailable();
          const nodeParameters = rawAttempt.node_parameters;
          const executionPlanLine = rawAttempt.execution_plan_line;
          return {
            eventId: requiredString(rawAttempt.event_id, 'event id'),
            workspaceId: requiredString(rawAttempt.workspace_id, 'workspace id'),
            runId: requiredString(rawAttempt.run_id, 'run id'),
            attemptId: requiredString(rawAttempt.attempt_id, 'attempt id'),
            providerRegistrationId: requiredString(
              rawAttempt.provider_registration_id,
              'provider registration id',
            ),
            routeId: requiredString(rawAttempt.route_id, 'route id'),
            billingIdempotencyKey: requiredString(
              rawAttempt.billing_idempotency_key,
              'billing idempotency key',
            ),
            payload: buildProviderAttemptPayload(nodeParameters, executionPlanLine),
            executionPlanLine,
          };
        });
      }),
    );
    return expanded.flat();
  }

  async findSubmissionByBillingKey(
    billingIdempotencyKey: string,
  ): Promise<ProviderSubmission | null> {
    const result = await this.#rpc('find_provider_submission_by_billing_key', {
      p_billing_idempotency_key: billingIdempotencyKey,
    });
    if (result === null) return null;
    if (!isRecord(result)) throw unavailable();
    const provider = requiredString(result.provider, 'provider');
    const state = requiredString(result.state, 'submission state');
    if (
      (provider !== 'fal' && provider !== 'moonshot') ||
      (state !== 'queued' && state !== 'succeeded')
    ) {
      throw unavailable();
    }
    return {
      provider,
      routeId: requiredString(result.route_id, 'route id'),
      providerJobId: requiredString(result.provider_job_id, 'provider job id'),
      state,
    };
  }

  async recordSubmission(
    event: PendingProviderOutboxEvent,
    result: ProviderSubmission,
  ): Promise<void> {
    await this.#rpc('record_provider_submission', {
      p_event_id: event.eventId,
      p_attempt_id: event.attemptId,
      p_route_id: event.routeId,
      p_billing_idempotency_key: event.billingIdempotencyKey,
      p_provider_request_id: result.providerJobId,
      p_status: result.state,
    });
  }

  async recordAmbiguity(event: PendingProviderOutboxEvent, _error: ProviderError): Promise<void> {
    void _error;
    await this.#rpc('record_provider_ambiguity', {
      p_event_id: event.eventId,
      p_attempt_id: event.attemptId,
      p_route_id: event.routeId,
      p_billing_idempotency_key: event.billingIdempotencyKey,
    });
  }

  async markPublished(
    event: PendingProviderOutboxEvent,
    _result: ProviderSubmission | Readonly<{ reconciliationRequired: true }>,
  ): Promise<void> {
    void _result;
    await this.#rpc('publish_outbox_event', { p_event_id: event.eventId });
  }

  async listPending(limit: number): Promise<readonly PendingProviderReconciliationJob[]> {
    const result = await this.#rpc('list_provider_jobs_for_reconciliation', {
      p_limit: limit,
    });
    if (!Array.isArray(result)) throw unavailable();
    return result.map((raw): PendingProviderReconciliationJob => {
      if (!isRecord(raw)) throw unavailable();
      const provider = requiredString(raw.provider, 'provider');
      const status = requiredString(raw.status, 'provider job status');
      if (
        (provider !== 'fal' && provider !== 'moonshot') ||
        (status !== 'submitted' && status !== 'unknown')
      ) {
        throw unavailable();
      }
      return {
        providerJobId: requiredString(raw.provider_job_id, 'provider job id'),
        provider,
        routeId: requiredString(raw.route_id, 'route id'),
        providerRequestId: requiredString(raw.provider_request_id, 'provider request id'),
        status,
      };
    });
  }

  async recordStatus(
    job: PendingProviderReconciliationJob,
    status: ProviderJobStatus,
  ): Promise<void> {
    await this.#rpc('record_provider_job_reconciliation', {
      p_provider_job_id: job.providerJobId,
      p_status: status.state,
      p_evidence: {
        reconciled_state: status.state,
        ...(status.state === 'succeeded' ? { delivery_available: true } : {}),
        ...(status.state === 'failed' ? { provider_error_code: status.error.code } : {}),
      },
    });
  }

  recordFailure(event: PendingProviderOutboxEvent, error: ProviderError): Promise<void>;
  recordFailure(job: PendingProviderReconciliationJob, error: ProviderError): Promise<void>;
  async recordFailure(
    subject: PendingProviderOutboxEvent | PendingProviderReconciliationJob,
    error: ProviderError,
  ): Promise<void> {
    if ('eventId' in subject) {
      await this.#rpc('fail_outbox_event', {
        p_event_id: subject.eventId,
        p_retry_after_seconds: error.retryable ? OUTBOX_RETRY_SECONDS : 0,
        p_max_attempts: error.retryable ? OUTBOX_MAX_ATTEMPTS : 1,
      });
      return;
    }
    await this.#rpc('record_provider_job_reconciliation', {
      p_provider_job_id: subject.providerJobId,
      p_status: 'unknown',
      p_evidence: {
        reconciliation_error_code: error.code,
        reconciliation_retryable: error.retryable,
      },
    });
  }
}

export class FetchProviderTransport implements ProviderTransport {
  readonly #fetch: typeof fetch;

  constructor(fetchImplementation?: typeof fetch) {
    this.#fetch = fetchImplementation ?? ((input, init) => fetch(input, init));
  }

  async request(request: ProviderTransportRequest): Promise<ProviderTransportResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await this.#fetch(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        signal: controller.signal,
      });
      return {
        status: response.status,
        headers: Object.fromEntries(
          [...response.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]),
        ),
        body: await response.text(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface ProviderScheduledLifecycle {
  dispatchPending(limit: number): ReturnType<OutboxDispatcher['dispatchPending']>;
  reconcilePending(limit: number): ReturnType<ProviderReconciler['reconcilePending']>;
}

export function createProviderScheduledLifecycle(
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): ProviderScheduledLifecycle | null {
  if (bindings.PROVIDER_RUNS_ENABLED !== 'true') return null;
  const transport = new FetchProviderTransport(fetchImplementation);
  const drivers = [
    new MoonshotKimiK26Driver(moonshotKimiK26Descriptor, transport, bindings.MOONSHOT_API_KEY),
    new FalQueueDriver(
      falFlux2ProDescriptor,
      transport,
      bindings.FAL_KEY,
      bindings.FAL_WEBHOOK_URL,
    ),
    new FalQueueDriver(
      falFluxKontextProDescriptor,
      transport,
      bindings.FAL_KEY,
      bindings.FAL_WEBHOOK_URL,
    ),
    new FalQueueDriver(
      falSeedanceLiteDescriptor,
      transport,
      bindings.FAL_KEY,
      bindings.FAL_WEBHOOK_URL,
    ),
  ];
  const port = new SupabaseProviderOutboxPort({
    bindings,
    leaseOwner: `core-scheduled:${crypto.randomUUID()}`,
    ...(fetchImplementation === undefined ? {} : { fetch: fetchImplementation }),
  });
  const dispatcher = new OutboxDispatcher(drivers, port);
  const reconciler = new ProviderReconciler(drivers, port);
  return {
    dispatchPending: (limit) => dispatcher.dispatchPending(limit),
    reconcilePending: (limit) => reconciler.reconcilePending(limit),
  };
}

export async function runProviderScheduled(
  bindings: CoreBindings,
  lifecycle = createProviderScheduledLifecycle(bindings),
): Promise<
  | Readonly<{ status: 'disabled' }>
  | Readonly<{
      status: 'ok';
      dispatch: Awaited<ReturnType<ProviderScheduledLifecycle['dispatchPending']>>;
      reconciliation: Awaited<ReturnType<ProviderScheduledLifecycle['reconcilePending']>>;
    }>
> {
  if (lifecycle === null) return { status: 'disabled' };
  const dispatch = await lifecycle.dispatchPending(10);
  const reconciliation = await lifecycle.reconcilePending(25);
  return { status: 'ok', dispatch, reconciliation };
}
