import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  P0_MCP_TOOL_NAMES,
  P0_OPERATION_RESPONSE_SCHEMAS,
  P0_REST_OPERATIONS,
  buildGoldenLaunchPackGraph,
  type P0HandlerResult,
  type P0McpToolName,
  type P0RestHandlers,
} from '@mustbeviral/contracts';

import { createCoreApp } from '../src/app';
import type { V1Dependencies } from '../src/routes/v1';
import { loadGoldenBriefRegistry } from './golden-brief-registry';
import {
  extractMcpEnvelope,
  inspectorCallArguments,
  inspectorListArguments,
  parseInspectorCallOutput,
  parseJsonProcessOutput,
  redactAndNormalize,
  safeEnvelopeExcerpt,
  safeRequestExcerpt,
  semanticFingerprint,
  type JsonRecord,
  type ProcessResult,
} from './mcp-parity-lib';
import {
  authenticateDisposableStagingUser,
  createConfirmedDisposableStagingUser,
  createDisposableIdentity,
  loadStagingAdminConfiguration,
  type StagingAdminConfiguration,
} from './staging-auth';

const STAGING_BASE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const STAGING_MCP_URL = `${STAGING_BASE_URL}/mcp`;
const PYTHON_SDK_VERSION = '1.29.0';
const TYPESCRIPT_SDK_VERSION = '1.30.0';
const INSPECTOR_VERSION = '2.1.0';
const PRIOR_RUN_ID = '44b3197f-7119-4724-954a-ce9308090ef8';
const PRIOR_WORKSPACE_ID = '69353b4f-3e82-4679-b2c2-0e18cc3650e9';
const PRIOR_EXPIRED_QUOTE_ID = 'ffe19349-1f3a-49b7-8720-f536e96862ce';
const INSPECTOR_LAUNCHER = fileURLToPath(
  new URL(
    '../../../node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js',
    import.meta.url,
  ),
);
const PYTHON_CLIENT = fileURLToPath(new URL('./mcp-parity-python.py', import.meta.url));
const DEFAULT_OUTPUT = fileURLToPath(
  new URL('../../../governance/evidence/WP-P0-001/mcp-parity-vectors.json', import.meta.url),
);

interface RestObservation {
  readonly httpStatus: number;
  readonly envelope: JsonRecord;
}

interface ToolVectorOptions {
  readonly id: string;
  readonly environment: 'staging' | 'local_fixture';
  readonly baseUrl: string;
  readonly mcpUrl: string;
  readonly accessToken: string;
  readonly tool: P0McpToolName;
  readonly argumentsValue: JsonRecord;
  readonly note: string;
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} was not an object.`);
  }
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} was missing.`);
  }
  return value;
}

async function runProcess(
  command: string,
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: { ...environment },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

function restRequest(
  tool: P0McpToolName,
  input: JsonRecord,
): Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: JsonRecord;
  idempotencyKey?: string;
}> {
  if (tool === 'get_canvas_context') {
    return {
      method: 'GET',
      path: `/v1/canvases/${encodeURIComponent(text(input.canvas_id, 'canvas_id'))}`,
    };
  }
  if (tool === 'apply_canvas_patch') {
    return {
      method: 'POST',
      path: `/v1/canvases/${encodeURIComponent(text(input.canvas_id, 'canvas_id'))}/patches`,
      body: {
        expected_revision_id: input.expected_revision_id,
        reason: input.reason,
        patch: input.patch,
      },
      idempotencyKey: text(input.idempotency_key, 'idempotency_key'),
    };
  }
  if (tool === 'quote_run') {
    return {
      method: 'POST',
      path: `/v1/canvases/${encodeURIComponent(text(input.canvas_id, 'canvas_id'))}/quotes`,
      body: { expected_revision_id: input.expected_revision_id },
      idempotencyKey: text(input.idempotency_key, 'idempotency_key'),
    };
  }
  if (tool === 'start_run') {
    return {
      method: 'POST',
      path: `/v1/quotes/${encodeURIComponent(text(input.quote_id, 'quote_id'))}/runs`,
      body: {
        ...(input.confirmed === undefined ? {} : { confirmed: input.confirmed }),
        ...(input.confirmation_token === undefined
          ? {}
          : { confirmation_token: input.confirmation_token }),
      },
      idempotencyKey: text(input.idempotency_key, 'idempotency_key'),
    };
  }
  return {
    method: 'GET',
    path: `/v1/runs/${encodeURIComponent(text(input.run_id, 'run_id'))}`,
  };
}

async function callRest(options: {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly tool: P0McpToolName;
  readonly input: JsonRecord;
}): Promise<RestObservation> {
  const request = restRequest(options.tool, options.input);
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${options.accessToken}`,
    'content-type': 'application/json',
    'x-request-id': `t6-rest-${randomUUID()}`,
  };
  if (request.idempotencyKey !== undefined) {
    headers['idempotency-key'] = request.idempotencyKey;
  }
  const response = await fetch(`${options.baseUrl}${request.path}`, {
    method: request.method,
    headers,
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  });
  const envelope = record((await response.json()) as unknown, 'REST envelope');
  P0_OPERATION_RESPONSE_SCHEMAS[options.tool].parse(envelope);
  return { httpStatus: response.status, envelope };
}

async function callResource(options: {
  readonly path: string;
  readonly accessToken: string;
  readonly body: JsonRecord;
  readonly idempotencyKey: string;
}): Promise<JsonRecord> {
  const response = await fetch(`${STAGING_BASE_URL}${options.path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${options.accessToken}`,
      'content-type': 'application/json',
      'idempotency-key': options.idempotencyKey,
      'x-request-id': `t6-bootstrap-${randomUUID()}`,
    },
    body: JSON.stringify(options.body),
  });
  const envelope = record((await response.json()) as unknown, 'resource envelope');
  if (!response.ok) {
    const error = record(envelope.error, 'resource error');
    throw new Error(`Bootstrap failed with ${String(error.code)}.`);
  }
  return record(envelope.data, 'resource data');
}

async function inspectorList(endpoint: string, accessToken?: string): Promise<unknown> {
  const result = await runProcess(
    process.execPath,
    inspectorListArguments({
      launcherPath: INSPECTOR_LAUNCHER,
      endpoint,
      ...(accessToken === undefined ? {} : { accessToken }),
    }),
  );
  return parseJsonProcessOutput(result, 'MCP Inspector tools/list');
}

function sdkTransport(inner: StreamableHTTPClientTransport): Transport {
  const transport: Transport = {
    start: () => inner.start(),
    send: (message, options) => inner.send(message, options),
    close: () => inner.close(),
    setProtocolVersion: (version) => inner.setProtocolVersion(version),
  };
  Object.defineProperties(transport, {
    onclose: {
      configurable: true,
      get: () => inner.onclose,
      set: (callback: (() => void) | undefined) => {
        if (callback === undefined) Reflect.deleteProperty(inner, 'onclose');
        else inner.onclose = callback;
      },
    },
    onerror: {
      configurable: true,
      get: () => inner.onerror,
      set: (callback: ((error: Error) => void) | undefined) => {
        if (callback === undefined) Reflect.deleteProperty(inner, 'onerror');
        else inner.onerror = callback;
      },
    },
    onmessage: {
      configurable: true,
      get: () => inner.onmessage,
      set: (callback: StreamableHTTPClientTransport['onmessage']) => {
        if (callback === undefined) Reflect.deleteProperty(inner, 'onmessage');
        else inner.onmessage = callback;
      },
    },
  });
  return transport;
}

async function inspectorCall(
  endpoint: string,
  accessToken: string,
  tool: P0McpToolName,
  argumentsValue: JsonRecord,
): Promise<JsonRecord> {
  const result = await runProcess(
    process.execPath,
    inspectorCallArguments({
      launcherPath: INSPECTOR_LAUNCHER,
      endpoint,
      tool,
      argumentsValue,
      accessToken,
    }),
  );
  return extractMcpEnvelope(parseInspectorCallOutput(result, `MCP Inspector ${tool}`));
}

async function typescriptList(endpoint: string, accessToken?: string): Promise<unknown> {
  const client = new Client({ name: 'mustbeviral-t6-typescript', version: TYPESCRIPT_SDK_VERSION });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: {
        ...(accessToken === undefined ? {} : { authorization: `Bearer ${accessToken}` }),
        'x-request-id': `t6-typescript-${randomUUID()}`,
      },
    },
  });
  try {
    await client.connect(sdkTransport(transport));
    return await client.listTools();
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function typescriptCall(
  endpoint: string,
  accessToken: string,
  tool: P0McpToolName,
  argumentsValue: JsonRecord,
): Promise<JsonRecord> {
  const client = new Client({ name: 'mustbeviral-t6-typescript', version: TYPESCRIPT_SDK_VERSION });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-request-id': `t6-typescript-${randomUUID()}`,
      },
    },
  });
  try {
    await client.connect(sdkTransport(transport));
    return extractMcpEnvelope(await client.callTool({ name: tool, arguments: argumentsValue }));
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function pythonAction(
  endpoint: string,
  action: JsonRecord,
  accessToken?: string,
): Promise<ProcessResult> {
  const uv = process.platform === 'win32' ? 'uv.exe' : 'uv';
  return runProcess(
    uv,
    ['run', '--no-project', '--with', `mcp==${PYTHON_SDK_VERSION}`, 'python', PYTHON_CLIENT],
    {
      ...process.env,
      MBV_MCP_ENDPOINT: endpoint,
      MBV_MCP_ACTION: JSON.stringify(action),
      ...(accessToken === undefined ? {} : { MBV_MCP_ACCESS_TOKEN: accessToken }),
    },
  );
}

async function pythonList(endpoint: string, accessToken?: string): Promise<unknown> {
  const result = await pythonAction(endpoint, { kind: 'list' }, accessToken);
  const parsed = record(parseJsonProcessOutput(result, 'Python SDK tools/list'), 'Python output');
  return parsed.result;
}

async function pythonCall(
  endpoint: string,
  accessToken: string,
  tool: P0McpToolName,
  argumentsValue: JsonRecord,
): Promise<JsonRecord> {
  const result = await pythonAction(
    endpoint,
    { kind: 'call', tool, arguments: argumentsValue },
    accessToken,
  );
  const parsed = record(parseJsonProcessOutput(result, `Python SDK ${tool}`), 'Python output');
  return extractMcpEnvelope(parsed.result);
}

function observation(tool: P0McpToolName, envelope: JsonRecord, transportStatus: number | string) {
  return {
    transport_status: transportStatus,
    semantic_fingerprint: semanticFingerprint(envelope),
    response: safeEnvelopeExcerpt(tool, envelope),
  };
}

async function runVector(options: ToolVectorOptions) {
  const rest = await callRest({
    baseUrl: options.baseUrl,
    accessToken: options.accessToken,
    tool: options.tool,
    input: options.argumentsValue,
  });
  const [inspector, typescript, python] = await Promise.all([
    inspectorCall(options.mcpUrl, options.accessToken, options.tool, options.argumentsValue),
    typescriptCall(options.mcpUrl, options.accessToken, options.tool, options.argumentsValue),
    pythonCall(options.mcpUrl, options.accessToken, options.tool, options.argumentsValue),
  ]);
  for (const envelope of [inspector, typescript, python]) {
    P0_OPERATION_RESPONSE_SCHEMAS[options.tool].parse(envelope);
  }
  const fingerprints = [rest.envelope, inspector, typescript, python].map((envelope) =>
    semanticFingerprint(envelope),
  );
  if (new Set(fingerprints).size !== 1) {
    throw new Error(
      `Parity failed for ${options.id}: ${JSON.stringify({
        rest: safeEnvelopeExcerpt(options.tool, rest.envelope),
        inspector: safeEnvelopeExcerpt(options.tool, inspector),
        typescript: safeEnvelopeExcerpt(options.tool, typescript),
        python: safeEnvelopeExcerpt(options.tool, python),
      })}`,
    );
  }
  return {
    id: options.id,
    environment: options.environment,
    operation: options.tool,
    note: options.note,
    request: safeRequestExcerpt(options.tool, options.argumentsValue),
    parity: 'passed',
    rest: observation(options.tool, rest.envelope, rest.httpStatus),
    mcp_inspector: observation(options.tool, inspector, 'MCP tools/call result'),
    typescript_sdk: observation(options.tool, typescript, 'MCP tools/call result'),
    python_sdk: observation(options.tool, python, 'MCP tools/call result'),
  };
}

function normalizedPatchSuccess(envelope: JsonRecord): unknown {
  const normalized = record(redactAndNormalize(envelope), 'normalized patch envelope');
  const data = record(normalized.data, 'normalized patch data');
  return {
    ...normalized,
    data: {
      ...data,
      canvasId: '<canvas-id>',
      revisionId: '<revision-id>',
    },
  };
}

async function runPatchSuccessVector(options: {
  readonly id: string;
  readonly baseUrl: string;
  readonly mcpUrl: string;
  readonly accessToken: string;
  readonly inputs: Readonly<{
    rest: JsonRecord;
    inspector: JsonRecord;
    typescript: JsonRecord;
    python: JsonRecord;
  }>;
  readonly note: string;
}) {
  const [rest, inspector, typescript, python] = await Promise.all([
    callRest({
      baseUrl: options.baseUrl,
      accessToken: options.accessToken,
      tool: 'apply_canvas_patch',
      input: options.inputs.rest,
    }),
    inspectorCall(
      options.mcpUrl,
      options.accessToken,
      'apply_canvas_patch',
      options.inputs.inspector,
    ),
    typescriptCall(
      options.mcpUrl,
      options.accessToken,
      'apply_canvas_patch',
      options.inputs.typescript,
    ),
    pythonCall(options.mcpUrl, options.accessToken, 'apply_canvas_patch', options.inputs.python),
  ]);
  for (const envelope of [rest.envelope, inspector, typescript, python]) {
    P0_OPERATION_RESPONSE_SCHEMAS.apply_canvas_patch.parse(envelope);
  }
  const fingerprints = [rest.envelope, inspector, typescript, python].map((envelope) =>
    semanticFingerprint(normalizedPatchSuccess(envelope)),
  );
  if (new Set(fingerprints).size !== 1) {
    throw new Error(`Equivalent-canvas patch parity failed for ${options.id}.`);
  }
  return {
    id: options.id,
    environment: 'staging',
    operation: 'apply_canvas_patch',
    note: options.note,
    requests: Object.fromEntries(
      Object.entries(options.inputs).map(([client, input]) => [
        client,
        safeRequestExcerpt('apply_canvas_patch', input),
      ]),
    ),
    parity: 'passed',
    comparison:
      'Exact success-envelope shape, canonical hash, and affected-descendant set; disposable canvas and revision identifiers are expected to differ.',
    rest: observation('apply_canvas_patch', rest.envelope, rest.httpStatus),
    mcp_inspector: observation('apply_canvas_patch', inspector, 'MCP tools/call result'),
    typescript_sdk: observation('apply_canvas_patch', typescript, 'MCP tools/call result'),
    python_sdk: observation('apply_canvas_patch', python, 'MCP tools/call result'),
  };
}

async function recoverPriorRunOwner(configuration: StagingAdminConfiguration) {
  const auditResponse = await fetch(
    `${configuration.supabaseUrl}/rest/v1/rpc/get_run_execution_audit`,
    {
      method: 'POST',
      headers: {
        apikey: configuration.serviceRoleKey,
        authorization: `Bearer ${configuration.serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_run_ids: [PRIOR_RUN_ID] }),
    },
  );
  if (!auditResponse.ok) throw new Error('The prior-run PostgREST audit failed.');
  const audit = record((await auditResponse.json()) as unknown, 'run audit');
  if (!Array.isArray(audit.runs) || audit.runs.length !== 1) {
    throw new Error('The prior-run PostgREST audit returned an unexpected run count.');
  }
  const run = record(audit.runs[0], 'audited run');
  if (run.id !== PRIOR_RUN_ID || run.workspace_id !== PRIOR_WORKSPACE_ID) {
    throw new Error('The prior-run PostgREST audit returned the wrong run.');
  }
  const userId = text(run.confirmed_by, 'confirmed_by');
  const userResponse = await fetch(`${configuration.supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: configuration.serviceRoleKey,
      authorization: `Bearer ${configuration.serviceRoleKey}`,
    },
  });
  if (!userResponse.ok) throw new Error('The prior disposable user lookup failed.');
  const user = record((await userResponse.json()) as unknown, 'prior user');
  const email = text(user.email, 'prior user email');
  const identity = { email, password: createDisposableIdentity().password };
  const updateResponse = await fetch(`${configuration.supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: configuration.serviceRoleKey,
      authorization: `Bearer ${configuration.serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password: identity.password }),
  });
  if (!updateResponse.ok) throw new Error('The prior disposable user reset failed.');
  const authentication = await authenticateDisposableStagingUser({
    configuration,
    identity,
    log: () => undefined,
  });
  return {
    userId,
    accessToken: authentication.accessToken,
    auditedAt: text(audit.observed_at, 'observed_at'),
  };
}

function fixtureDependencies(): V1Dependencies {
  const handlers = Object.fromEntries(
    P0_REST_OPERATIONS.map((operation) => [
      operation,
      async (input: unknown): Promise<P0HandlerResult> => {
        const command = record(input, 'fixture handler input');
        if (operation === 'get_run' && command.run_id === 'fixture-rate-limit') {
          return { status: 'rate_limited', retry_after_seconds: 30 };
        }
        if (operation === 'get_run' && command.run_id === 'fixture-internal') {
          throw new Error('database-password=opaque-fixture-secret');
        }
        if (operation === 'start_run' && command.idempotency_key === 'fixture-ambiguity') {
          return { status: 'provider_ambiguous', reconcile_state: 'reconcile_pending' };
        }
        if (operation === 'start_run' && command.idempotency_key === 'fixture-valid-token') {
          return {
            status: 'ok',
            run: {
              runId: 'fixture-run',
              projectId: 'fixture-project',
              canvasId: 'fixture-canvas',
              canvasRevisionId: 'fixture-revision',
              quoteId: 'fixture-quote',
              status: 'queued',
              reservationId: 'fixture-reservation',
            },
          } as P0HandlerResult;
        }
        return { status: 'not_found' };
      },
    ]),
  ) as P0RestHandlers;
  return {
    handlers,
    jwt: {
      verify: async (token) => {
        if (token !== 'fixture-jwt') throw new Error('rejected');
        return { actorId: 'fixture-user', authenticationMethod: 'supabase_jwt' };
      },
    },
    workspaces: { resolve: async () => 'fixture-workspace' },
  };
}

async function nodeRequest(request: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = request.method ?? 'GET';
  return new Request(`http://${request.headers.host ?? '127.0.0.1'}${request.url ?? '/'}`, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' || chunks.length === 0
      ? {}
      : { body: Buffer.concat(chunks) }),
  });
}

async function writeNodeResponse(response: Response, target: ServerResponse): Promise<void> {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => target.setHeader(name, value));
  target.end(Buffer.from(await response.arrayBuffer()));
}

async function startFixtureServer() {
  const app = createCoreApp(fixtureDependencies());
  const bindings = {
    PROVIDER_RUNS_ENABLED: 'true',
    FAL_KEY: 'fixture-provider-key',
  } as unknown as PlatformBindings;
  const server = createServer((request, response) => {
    void (async () => {
      try {
        await writeNodeResponse(await app.fetch(await nodeRequest(request), bindings), response);
      } catch {
        response.statusCode = 500;
        response.end('fixture failure');
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Fixture address unavailable.');
  const baseUrl = `http://127.0.0.1:${String(address.port)}`;
  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function toolNames(value: unknown): readonly string[] {
  const listed = record(value, 'tool list');
  if (!Array.isArray(listed.tools)) throw new TypeError('Tool list omitted tools.');
  return listed.tools.map((tool) => text(record(tool, 'tool').name, 'tool name'));
}

async function privateSurfaceProof(accessToken: string) {
  const [inspector, typescript, python] = await Promise.all([
    inspectorList(STAGING_MCP_URL, accessToken),
    typescriptList(STAGING_MCP_URL, accessToken),
    pythonList(STAGING_MCP_URL, accessToken),
  ]);
  const lists = {
    mcp_inspector: toolNames(inspector),
    typescript_sdk: toolNames(typescript),
    python_sdk: toolNames(python),
  };
  for (const names of Object.values(lists)) {
    if (JSON.stringify(names) !== JSON.stringify(P0_MCP_TOOL_NAMES)) {
      throw new Error('A real client observed a broader or different MCP surface.');
    }
  }
  const unauthenticated = await fetch(STAGING_MCP_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const unauthenticatedEnvelope = record(
    (await unauthenticated.json()) as unknown,
    'unauthenticated MCP envelope',
  );
  const [inspectorFailure, pythonFailure, typescriptFailure] = await Promise.all([
    runProcess(
      process.execPath,
      inspectorListArguments({ launcherPath: INSPECTOR_LAUNCHER, endpoint: STAGING_MCP_URL }),
    ),
    pythonAction(STAGING_MCP_URL, { kind: 'list' }),
    typescriptList(STAGING_MCP_URL).then(
      () => ({ failed: false, message: '' }),
      (error: unknown) => ({ failed: true, message: String((error as Error).message) }),
    ),
  ]);
  const inspectorText = `${inspectorFailure.stdout}\n${inspectorFailure.stderr}`;
  const pythonText = `${pythonFailure.stdout}\n${pythonFailure.stderr}`;
  return {
    authenticated_tools_list: lists,
    exact_count: P0_MCP_TOOL_NAMES.length,
    unauthenticated_discovery: {
      direct_http_status: unauthenticated.status,
      direct_response: redactAndNormalize(unauthenticatedEnvelope),
      mcp_inspector: {
        refused: inspectorFailure.exitCode !== 0,
        safe_401_observed: /401|UNAUTHENTICATED/u.test(inspectorText),
      },
      typescript_sdk: {
        refused: typescriptFailure.failed,
        safe_401_observed: /401|UNAUTHENTICATED/u.test(typescriptFailure.message),
      },
      python_sdk: {
        refused: pythonFailure.exitCode !== 0,
        safe_401_observed: /401|UNAUTHENTICATED/u.test(pythonText),
      },
    },
  };
}

function outputArgument(argv: readonly string[]): string {
  const index = argv.indexOf('--out');
  if (index < 0) return DEFAULT_OUTPUT;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error('--out requires a file path.');
  return value;
}

export async function runMcpParityStaging(argv: readonly string[]): Promise<number> {
  if (!argv.includes('--staging')) throw new Error('The MCP parity harness requires --staging.');
  const output = outputArgument(argv);
  const configuration = await loadStagingAdminConfiguration();
  const identity = createDisposableIdentity();
  const freshUserId = await createConfirmedDisposableStagingUser({ configuration, identity });
  const freshAuthentication = await authenticateDisposableStagingUser({
    configuration,
    identity,
    log: () => undefined,
  });
  const healthResponse = await fetch(`${STAGING_BASE_URL}/health`);
  if (!healthResponse.ok) throw new Error('Staging health failed.');
  const health = record((await healthResponse.json()) as unknown, 'health');
  const prefix = `t6:${randomUUID()}`;
  const workspace = await callResource({
    path: '/v1/workspaces',
    accessToken: freshAuthentication.accessToken,
    body: { name: `T6 MCP parity ${new Date().toISOString()}` },
    idempotencyKey: `${prefix}:workspace`,
  });
  const workspaceId = text(workspace.workspace_id, 'workspace_id');
  const projectData = await callResource({
    path: `/v1/workspaces/${workspaceId}/projects`,
    accessToken: freshAuthentication.accessToken,
    body: { name: 'T6 private MCP parity' },
    idempotencyKey: `${prefix}:project`,
  });
  const projectId = text(record(projectData.project, 'project').id, 'project.id');
  const canvasData = await callResource({
    path: `/v1/projects/${projectId}/canvases`,
    accessToken: freshAuthentication.accessToken,
    body: { name: 'T6 private MCP parity' },
    idempotencyKey: `${prefix}:canvas`,
  });
  const canvasId = text(canvasData.canvasId, 'canvasId');
  const initialRevisionId = text(canvasData.revisionId, 'revisionId');
  const parallelCanvasData = await Promise.all(
    ['inspector', 'typescript', 'python'].map((client) =>
      callResource({
        path: `/v1/projects/${projectId}/canvases`,
        accessToken: freshAuthentication.accessToken,
        body: { name: `T6 private MCP parity ${client}` },
        idempotencyKey: `${prefix}:canvas:${client}`,
      }),
    ),
  );
  const [inspectorCanvas, typescriptCanvas, pythonCanvas] = parallelCanvasData.map(
    (entry, index) => ({
      canvasId: text(entry.canvasId, `parallel canvas ${String(index)} id`),
      revisionId: text(entry.revisionId, `parallel canvas ${String(index)} revision`),
    }),
  );
  if (
    inspectorCanvas === undefined ||
    typescriptCanvas === undefined ||
    pythonCanvas === undefined
  ) {
    throw new Error('The equivalent patch canvases were not created.');
  }
  const surface = await privateSurfaceProof(freshAuthentication.accessToken);
  const vectors: unknown[] = [];
  vectors.push(
    await runVector({
      id: 'success-get-canvas-context',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: freshAuthentication.accessToken,
      tool: 'get_canvas_context',
      argumentsValue: { canvas_id: canvasId },
      note: 'Read-only success against the disposable staging canvas.',
    }),
  );
  const brief = (await loadGoldenBriefRegistry()).find((entry) => entry.briefId === 'GB-01');
  if (brief === undefined) throw new Error('GB-01 was unavailable.');
  const graph = buildGoldenLaunchPackGraph(brief);
  const patchArguments = (target: { canvasId: string; revisionId: string }, client: string) =>
    ({
      canvas_id: target.canvasId,
      expected_revision_id: target.revisionId,
      reason: 'Build the registered GB-01 graph for the no-spend T6 parity proof',
      patch: {
        upsert_nodes: graph.nodes,
        remove_node_ids: [],
        upsert_edges: graph.edges,
        remove_edge_ids: [],
      },
      idempotency_key: `${prefix}:patch:${client}`,
    }) as const;
  const restPatchArguments = patchArguments({ canvasId, revisionId: initialRevisionId }, 'rest');
  const patchVector = await runPatchSuccessVector({
    id: 'success-apply-patch',
    baseUrl: STAGING_BASE_URL,
    mcpUrl: STAGING_MCP_URL,
    accessToken: freshAuthentication.accessToken,
    inputs: {
      rest: restPatchArguments,
      inspector: patchArguments(inspectorCanvas, 'inspector'),
      typescript: patchArguments(typescriptCanvas, 'typescript'),
      python: patchArguments(pythonCanvas, 'python'),
    },
    note: 'REST, Inspector, and both SDKs each apply the same graph once to an equivalent fresh disposable canvas.',
  });
  vectors.push(patchVector);
  const patchedResponse = record(record(patchVector, 'patch vector').rest, 'patch REST');
  const patchedExcerpt = record(
    record(patchedResponse.response, 'patch excerpt').data,
    'patch data',
  );
  const revisionId = text(patchedExcerpt.revisionId, 'patched revision');
  const quoteArguments = {
    canvas_id: canvasId,
    expected_revision_id: revisionId,
    idempotency_key: `${prefix}:quote-replay`,
  };
  const quoteVector = await runVector({
    id: 'success-quote-and-idempotent-replay',
    environment: 'staging',
    baseUrl: STAGING_BASE_URL,
    mcpUrl: STAGING_MCP_URL,
    accessToken: freshAuthentication.accessToken,
    tool: 'quote_run',
    argumentsValue: quoteArguments,
    note: 'REST creates one free quote; Inspector and both SDKs replay the same quote and redacted token.',
  });
  vectors.push(quoteVector);
  const quoteExcerpt = record(
    record(
      record(record(quoteVector, 'quote vector').rest, 'quote REST').response,
      'quote response',
    ).data,
    'quote data',
  );
  const quoteId = text(record(quoteExcerpt.quote, 'quote').quoteId, 'quoteId');
  vectors.push(
    await runVector({
      id: 'validation-failure',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: freshAuthentication.accessToken,
      tool: 'apply_canvas_patch',
      argumentsValue: {
        canvas_id: canvasId,
        idempotency_key: `${prefix}:invalid-patch`,
      },
      note: 'Both adapters reject the same missing required fields with VALIDATION_FAILED.',
    }),
    await runVector({
      id: 'revision-conflict',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: freshAuthentication.accessToken,
      tool: 'apply_canvas_patch',
      argumentsValue: {
        ...restPatchArguments,
        expected_revision_id: initialRevisionId,
        idempotency_key: `${prefix}:revision-conflict`,
      },
      note: 'The stale expected revision returns the same REVISION_CONFLICT and actual head.',
    }),
    await runVector({
      id: 'explicit-confirmation-required',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: freshAuthentication.accessToken,
      tool: 'start_run',
      argumentsValue: {
        quote_id: quoteId,
        confirmation_token: 'not-a-valid-confirmation-token',
        idempotency_key: `${prefix}:missing-confirmed`,
      },
      note: 'confirmed is omitted; every live adapter refuses before handler or provider execution.',
    }),
    await runVector({
      id: 'invalid-confirmation-token',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: freshAuthentication.accessToken,
      tool: 'start_run',
      argumentsValue: {
        quote_id: quoteId,
        confirmed: true,
        confirmation_token: 'not-a-valid-confirmation-token',
        idempotency_key: `${prefix}:invalid-confirmation-token`,
      },
      note: 'confirmed is true but the token is invalid; every live adapter refuses before reservation or provider execution.',
    }),
  );
  const priorOwner = await recoverPriorRunOwner(configuration);
  vectors.push(
    await runVector({
      id: 'authorization-failure',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: freshAuthentication.accessToken,
      tool: 'get_run',
      argumentsValue: { run_id: PRIOR_RUN_ID },
      note: 'The unrelated disposable identity receives the same tenant-safe FORBIDDEN envelope.',
    }),
    await runVector({
      id: 'success-get-run',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: priorOwner.accessToken,
      tool: 'get_run',
      argumentsValue: { run_id: PRIOR_RUN_ID },
      note: 'The prior golden-run disposable owner reads the terminal run through all transports.',
    }),
    await runVector({
      id: 'quote-expiry',
      environment: 'staging',
      baseUrl: STAGING_BASE_URL,
      mcpUrl: STAGING_MCP_URL,
      accessToken: priorOwner.accessToken,
      tool: 'start_run',
      argumentsValue: {
        quote_id: PRIOR_EXPIRED_QUOTE_ID,
        confirmed: true,
        confirmation_token: 'not-a-valid-confirmation-token',
        idempotency_key: `${prefix}:expired-quote`,
      },
      note: 'The expired quote is rejected before confirmation-token verification or provider execution.',
    }),
  );
  const fixture = await startFixtureServer();
  try {
    const fixtureMcp = `${fixture.baseUrl}/mcp`;
    vectors.push(
      await runVector({
        id: 'rate-limit-safe-envelope',
        environment: 'local_fixture',
        baseUrl: fixture.baseUrl,
        mcpUrl: fixtureMcp,
        accessToken: 'fixture-jwt',
        tool: 'get_run',
        argumentsValue: { run_id: 'fixture-rate-limit' },
        note: 'Exact Worker routes with a deterministic handler result prove RATE_LIMITED parity without flooding staging.',
      }),
      await runVector({
        id: 'provider-ambiguity-safe-envelope',
        environment: 'local_fixture',
        baseUrl: fixture.baseUrl,
        mcpUrl: fixtureMcp,
        accessToken: 'fixture-jwt',
        tool: 'start_run',
        argumentsValue: {
          quote_id: 'fixture-quote',
          confirmed: true,
          confirmation_token: 'fixture-confirmation-token',
          idempotency_key: 'fixture-ambiguity',
        },
        note: 'Exact Worker routes prove PROVIDER_AMBIGUOUS parity without creating a live ambiguous submission.',
      }),
      await runVector({
        id: 'internal-error-opacity',
        environment: 'local_fixture',
        baseUrl: fixture.baseUrl,
        mcpUrl: fixtureMcp,
        accessToken: 'fixture-jwt',
        tool: 'get_run',
        argumentsValue: { run_id: 'fixture-internal' },
        note: 'A thrown secret-bearing fixture error becomes the same opaque INTERNAL_ERROR envelope.',
      }),
      await runVector({
        id: 'valid-confirmation-dry-run',
        environment: 'local_fixture',
        baseUrl: fixture.baseUrl,
        mcpUrl: fixtureMcp,
        accessToken: 'fixture-jwt',
        tool: 'start_run',
        argumentsValue: {
          quote_id: 'fixture-quote',
          confirmed: true,
          confirmation_token: 'fixture-confirmation-token',
          idempotency_key: 'fixture-valid-token',
        },
        note: 'The valid-token success shape is fixture-only; no staging confirmation token was submitted.',
      }),
    );
  } finally {
    await fixture.close();
  }
  const evidence = {
    schema_version: 1,
    recorded_at: new Date().toISOString(),
    task: 'T6 private MCP REST-semantic parity',
    no_spend: {
      wallet_credit_micros: '0',
      provider_submissions: 0,
      valid_confirmed_staging_start_run_calls: 0,
      staging_start_run_refusal_calls: 12,
      staging_run_rows_created: 0,
    },
    staging: {
      endpoint: STAGING_MCP_URL,
      health: {
        service: health.service,
        generation: health.generation,
        status: health.status,
      },
      disposable_user_id: freshUserId,
      workspace_id: workspaceId,
      project_id: projectId,
      canvas_id: canvasId,
      initial_revision_id: initialRevisionId,
      patched_revision_id: revisionId,
      quote_id: quoteId,
      prior_run_owner_user_id: priorOwner.userId,
      prior_run_id: PRIOR_RUN_ID,
      prior_workspace_id: PRIOR_WORKSPACE_ID,
      prior_quote_id: PRIOR_EXPIRED_QUOTE_ID,
      privileged_audit_observed_at: priorOwner.auditedAt,
    },
    clients: {
      mcp_inspector: { package: '@modelcontextprotocol/inspector', version: INSPECTOR_VERSION },
      typescript_sdk: { package: '@modelcontextprotocol/sdk', version: TYPESCRIPT_SDK_VERSION },
      python_sdk: { package: 'mcp', version: PYTHON_SDK_VERSION },
    },
    surface,
    vectors,
    boundaries: {
      live_valid_confirmation_token_observed_in_quote_response: true,
      live_valid_confirmation_token_recorded: false,
      live_valid_confirmation_token_submitted: false,
      valid_confirmation_success_fixture_only: true,
      rate_limit_fixture_reason: 'The staging Worker has no deterministic safe rate-limit trigger.',
      provider_ambiguity_fixture_reason:
        'Creating a live ambiguous provider acceptance would violate the no-spend and no-confirmed-run task boundary.',
    },
  };
  await mkdir(fileURLToPath(new URL('.', pathToFileURL(output))), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(
    `MCP_PARITY_PASS vectors=${String(vectors.length)} tools=${String(P0_MCP_TOOL_NAMES.length)} output=${output}`,
  );
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  runMcpParityStaging(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(`MCP_PARITY_ERROR ${(error as Error).message}`);
      process.exitCode = 1;
    },
  );
}
