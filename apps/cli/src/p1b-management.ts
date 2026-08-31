import { exitCodeForApiError } from './index.js';

export interface P1bManagementRequestOptions {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly fetch?: typeof fetch;
}

export interface P1bManagementResponse {
  readonly status: number;
  readonly body: unknown;
}

function managementFetch(options: P1bManagementRequestOptions): typeof fetch {
  return options.fetch ?? fetch;
}

export async function p1bManagementRequest(
  options: P1bManagementRequestOptions,
  path: string,
  init: Readonly<{
    method: 'GET' | 'POST';
    body?: unknown;
    idempotencyKey?: string;
    workspaceId?: string;
  }>,
): Promise<P1bManagementResponse> {
  const response = await managementFetch(options)(`${options.baseUrl}${path}`, {
    method: init.method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${options.accessToken}`,
      'content-type': 'application/json',
      ...(init.idempotencyKey === undefined ? {} : { 'idempotency-key': init.idempotencyKey }),
      ...(init.workspaceId === undefined ? {} : { 'x-workspace-id': init.workspaceId }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body };
}

export function exitCodeForManagementResponse(response: P1bManagementResponse): number {
  if (response.status >= 200 && response.status < 300) return 0;
  const code =
    typeof response.body === 'object' &&
    response.body !== null &&
    'error' in response.body &&
    typeof (response.body as { error?: { code?: string } }).error?.code === 'string'
      ? (response.body as { error: { code: string } }).error.code
      : 'INTERNAL_ERROR';
  return exitCodeForApiError(code);
}
