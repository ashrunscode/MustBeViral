import { CLI_EXIT_CODES, exitCodeForApiError } from './index.js';

export function exitCodeForClientResponse(response: unknown): number {
  if (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as { error?: { code?: string } }).error?.code === 'string'
  ) {
    return exitCodeForApiError((response as { error: { code: string } }).error.code);
  }
  return CLI_EXIT_CODES.ok;
}

export function parseJsonBody(value: string | undefined, label: string): unknown {
  if (value === undefined || value.length === 0) {
    throw new Error(`Usage: ${label} requires --body-json '<json>'.`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON for ${label}: ${message}`);
  }
}

export function requireConfirmationFlag(
  confirmed: boolean,
  command: string,
): asserts confirmed is true {
  if (!confirmed) {
    throw new Error(
      `${command} is a destructive or paid mutation. Re-run with --confirm (or --confirmed for start-run) after reviewing the impact.`,
    );
  }
}

export function createIdempotencyKey(provided: string | undefined): string {
  if (provided !== undefined && provided.length > 0) return provided;
  return crypto.randomUUID();
}
