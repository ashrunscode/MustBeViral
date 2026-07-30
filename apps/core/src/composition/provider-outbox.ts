import {
  FalQueueDriver,
  OpenRouterCopyDriver,
  OutboxDispatcher,
  ProviderError,
  ProviderReconciler,
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceProFastDescriptor,
  openRouterCopyDescriptor,
  type PendingProviderOutboxEvent,
  type PendingProviderReconciliationJob,
  type ProviderJobStatus,
  type ProviderOutboxPort,
  type ProviderReconciliationPort,
  type ProviderSubmission,
  type SettleableProvider,
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

/**
 * Providers whose submissions this consumer can account for. Adding a driver without adding it
 * here would let a real, paid submission be rejected as unreadable on the way back - which is how
 * the Moonshot-to-OpenRouter swap first went unnoticed on the return path.
 */
const SETTLEABLE_PROVIDERS = ['fal', 'openrouter', 'moonshot'] as const;

function isSettleableProvider(value: string): value is SettleableProvider {
  return SETTLEABLE_PROVIDERS.some((candidate) => candidate === value);
}

/** Resolves a route key to the descriptor task that decides its payload shape. */
function taskForRoute(routeId: string): string | undefined {
  for (const descriptor of [
    openRouterCopyDescriptor,
    falFlux2ProDescriptor,
    falFluxKontextProDescriptor,
    falSeedanceProFastDescriptor,
  ]) {
    if (descriptor.routeId === routeId) return descriptor.capabilities.tasks[0];
  }
  return undefined;
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

/**
 * Raised when a node's inputs exist only after an upstream node produces an artifact.
 *
 * Retryable on purpose. Adaptations and motion clips are image-to-image and image-to-video: they
 * need `image_url` from the master they derive from, which does not exist while that master is
 * still generating. The dispatch expansion returns every attempt of a run at once with no
 * readiness ordering, so the only honest answer at this point is "not yet" rather than a request
 * built from a placeholder.
 */
function upstreamArtifactPending(nodeKey: string, dependsOn: string): ProviderError {
  return new ProviderError(
    'provider_error',
    `attempt for ${nodeKey} needs the artifact from ${dependsOn}, which has not been produced yet`,
    true,
    { reason: 'upstream_artifact_pending', nodeKey, dependsOn },
  );
}

/** Joins the brief fragments a node carries into one prompt, dropping absent ones. */
function composePrompt(parts: readonly unknown[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join('\n\n');
}

/**
 * Translates a pinned graph node into a provider-shaped request.
 *
 * This is the seam the drivers were always written against and nothing filled: node parameters are
 * semantic brief fragments (`product`, `packshots`, `stress_vector`), while every driver validates
 * a provider request (`prompt`, or `{task, messages}`). The previous implementation spread the
 * parameters through unchanged, so the first graph-driven dispatch of any route failed
 * `payload_invalid` - non-retryable, which killed the whole run event on its first attempt.
 *
 * Keyed off the descriptor's task rather than the route key so a model repoint cannot silently
 * change which payload shape is built.
 */
export function buildProviderAttemptPayload(
  nodeParameters: unknown,
  executionPlanLine: unknown,
  task?: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(nodeParameters) || !isRecord(executionPlanLine)) {
    throw new ProviderError(
      'payload_invalid',
      'run dispatch expansion returned invalid provider input',
      false,
    );
  }
  // Prefer the plan line's node_id: it names the actual node ("copy-1"), which is what an operator
  // needs to locate a failure. asset_role only says which kind of node it was.
  const nodeKey =
    typeof executionPlanLine.node_id === 'string' && executionPlanLine.node_id.length > 0
      ? executionPlanLine.node_id
      : typeof nodeParameters.asset_role === 'string'
        ? nodeParameters.asset_role
        : 'node';

  if (task === 'copy') {
    const brief = composePrompt([
      nodeParameters.product,
      nodeParameters.offer,
      nodeParameters.price_presentation,
      nodeParameters.urgency,
      nodeParameters.approved_facts,
      nodeParameters.required_claims_legal,
      nodeParameters.prohibited_claims,
      nodeParameters.stress_vector,
    ]);
    if (brief.length === 0) {
      throw new ProviderError('payload_invalid', `copy node ${nodeKey} carries no brief`, false);
    }
    return {
      task: 'copy',
      messages: [
        {
          role: 'system',
          content: [
            'You are a senior direct-response copywriter producing ad copy for paid social.',
            'Use ONLY facts supplied in the brief. Never invent prices, rates, ratings, guarantees, or amenities.',
            'Reproduce any price verbatim, attached to the correct service, with every condition the brief ties to it.',
            'Honour every prohibited claim and banned tone. The prohibited list is a hard constraint.',
          ].join('\n'),
        },
        { role: 'user', content: `Campaign brief:\n\n${brief}` },
      ],
      maxTokens: 2000,
    };
  }

  if (task === 'master_static') {
    const prompt = composePrompt([
      nodeParameters.product,
      nodeParameters.packshots,
      nodeParameters.creative_constraints_rights,
    ]);
    if (prompt.length === 0) {
      throw new ProviderError(
        'payload_invalid',
        `master node ${nodeKey} carries no prompt material`,
        false,
      );
    }
    return { prompt };
  }

  if (task === 'adaptation' || task === 'reframe') {
    const master = typeof nodeParameters.master === 'string' ? nodeParameters.master : 'its master';
    throw upstreamArtifactPending(nodeKey, master);
  }

  if (task === 'image_to_video' || task === 'motion_clip_9_16') {
    const master = typeof nodeParameters.master === 'string' ? nodeParameters.master : 'its master';
    throw upstreamArtifactPending(nodeKey, master);
  }

  throw new ProviderError('payload_invalid', `no payload adapter for task ${String(task)}`, false);
}

/**
 * Wraps payload construction so a per-attempt problem travels with that attempt instead of
 * throwing out of the whole claim. `buildProviderAttemptPayload` stays throwing because it is the
 * unit under test and callers elsewhere want the error; only the expansion needs it captured.
 */
function buildAttemptRequest(
  nodeParameters: unknown,
  executionPlanLine: unknown,
  task: string | undefined,
): Readonly<{ payload: unknown; payloadError?: ProviderError }> {
  try {
    return { payload: buildProviderAttemptPayload(nodeParameters, executionPlanLine, task) };
  } catch (cause) {
    return {
      payload: null,
      payloadError:
        cause instanceof ProviderError
          ? cause
          : new ProviderError(
              'payload_invalid',
              'provider payload could not be built',
              false,
              {},
              {
                cause,
              },
            ),
    };
  }
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
            // Never throws here. A run event covers every attempt of the run, so one unbuildable
            // node must not abort the claim and strand the attempts that are ready to submit.
            ...buildAttemptRequest(
              nodeParameters,
              executionPlanLine,
              taskForRoute(requiredString(rawAttempt.route_id, 'route id')),
            ),
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
    if (!isSettleableProvider(provider) || (state !== 'queued' && state !== 'succeeded')) {
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
    // Always 'queued', never the driver's state. Submission records intent; only the advance_*
    // functions may record success, and only once the artifact and the ledger capture exist. A
    // synchronous driver such as OpenRouter returns state 'succeeded' from submit, and forwarding
    // that used to mark the attempt succeeded with no artifact and no capture - which broke the
    // outcomes envelope and 503-looped every later fal webhook in the same run.
    await this.#rpc('record_provider_submission', {
      p_event_id: event.eventId,
      p_attempt_id: event.attemptId,
      p_route_id: event.routeId,
      p_billing_idempotency_key: event.billingIdempotencyKey,
      p_provider_request_id: result.providerJobId,
      p_status: 'queued',
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

  /**
   * Terminalizes runs whose dispatch event died with attempts still at 'created'. Without this,
   * such a run holds its full reservation forever: nothing dispatches the attempts, so the
   * terminal predicate never fires and the remainder is never released. Two live reservations
   * were stranded exactly this way before the reaper existed.
   */
  async reapDeadDispatch(limit: number): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.#rpc('reap_dead_dispatch', { p_limit: limit });
    if (!isRecord(result)) throw unavailable();
    return result;
  }

  /**
   * Terminalizes runs parked at cancel_requested once their in-flight attempts drain. The
   * attempt-advance tail deliberately never overwrites a cancelling run, so without this sweep a
   * cancel issued while work was with the provider would hold its reservation forever.
   */
  async finalizeCancelRequested(limit: number): Promise<Readonly<Record<string, unknown>>> {
    const result = await this.#rpc('finalize_cancel_requested_runs', { p_limit: limit });
    if (!isRecord(result)) throw unavailable();
    return result;
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
      if (!isSettleableProvider(provider) || (status !== 'submitted' && status !== 'unknown')) {
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
  reapDeadDispatch(limit: number): Promise<Readonly<Record<string, unknown>>>;
  finalizeCancelRequested(limit: number): Promise<Readonly<Record<string, unknown>>>;
}

export function createProviderScheduledLifecycle(
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): ProviderScheduledLifecycle | null {
  if (bindings.PROVIDER_RUNS_ENABLED !== 'true') return null;
  const transport = new FetchProviderTransport(fetchImplementation);
  const drivers = [
    // Copy routes through the OpenRouter gateway, retiring the Moonshot direct route: retention is
    // enforced programmatically per request (ZDR plus a provider allowlist) instead of resting on a
    // DPA negotiation. The descriptor's gates are still closed, so composing it here does not make
    // it dispatchable - the driver also refuses at submit time when the credential is absent.
    new OpenRouterCopyDriver(openRouterCopyDescriptor, transport, bindings.OPENROUTER_API_KEY),
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
      falSeedanceProFastDescriptor,
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
    reapDeadDispatch: (limit) => port.reapDeadDispatch(limit),
    finalizeCancelRequested: (limit) => port.finalizeCancelRequested(limit),
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
      reaped: Readonly<Record<string, unknown>>;
      finalized: Readonly<Record<string, unknown>>;
    }>
> {
  if (lifecycle === null) return { status: 'disabled' };
  const dispatch = await lifecycle.dispatchPending(10);
  const reconciliation = await lifecycle.reconcilePending(25);
  // After dispatch and reconciliation, so a run is only reaped once nothing this cycle could still
  // move it forward.
  const reaped = await lifecycle.reapDeadDispatch(10);
  const finalized = await lifecycle.finalizeCancelRequested(10);
  return { status: 'ok', dispatch, reconciliation, reaped, finalized };
}
