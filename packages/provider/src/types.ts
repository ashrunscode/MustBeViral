import { ProviderError } from './errors';

export interface ProviderTransportRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}

export interface ProviderTransportResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** Injectable boundary. Production wiring may wrap fetch; this package never uses global fetch. */
export interface ProviderTransport {
  request(request: ProviderTransportRequest): Promise<ProviderTransportResponse>;
}

export type ProviderName = 'moonshot' | 'fal';
export type DriverFamily = 'text' | 'image' | 'video';

export type PriceShape =
  | Readonly<{
      kind: 'text_tokens';
      inputPerMillionMicros: number;
      outputPerMillionMicros: number;
    }>
  | Readonly<{
      kind: 'image_megapixel_tiered';
      firstMegapixelMicros: number;
      additionalMegapixelMicros: number;
    }>
  | Readonly<{ kind: 'image_flat'; perImageMicros: number }>
  | Readonly<{ kind: 'video_second'; perSecondMicros: number; resolution: '720p' }>;

export interface DriverCapabilityShape {
  readonly family: DriverFamily;
  readonly tasks: readonly string[];
  readonly inputSchemaVersion: string;
  readonly outputSchemaVersion: string;
}

export interface DriverDescriptor {
  readonly descriptorVersion: string;
  readonly driverVersion: string;
  readonly provider: ProviderName;
  readonly routeId: string;
  readonly modelId: string;
  readonly endpoint: string;
  readonly price: PriceShape;
  readonly capabilities: DriverCapabilityShape;
  readonly enableGates: Readonly<{
    readonly priceConfirmed: boolean;
    readonly retentionCleared: boolean;
  }>;
  readonly idempotencyPolicy: 'billing_key_header' | 'reconcile_ambiguous';
}

export interface ProviderEnablementPort {
  evaluate(
    descriptor: DriverDescriptor,
  ): Readonly<{ allowed: true }> | Readonly<{ allowed: false; reason: string }>;
}

export const descriptorGateEnablement: ProviderEnablementPort = {
  evaluate(descriptor) {
    if (!descriptor.enableGates.priceConfirmed) {
      return { allowed: false, reason: 'price_not_confirmed' };
    }
    if (!descriptor.enableGates.retentionCleared) {
      return { allowed: false, reason: 'retention_not_cleared' };
    }
    return { allowed: true };
  },
};

export function assertRouteEnabled(
  descriptor: DriverDescriptor,
  enablement: ProviderEnablementPort,
): void {
  const decision = enablement.evaluate(descriptor);
  if (!decision.allowed) {
    throw new ProviderError('provider_error', 'provider route is disabled', false, {
      routeId: descriptor.routeId,
      reason: decision.reason,
    });
  }
}

export interface ProviderSubmitInput {
  readonly billingIdempotencyKey: string;
  readonly payload: unknown;
}

export interface ProviderSubmission {
  readonly provider: ProviderName;
  readonly routeId: string;
  readonly providerJobId: string;
  readonly providerRequestId?: string;
  readonly state: 'queued' | 'succeeded';
  readonly output?: unknown;
}

export interface VersionedProviderDriver {
  readonly descriptor: DriverDescriptor;
  submit(input: ProviderSubmitInput): Promise<ProviderSubmission>;
  status?(providerJobId: string): Promise<ProviderJobStatus>;
}

export type TransientDeliveryUrl = string & {
  readonly __brand: 'transient_delivery_url';
};

export type ProviderJobStatus =
  | Readonly<{ state: 'queued' | 'running'; providerJobId: string }>
  | Readonly<{
      state: 'succeeded';
      providerJobId: string;
      delivery: Readonly<{
        kind: 'transient_delivery_url';
        transientDeliveryUrl: TransientDeliveryUrl;
      }>;
    }>
  | Readonly<{ state: 'failed'; providerJobId: string; error: ProviderError }>;

export function toTransientDeliveryUrl(value: unknown): TransientDeliveryUrl {
  if (typeof value !== 'string') {
    throw new ProviderError('payload_invalid', 'delivery URL must be a string', false);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProviderError('payload_invalid', 'delivery URL must be valid', false);
  }
  if (parsed.protocol !== 'https:') {
    throw new ProviderError('payload_invalid', 'delivery URL must use HTTPS', false);
  }
  return value as TransientDeliveryUrl;
}
