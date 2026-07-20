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

function parseStatus(body: string, providerJobId: string): ProviderJobStatus {
  const payload = parseJsonObject(body, 'fal');
  const status = payload.status;
  if (status === 'IN_QUEUE') return { state: 'queued', providerJobId };
  if (status === 'IN_PROGRESS') return { state: 'running', providerJobId };
  if (status === 'COMPLETED') {
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

export class FalQueueDriver implements VersionedProviderDriver {
  constructor(
    readonly descriptor: DriverDescriptor,
    private readonly transport: ProviderTransport,
    private readonly credential: string | undefined,
    private readonly enablement: ProviderEnablementPort = descriptorGateEnablement,
  ) {}

  async submit(input: ProviderSubmitInput): Promise<ProviderSubmission> {
    const credential = requireCredential(this.credential, 'fal');
    assertRouteEnabled(this.descriptor, this.enablement);
    const payload = validateModelInput(this.descriptor, input.payload);
    let response;
    try {
      response = await this.transport.request({
        method: 'POST',
        url: this.descriptor.endpoint,
        headers: {
          authorization: `Key ${credential}`,
          'content-type': 'application/json',
          'x-fal-idempotency-key': input.billingIdempotencyKey,
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
    return parseStatus(response.body, providerJobId);
  }
}
