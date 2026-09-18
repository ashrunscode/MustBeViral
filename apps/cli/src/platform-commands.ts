import {
  createPlatformRestClient,
  isPlatformOperation,
  type PlatformInput,
  type PlatformOperation,
} from '@mustbeviral/contracts';

import { CLI_EXIT_CODES, exitCodeForApiError } from './exit-codes.js';

export async function runPlatformCommand(options: {
  readonly command: string;
  readonly bodyJson?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly baseUrl: string;
  readonly readAccessToken: () => Promise<string>;
  readonly fetch?: typeof fetch;
}) {
  const operation = options.command.replaceAll('-', '_');
  if (!isPlatformOperation(operation))
    return {
      exitCode: CLI_EXIT_CODES.usage,
      payload: { error: { code: 'VALIDATION_FAILED', message: 'Unknown platform command.' } },
    };
  try {
    const client = createPlatformRestClient({
      baseUrl: options.baseUrl,
      getAccessToken: options.readAccessToken,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    const input: unknown = JSON.parse(options.bodyJson ?? '{}');
    const payload = await client.execute(
      operation,
      input as PlatformInput<PlatformOperation>,
      options.idempotencyKey,
    );
    return {
      exitCode: 'error' in payload ? exitCodeForApiError(payload.error.code) : CLI_EXIT_CODES.ok,
      payload,
    };
  } catch (error) {
    const invalid =
      error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError');
    return {
      exitCode: invalid ? CLI_EXIT_CODES.validation : CLI_EXIT_CODES.internal,
      payload: {
        error: {
          code: invalid ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR',
          message: invalid
            ? 'Supply valid --body-json and an idempotency key for mutations.'
            : 'The platform request could not be completed.',
        },
      },
    };
  }
}
