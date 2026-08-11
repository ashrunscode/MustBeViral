import { z } from 'zod';

import { IdentifierSchema } from './commands';
import {
  ApplyCanvasPatchBodySchema,
  ApproveArtifactsBodySchema,
  CancelRunBodySchema,
  CreateArtifactUploadBodySchema,
  CreateCanvasBodySchema,
  CreateExportBodySchema,
  CreateProjectBodySchema,
  CreateWorkspaceBodySchema,
  EmptyBodySchema,
  QuoteRunBodySchema,
  StartRunBodySchema,
  type P0AuthenticatedRestOperation,
} from './rest';
import { P0_OPERATION_RESPONSE_SCHEMAS, type P0OperationResponse } from './responses';

const routeDefinitions = {
  create_workspace: { method: 'POST', path: '/workspaces', body: CreateWorkspaceBodySchema },
  get_workspace: { method: 'GET', path: '/workspaces/:id' },
  create_project: {
    method: 'POST',
    path: '/workspaces/:id/projects',
    body: CreateProjectBodySchema,
  },
  get_project: { method: 'GET', path: '/projects/:id' },
  create_canvas: {
    method: 'POST',
    path: '/projects/:id/canvases',
    body: CreateCanvasBodySchema,
  },
  get_canvas_context: { method: 'GET', path: '/canvases/:id' },
  apply_canvas_patch: {
    method: 'POST',
    path: '/canvases/:id/patches',
    body: ApplyCanvasPatchBodySchema,
  },
  validate_graph: {
    method: 'POST',
    path: '/canvases/:id/validate',
    body: EmptyBodySchema,
    mutation: false,
  },
  quote_run: {
    method: 'POST',
    path: '/canvases/:id/quotes',
    body: QuoteRunBodySchema,
  },
  start_run: { method: 'POST', path: '/quotes/:id/runs', body: StartRunBodySchema },
  get_run: { method: 'GET', path: '/runs/:id' },
  cancel_run: { method: 'POST', path: '/runs/:id/cancel', body: CancelRunBodySchema },
  create_artifact_upload: {
    method: 'POST',
    path: '/artifacts/uploads',
    body: CreateArtifactUploadBodySchema,
  },
  get_artifact: { method: 'GET', path: '/artifacts/:id' },
  approve_artifacts: {
    method: 'POST',
    path: '/runs/:id/approvals',
    body: ApproveArtifactsBodySchema,
  },
  create_export: { method: 'POST', path: '/runs/:id/exports', body: CreateExportBodySchema },
  explain_model: { method: 'GET', path: '/models/:id' },
  get_receipt: { method: 'GET', path: '/runs/:id/receipt' },
} as const satisfies Readonly<
  Record<
    P0AuthenticatedRestOperation,
    Readonly<{
      method: 'GET' | 'POST';
      path: string;
      body?: z.ZodType;
      mutation?: false;
    }>
  >
>;

type RouteDefinitions = typeof routeDefinitions;
type OperationsWithPath = {
  [
    Operation in P0AuthenticatedRestOperation
  ]: RouteDefinitions[Operation]['path'] extends `${string}:id${string}` ? Operation : never;
}[P0AuthenticatedRestOperation];
type OperationsWithBody = {
  [Operation in P0AuthenticatedRestOperation]: RouteDefinitions[Operation] extends {
    body: z.ZodType;
  }
    ? Operation
    : never;
}[P0AuthenticatedRestOperation];
type Mutations = {
  [Operation in P0AuthenticatedRestOperation]: RouteDefinitions[Operation]['method'] extends 'POST'
    ? RouteDefinitions[Operation] extends { mutation: false }
      ? never
      : Operation
    : never;
}[P0AuthenticatedRestOperation];

type BodyFor<Operation extends OperationsWithBody> = RouteDefinitions[Operation] extends {
  body: infer Schema extends z.ZodType;
}
  ? z.input<Schema>
  : never;

export type P0ClientRequest<Operation extends P0AuthenticatedRestOperation> = Readonly<
  { requestId?: string } & (Operation extends OperationsWithPath ? { id: string } : object) &
    (Operation extends OperationsWithBody ? { body: BodyFor<Operation> } : object) &
    (Operation extends Mutations ? { idempotencyKey: string } : object)
>;

export interface MustBeViralClientOptions {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetch?: typeof fetch;
  readonly createRequestId?: () => string;
}

export interface MustBeViralRestClient {
  request<Operation extends P0AuthenticatedRestOperation>(
    operation: Operation,
    input: P0ClientRequest<Operation>,
  ): Promise<P0OperationResponse<Operation>>;
}

export class MustBeViralClientError extends Error {
  constructor(
    message: string,
    readonly code: 'AUTH_REQUIRED' | 'INVALID_CONFIGURATION' | 'INVALID_RESPONSE',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'MustBeViralClientError';
  }
}

function normalizedBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('protocol');
    return url.href.replace(/\/$/u, '');
  } catch (error) {
    throw new MustBeViralClientError(
      'The Core API base URL must be an absolute HTTP(S) URL.',
      'INVALID_CONFIGURATION',
      { cause: error },
    );
  }
}

function defaultRequestId(): string {
  const cryptoSource = (
    globalThis as unknown as Readonly<{ crypto?: Readonly<{ randomUUID?: () => string }> }>
  ).crypto;
  if (cryptoSource?.randomUUID !== undefined) return `web-${cryptoSource.randomUUID()}`;
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createMustBeViralRestClient(
  options: MustBeViralClientOptions,
): MustBeViralRestClient {
  const baseUrl = normalizedBaseUrl(options.baseUrl);
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const createRequestId = options.createRequestId ?? defaultRequestId;

  return {
    async request<Operation extends P0AuthenticatedRestOperation>(
      operation: Operation,
      input: P0ClientRequest<Operation>,
    ): Promise<P0OperationResponse<Operation>> {
      const definition = routeDefinitions[operation];
      const accessToken = await options.getAccessToken();
      if (accessToken === null || accessToken.length === 0) {
        throw new MustBeViralClientError('A Supabase session is required.', 'AUTH_REQUIRED');
      }

      const requestId = input.requestId ?? createRequestId();
      let path: string = definition.path;
      if (path.includes(':id')) {
        const id = IdentifierSchema.parse((input as unknown as Readonly<{ id: string }>).id);
        path = path.replace(':id', encodeURIComponent(id));
      }

      const headers = new Headers({
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'x-request-id': requestId,
      });
      const init: RequestInit = { method: definition.method, headers };
      if ('body' in definition) {
        headers.set('content-type', 'application/json');
        init.body = JSON.stringify(
          definition.body.parse((input as unknown as Readonly<{ body: unknown }>).body),
        );
      }
      if (
        definition.method === 'POST' &&
        !('mutation' in definition && definition.mutation === false)
      ) {
        const key = z
          .string()
          .min(1)
          .max(200)
          .parse((input as unknown as Readonly<{ idempotencyKey: string }>).idempotencyKey);
        headers.set('idempotency-key', key);
      }

      const response = await fetchImplementation(`${baseUrl}/v1${path}`, init);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new MustBeViralClientError('Core returned a non-JSON response.', 'INVALID_RESPONSE', {
          cause: error,
        });
      }

      try {
        return P0_OPERATION_RESPONSE_SCHEMAS[operation].parse(
          payload,
        ) as P0OperationResponse<Operation>;
      } catch (error) {
        throw new MustBeViralClientError(
          `Core returned an invalid ${operation} response.`,
          'INVALID_RESPONSE',
          { cause: error },
        );
      }
    },
  };
}
