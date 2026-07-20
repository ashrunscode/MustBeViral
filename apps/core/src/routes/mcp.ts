import {
  P0_MCP_TOOL_NAMES,
  P0McpToolInputSchemas,
  p0McpHandlers,
  p0McpToolCatalog,
  type HandlerContext,
  type P0McpToolName,
  type P0RestHandlers,
} from '@mustbeviral/contracts';
import { Hono, type Context } from 'hono';

import type { AuthenticatedActor, SupabaseJwtVerifier } from '../auth/supabase-jwt';
import type { CoreHonoEnvironment } from '../bindings';
import { jsonSafe, safeError, safeSuccess } from '../http/responses';
import { p0ResultSemantics } from '../transport/semantics';
import type { WorkspaceResolutionPort } from './v1';
import type { RequestDependencyFactory, RequestScopedDependencies } from './v1';
import { providerRunsEnabled } from './v1';

export const MCP_PROTOCOL_VERSION = '2025-11-25' as const;
const supportedProtocolVersions = new Set(['2025-03-26', '2025-06-18', MCP_PROTOCOL_VERSION]);

export interface McpDependencies {
  readonly handlers: P0RestHandlers;
  readonly jwt: SupabaseJwtVerifier;
  readonly workspaces: WorkspaceResolutionPort;
  readonly requestFactory?: RequestDependencyFactory;
}

type JsonRpcId = string | number;

interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): JsonRpcRequest {
  if (!isRecord(value) || value.jsonrpc !== '2.0' || typeof value.method !== 'string') {
    throw new TypeError('Invalid JSON-RPC request');
  }
  if (value.id !== undefined && typeof value.id !== 'string' && typeof value.id !== 'number') {
    throw new TypeError('Invalid JSON-RPC id');
  }
  return {
    jsonrpc: '2.0',
    ...(value.id === undefined ? {} : { id: value.id }),
    method: value.method,
    ...(value.params === undefined ? {} : { params: value.params }),
  };
}

function bearerToken(context: Context<CoreHonoEnvironment>): string | null {
  const authorization = context.req.header('authorization');
  const match = authorization === undefined ? null : /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? null;
}

async function authenticate(
  context: Context<CoreHonoEnvironment>,
  dependencies: McpDependencies,
): Promise<Readonly<{ actor: AuthenticatedActor; callerJwt: string }> | null> {
  const token = bearerToken(context);
  if (token === null) return null;
  try {
    return { actor: await dependencies.jwt.verify(token, context.env), callerJwt: token };
  } catch {
    return null;
  }
}

function allowedOrigin(context: Context<CoreHonoEnvironment>): boolean {
  const origin = context.req.header('origin');
  if (origin === undefined) return true;
  const configured = context.env.CORS_ALLOWED_ORIGINS;
  if (configured === undefined) return false;
  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(origin);
}

function rpcResult(id: JsonRpcId, result: unknown): Readonly<Record<string, unknown>> {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
): Readonly<Record<string, unknown>> {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function mcpToolResult(
  context: Context<CoreHonoEnvironment>,
  envelope: unknown,
  isError: boolean,
): Readonly<Record<string, unknown>> {
  const safeEnvelope = jsonSafe(envelope);
  return {
    content: [{ type: 'text', text: JSON.stringify(safeEnvelope) }],
    structuredContent: safeEnvelope,
    isError,
    _meta: { request_id: context.get('requestId') },
  };
}

function pathId(tool: P0McpToolName, input: Readonly<Record<string, unknown>>): string | undefined {
  if (tool === 'get_canvas_context' || tool === 'apply_canvas_patch' || tool === 'quote_run') {
    return typeof input.canvas_id === 'string' ? input.canvas_id : undefined;
  }
  if (tool === 'start_run') return typeof input.quote_id === 'string' ? input.quote_id : undefined;
  return typeof input.run_id === 'string' ? input.run_id : undefined;
}

function isToolName(value: unknown): value is P0McpToolName {
  return typeof value === 'string' && P0_MCP_TOOL_NAMES.some((name) => name === value);
}

async function callTool(
  context: Context<CoreHonoEnvironment>,
  actor: AuthenticatedActor,
  request: JsonRpcRequest,
  dependencies: RequestScopedDependencies,
): Promise<Response> {
  const id = request.id;
  if (id === undefined) return context.body(null, 202);
  const params = isRecord(request.params) ? request.params : {};
  if (!isToolName(params.name)) {
    return context.json(rpcError(id, -32602, 'Unknown or missing tool name.'), 200);
  }
  const tool = params.name;
  const argumentsValue = isRecord(params.arguments) ? params.arguments : {};
  try {
    const input = P0McpToolInputSchemas[tool].parse(argumentsValue) as Readonly<
      Record<string, unknown>
    >;
    const workspaceId = await dependencies.workspaces.resolve({
      actor,
      operation: tool,
      pathId: pathId(tool, input),
      body: input,
    });
    if (workspaceId === null) {
      const envelope = safeError(context, 'FORBIDDEN', 'Access to this resource is forbidden.');
      return context.json(rpcResult(id, mcpToolResult(context, envelope, true)), 200);
    }
    if (tool === 'start_run' && !providerRunsEnabled(context.env)) {
      const envelope = safeError(
        context,
        'MODEL_UNAVAILABLE',
        'Provider-backed execution is not enabled.',
      );
      return context.json(rpcResult(id, mcpToolResult(context, envelope, true)), 200);
    }
    const handlerContext: HandlerContext = {
      workspace_id: workspaceId,
      actor_id: actor.actorId,
      request_id: context.get('requestId'),
    };
    const handlers = p0McpHandlers(dependencies.handlers);
    const result = await handlers[tool]({ context: handlerContext, ...input });
    const semantic = p0ResultSemantics(result);
    const envelope = semantic.ok
      ? safeSuccess(context, semantic.data)
      : safeError(
          context,
          semantic.error.code,
          semantic.error.message,
          semantic.error.retryable,
          semantic.error.details,
        );
    return context.json(rpcResult(id, mcpToolResult(context, envelope, !semantic.ok)), 200);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof TypeError ||
      (error as Error).name === 'ZodError'
    ) {
      const envelope = safeError(context, 'VALIDATION_FAILED', 'The request is invalid.');
      return context.json(rpcResult(id, mcpToolResult(context, envelope, true)), 200);
    }
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'core.mcp.tool.failed',
        request_id: context.get('requestId'),
        error_name: (error as Error).name,
      }),
    );
    const envelope = safeError(
      context,
      'INTERNAL_ERROR',
      'The request could not be completed.',
      true,
      {
        error_id: context.get('requestId'),
      },
    );
    return context.json(rpcResult(id, mcpToolResult(context, envelope, true)), 200);
  }
}

function protocolVersionValid(context: Context<CoreHonoEnvironment>, method: string): boolean {
  if (method === 'initialize') return true;
  const version = context.req.header('mcp-protocol-version') ?? '2025-03-26';
  return supportedProtocolVersions.has(version);
}

async function handlePost(
  context: Context<CoreHonoEnvironment>,
  dependencies: McpDependencies,
): Promise<Response> {
  if (!allowedOrigin(context)) {
    return context.json(safeError(context, 'FORBIDDEN', 'The request origin is not allowed.'), 403);
  }
  const accept = context.req.header('accept') ?? '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    return context.json(
      safeError(context, 'VALIDATION_FAILED', 'The MCP Accept header is invalid.'),
      400,
    );
  }
  const authentication = await authenticate(context, dependencies);
  if (authentication === null) {
    return context.json(
      safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
      401,
    );
  }
  const scopedDependencies =
    (await dependencies.requestFactory?.create({
      actor: authentication.actor,
      bindings: context.env,
      callerJwt: authentication.callerJwt,
    })) ?? dependencies;
  let request: JsonRpcRequest;
  try {
    request = parseRequest(await context.req.json());
  } catch {
    return context.json(rpcError(null, -32700, 'Invalid JSON-RPC request.'), 400);
  }
  if (!protocolVersionValid(context, request.method)) {
    return context.json(
      rpcError(request.id ?? null, -32600, 'Unsupported MCP protocol version.'),
      400,
    );
  }
  if (request.id === undefined) return context.body(null, 202);
  if (request.method === 'initialize') {
    const params = isRecord(request.params) ? request.params : {};
    const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
    if (!supportedProtocolVersions.has(requested)) {
      return context.json(rpcError(request.id, -32602, 'Unsupported MCP protocol version.'), 200);
    }
    return context.json(
      rpcResult(request.id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'mustbeviral-core-private', version: 'p0' },
      }),
      200,
    );
  }
  if (request.method === 'ping') return context.json(rpcResult(request.id, {}), 200);
  if (request.method === 'tools/list') {
    return context.json(rpcResult(request.id, { tools: p0McpToolCatalog() }), 200);
  }
  if (request.method === 'tools/call') {
    return callTool(context, authentication.actor, request, scopedDependencies);
  }
  return context.json(rpcError(request.id, -32601, 'Method not found.'), 200);
}

export function createMcpRoute(dependencies: McpDependencies): Hono<CoreHonoEnvironment> {
  const router = new Hono<CoreHonoEnvironment>();
  router.post('/', (context) => handlePost(context, dependencies));
  router.get('/', async (context) => {
    if (!allowedOrigin(context)) {
      return context.json(
        safeError(context, 'FORBIDDEN', 'The request origin is not allowed.'),
        403,
      );
    }
    if ((await authenticate(context, dependencies)) === null) {
      return context.json(
        safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
        401,
      );
    }
    context.header('allow', 'POST');
    return context.json(
      safeError(context, 'VALIDATION_FAILED', 'Server-initiated MCP streams are not enabled.'),
      405,
    );
  });
  return router;
}
