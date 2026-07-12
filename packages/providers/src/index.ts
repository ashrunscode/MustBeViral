export interface ProviderSubmission {
  readonly idempotencyKey: string;
  readonly modelId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ProviderJobReference {
  readonly providerJobId: string;
  readonly providerRequestId?: string;
}

export interface ProviderWebhookRequest {
  readonly body: Uint8Array;
  readonly headers: Readonly<Record<string, string>>;
}

export interface ProviderTransport {
  authenticate(): Promise<void>;
  submit(submission: ProviderSubmission): Promise<ProviderJobReference>;
  status(reference: ProviderJobReference): Promise<unknown>;
  cancel(reference: ProviderJobReference): Promise<void>;
  verifyWebhook(request: ProviderWebhookRequest): Promise<boolean>;
}

export interface ModelDriver {
  readonly capabilities: ReadonlySet<string>;
  validateInputs(input: unknown): Readonly<Record<string, unknown>>;
  encodeRequest(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
  normalizeOutput(output: unknown): Readonly<Record<string, unknown>>;
  quote(input: Readonly<Record<string, unknown>>): { readonly usdMicros: number };
  readonly idempotencyPolicy: 'provider-guaranteed' | 'reconcile-ambiguous';
}

export const enabledProviderTransports = ['fal'] as const;

export function isEnabledProviderTransport(value: string): boolean {
  return enabledProviderTransports.some((candidate) => candidate === value);
}
