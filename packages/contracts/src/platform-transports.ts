import { z } from 'zod';

import { IdempotencyKeySchema } from './commands';
import {
  ApiErrorEnvelopeSchema,
  createApiSuccessEnvelopeSchema,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope,
} from './http';
import { contractSchemaToJsonSchema } from './responses';
import {
  PLATFORM_OPERATIONS,
  PLATFORM_OPERATION_NAMES,
  type PlatformInput,
  type PlatformOperation,
  type PlatformOutput,
} from './platform';
import { MustBeViralClientError, type MustBeViralClientOptions } from './client';

export function platformPathKeys(operation: PlatformOperation): readonly string[] {
  return [...PLATFORM_OPERATIONS[operation].path.matchAll(/\{([a-z_]+)\}/gu)].map(
    (match) => match[1]!,
  );
}

export function platformMcpInputSchema(operation: PlatformOperation) {
  const definition = PLATFORM_OPERATIONS[operation];
  return definition.method === 'GET'
    ? definition.input
    : definition.input.extend({ idempotency_key: IdempotencyKeySchema });
}

export function platformMcpToolCatalog() {
  return PLATFORM_OPERATION_NAMES.map((operation) => ({
    name: operation,
    description: `${operation.replaceAll('_', ' ')}. Requires a user session and current database permissions.`,
    inputSchema: contractSchemaToJsonSchema(platformMcpInputSchema(operation)),
    outputSchema: contractSchemaToJsonSchema(
      createApiSuccessEnvelopeSchema(PLATFORM_OPERATIONS[operation].output),
    ),
    annotations: {
      readOnlyHint: PLATFORM_OPERATIONS[operation].method === 'GET',
      destructiveHint: operation.startsWith('archive_') || operation.startsWith('revoke_'),
      idempotentHint: true,
      openWorldHint: false,
    },
  }));
}

export type PlatformResponse<O extends PlatformOperation> =
  ApiSuccessEnvelope<PlatformOutput<O>> | ApiErrorEnvelope;

export function createPlatformRestClient(options: MustBeViralClientOptions) {
  return {
    async execute<O extends PlatformOperation>(
      operation: O,
      input: PlatformInput<O>,
      idempotencyKey?: string,
    ): Promise<PlatformResponse<O>> {
      const definition = PLATFORM_OPERATIONS[operation];
      const parsed = definition.input.parse(input) as Readonly<Record<string, unknown>>;
      const mutation = definition.method !== 'GET';
      if (mutation) IdempotencyKeySchema.parse(idempotencyKey);
      const pathKeys = platformPathKeys(operation);
      const path = definition.path.replace(/\{([a-z_]+)\}/gu, (_, key: string) =>
        encodeURIComponent(String(parsed[key])),
      );
      const rest = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => !pathKeys.includes(key)),
      );
      const url = new URL(`${options.baseUrl.replace(/\/$/u, '').replace(/\/v1$/u, '')}/v1${path}`);
      if (!mutation)
        for (const [key, value] of Object.entries(rest)) url.searchParams.set(key, String(value));
      const token = await options.getAccessToken();
      if (token === null || token.length === 0)
        throw new MustBeViralClientError('A user session is required.', 'AUTH_REQUIRED');
      if (!['http:', 'https:'].includes(url.protocol))
        throw new MustBeViralClientError('The API URL must use HTTP(S).', 'INVALID_CONFIGURATION');
      const response = await (options.fetch ?? fetch)(url.toString(), {
        method: definition.method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          ...(options.createRequestId === undefined
            ? {}
            : { 'x-request-id': options.createRequestId() }),
          ...(mutation ? { 'idempotency-key': idempotencyKey! } : {}),
        },
        ...(mutation ? { body: JSON.stringify(rest) } : {}),
      });
      const body: unknown = await response.json();
      const envelope = z
        .union([createApiSuccessEnvelopeSchema(definition.output), ApiErrorEnvelopeSchema])
        .parse(body);
      if (response.ok !== 'data' in envelope) throw new Error('Invalid platform response status');
      return envelope as PlatformResponse<O>;
    },
  };
}
