import {
  errorFromHttpStatus,
  parseJsonObject,
  ProviderError,
  ProviderTransportFailure,
  requireCredential,
} from './errors';
import {
  assertRouteEnabled,
  descriptorGateEnablement,
  toTransientDeliveryUrl,
  type DriverDescriptor,
  type ProviderEnablementPort,
  type ProviderJobStatus,
  type ProviderSubmission,
  type ProviderSubmitInput,
  type ProviderTransport,
  type VersionedProviderDriver,
} from './types';

/**
 * A 2026-07-28 live probe measured that restrictive fal `initial_acl` values also block
 * account-authenticated delivery fetches. One hour intentionally leaves recovery headroom for
 * webhook delay plus an ingest failure, provider redelivery, and the five-minute stale-claim
 * reclaim window; 300 seconds could expire a paid output before that recovery completes.
 */
export const FAL_OUTPUT_LIFECYCLE_PREFERENCE = {
  expiration_duration_seconds: 3_600,
} as const;

// Deliberately omit `x-fal-store-io` until a full generation-to-private-R2 round trip proves and
// re-tests whether it suppresses the delivery object required for canonical ingest.
const FAL_OUTPUT_HEADERS = {
  'x-fal-object-lifecycle-preference': JSON.stringify(FAL_OUTPUT_LIFECYCLE_PREFERENCE),
} as const;

function requirePayloadObject(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderError('payload_invalid', 'fal input must be an object', false);
  }
  return value as Readonly<Record<string, unknown>>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProviderError('payload_invalid', `fal ${field} is missing or invalid`, false);
  }
  return value;
}

function validateModelInput(
  descriptor: DriverDescriptor,
  value: unknown,
): Readonly<Record<string, unknown>> {
  const payload = requirePayloadObject(value);
  const task = descriptor.capabilities.tasks[0];
  if (task === 'master_static') {
    requireNonEmptyString(payload.prompt, 'prompt');
  } else if (task === 'adaptation') {
    requireNonEmptyString(payload.prompt, 'prompt');
    requireNonEmptyString(payload.image_url, 'image_url');
  } else if (task === 'image_to_video') {
    requireNonEmptyString(payload.prompt, 'prompt');
    requireNonEmptyString(payload.image_url, 'image_url');
    if (
      typeof payload.duration !== 'number' ||
      !Number.isInteger(payload.duration) ||
      payload.duration < 2 ||
      payload.duration > 12
    ) {
      throw new ProviderError(
        'payload_invalid',
        'fal duration must be an integer from 2 to 12',
        false,
      );
    }
    // Seedance Pro Fast (and siblings) advertise duration as a string enum on the
    // OpenAPI schema; keep number validation above, then coerce for the wire.
    const normalized: Record<string, unknown> = {
      ...payload,
      duration: String(payload.duration),
    };
    // Pin the catalog-priced resolution so a silent 1080p default cannot blow unit cost.
    if (descriptor.price.kind === 'video_second' && normalized.resolution === undefined) {
      normalized.resolution = descriptor.price.resolution;
    }
    return normalized;
  }
  return payload;
}

function findDeliveryUrl(payload: Readonly<Record<string, unknown>>): unknown {
  const direct = payload.url;
  if (direct !== undefined) return direct;
  const video = payload.video;
  if (typeof video === 'object' && video !== null && !Array.isArray(video)) {
    return (video as Readonly<Record<string, unknown>>).url;
  }
  const images = payload.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
      return (first as Readonly<Record<string, unknown>>).url;
    }
  }
  const response = payload.response;
  if (typeof response === 'object' && response !== null && !Array.isArray(response)) {
    return findDeliveryUrl(response as Readonly<Record<string, unknown>>);
  }
  return undefined;
}

function configuredWebhookUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new ProviderError('provider_error', 'fal webhook URL is not configured', false, {
      reason: 'webhook_url_missing',
    });
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProviderError('provider_error', 'fal webhook URL is invalid', false, {
      reason: 'webhook_url_invalid',
    });
  }
  if (parsed.protocol !== 'https:') {
    throw new ProviderError('provider_error', 'fal webhook URL must use HTTPS', false, {
      reason: 'webhook_url_invalid',
    });
  }
  return parsed.toString();
}

/**
 * fal namespaces queue status/result under the application - the first two path segments of the
 * submit URL - and treats anything deeper as a path *within* that application. Submitting to a
 * deeper path and then polling it returns `405`, so the base must be derived rather than assumed
 * equal to the submit endpoint. Confirmed live 2026-07-30 across every route we call:
 *
 *   POST /fal-ai/flux-2-pro                                   -> GET /fal-ai/flux-2-pro/requests/{id}
 *   POST /fal-ai/flux-pro/kontext                             -> GET /fal-ai/flux-pro/requests/{id}
 *   POST /fal-ai/bytedance/seedance/v1/pro/fast/image-to-video -> GET /fal-ai/bytedance/requests/{id}
 *
 * Only flux-2-pro is two segments, which is why appending to the submit endpoint appeared to work:
 * it is the sole route where the application and the submit path coincide. Kontext and Seedance both
 * `405`, so the reconciliation poller could never observe either one - it would retry until the job
 * aged out while the paid artifact sat un-ingested.
 */
function falQueueRequestsBase(endpoint: string): string {
  const parsed = new URL(endpoint);
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    throw new ProviderError('provider_error', 'fal endpoint is not an owner/app path', false, {
      reason: 'endpoint_invalid',
    });
  }
  return `${parsed.origin}/${segments[0]}/${segments[1]}`;
}

type ParsedQueueStatus =
  ProviderJobStatus | Readonly<{ state: 'completed'; providerJobId: string }>;

function parseStatus(body: string, providerJobId: string): ParsedQueueStatus {
  const payload = parseJsonObject(body, 'fal');
  const status = payload.status;
  if (status === 'IN_QUEUE') return { state: 'queued', providerJobId };
  if (status === 'IN_PROGRESS') return { state: 'running', providerJobId };
  if (status === 'COMPLETED') {
    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return {
        state: 'failed',
        providerJobId,
        error: new ProviderError('provider_error', 'fal job failed', false, {
          providerJobId,
          providerMessage: payload.error,
        }),
      };
    }
    const deliveryUrl = findDeliveryUrl(payload);
    if (deliveryUrl === undefined) return { state: 'completed', providerJobId };
    return {
      state: 'succeeded',
      providerJobId,
      delivery: {
        kind: 'transient_delivery_url',
        transientDeliveryUrl: toTransientDeliveryUrl(deliveryUrl),
      },
    };
  }
  if (status === 'FAILED') {
    return {
      state: 'failed',
      providerJobId,
      error: new ProviderError('provider_error', 'fal job failed', false, {
        providerJobId,
        providerMessage: typeof payload.error === 'string' ? payload.error : 'unspecified',
      }),
    };
  }
  throw new ProviderError('payload_invalid', 'fal status shape drifted', false, {
    providerJobId,
  });
}

function parseResult(body: string, providerJobId: string): ProviderJobStatus {
  const payload = parseJsonObject(body, 'fal');
  const deliveryUrl = findDeliveryUrl(payload);
  return {
    state: 'succeeded',
    providerJobId,
    delivery: {
      kind: 'transient_delivery_url',
      transientDeliveryUrl: toTransientDeliveryUrl(deliveryUrl),
    },
  };
}

export class FalQueueDriver implements VersionedProviderDriver {
  constructor(
    readonly descriptor: DriverDescriptor,
    private readonly transport: ProviderTransport,
    private readonly credential: string | undefined,
    private readonly webhookUrl?: string,
    private readonly enablement: ProviderEnablementPort = descriptorGateEnablement,
  ) {}

  async submit(input: ProviderSubmitInput): Promise<ProviderSubmission> {
    const credential = requireCredential(this.credential, 'fal');
    assertRouteEnabled(this.descriptor, this.enablement);
    const webhookUrl = configuredWebhookUrl(this.webhookUrl);
    const payload = validateModelInput(this.descriptor, input.payload);
    const submitUrl = new URL(this.descriptor.endpoint);
    submitUrl.searchParams.set('fal_webhook', webhookUrl);
    let response;
    try {
      response = await this.transport.request({
        method: 'POST',
        url: submitUrl.toString(),
        headers: {
          authorization: `Key ${credential}`,
          'content-type': 'application/json',
          'x-fal-idempotency-key': input.billingIdempotencyKey,
          ...FAL_OUTPUT_HEADERS,
        },
        body: JSON.stringify(payload),
        timeoutMs: 30_000,
      });
    } catch (cause) {
      if (cause instanceof ProviderTransportFailure && cause.kind === 'timeout') {
        if (cause.requestMayHaveBeenAccepted) {
          throw new ProviderError(
            'ambiguous_submit',
            'fal submit timed out after the request may have been accepted',
            false,
            {
              routeId: this.descriptor.routeId,
              billingIdempotencyKey: input.billingIdempotencyKey,
            },
            { cause },
          );
        }
        throw new ProviderError(
          'timeout',
          'fal submit timed out before acceptance',
          true,
          {},
          { cause },
        );
      }
      throw new ProviderError('provider_error', 'fal submit transport failed', true, {}, { cause });
    }
    if (response.status < 200 || response.status >= 300) {
      throw errorFromHttpStatus('fal', response.status, response.body);
    }
    const result = parseJsonObject(response.body, 'fal');
    const providerJobId = requireNonEmptyString(result.request_id, 'request_id');
    const providerRequestId = response.headers['x-fal-request-id'];
    return {
      provider: 'fal',
      routeId: this.descriptor.routeId,
      providerJobId,
      ...(providerRequestId === undefined ? {} : { providerRequestId }),
      state: 'queued',
    };
  }

  async status(providerJobId: string): Promise<ProviderJobStatus> {
    const credential = requireCredential(this.credential, 'fal');
    assertRouteEnabled(this.descriptor, this.enablement);
    let response;
    try {
      response = await this.transport.request({
        method: 'GET',
        url: `${falQueueRequestsBase(this.descriptor.endpoint)}/requests/${encodeURIComponent(providerJobId)}/status`,
        headers: { authorization: `Key ${credential}` },
        timeoutMs: 15_000,
      });
    } catch (cause) {
      if (cause instanceof ProviderTransportFailure && cause.kind === 'timeout') {
        throw new ProviderError('timeout', 'fal status request timed out', true, {}, { cause });
      }
      throw new ProviderError('provider_error', 'fal status transport failed', true, {}, { cause });
    }
    if (response.status < 200 || response.status >= 300) {
      throw errorFromHttpStatus('fal', response.status, response.body);
    }
    const status = parseStatus(response.body, providerJobId);
    if (status.state !== 'completed') return status;

    let resultResponse;
    try {
      resultResponse = await this.transport.request({
        method: 'GET',
        url: `${falQueueRequestsBase(this.descriptor.endpoint)}/requests/${encodeURIComponent(providerJobId)}`,
        headers: { authorization: `Key ${credential}` },
        timeoutMs: 15_000,
      });
    } catch (cause) {
      if (cause instanceof ProviderTransportFailure && cause.kind === 'timeout') {
        throw new ProviderError('timeout', 'fal result request timed out', true, {}, { cause });
      }
      throw new ProviderError('provider_error', 'fal result transport failed', true, {}, { cause });
    }
    if (resultResponse.status < 200 || resultResponse.status >= 300) {
      throw errorFromHttpStatus('fal', resultResponse.status, resultResponse.body);
    }
    return parseResult(resultResponse.body, providerJobId);
  }
}
