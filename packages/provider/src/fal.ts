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

export const FAL_OUTPUT_LIFECYCLE_SECONDS = 3_600;

export const FAL_PRIVATE_OUTPUT_HEADERS = {
  'x-fal-object-lifecycle-preference': JSON.stringify({
    expiration_duration_seconds: FAL_OUTPUT_LIFECYCLE_SECONDS,
    initial_acl: { default: 'hide', rules: [] },
  }),
  'x-fal-store-io': '0',
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
          ...FAL_PRIVATE_OUTPUT_HEADERS,
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
        url: `${this.descriptor.endpoint}/requests/${encodeURIComponent(providerJobId)}/status`,
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
        url: `${this.descriptor.endpoint}/requests/${encodeURIComponent(providerJobId)}`,
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
