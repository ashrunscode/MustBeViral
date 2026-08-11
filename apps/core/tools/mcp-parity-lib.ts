import { createHash } from 'node:crypto';

import type { P0McpToolName } from '@mustbeviral/contracts';

export type JsonRecord = Readonly<Record<string, unknown>>;

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} was not an object.`);
  }
  return value as JsonRecord;
}

function normalizedKeyValue(key: string, value: unknown): unknown {
  if (key === 'request_id' || key === 'error_id') return '<request-id>';
  if (
    key === 'authorization' ||
    key === 'apikey' ||
    key === 'access_token' ||
    key === 'refresh_token' ||
    key === 'confirmation_token' ||
    key === 'confirmationToken'
  ) {
    return '<redacted>';
  }
  if (
    key === 'object_key' ||
    key === 'upload_url' ||
    key === 'download_url' ||
    key === 'access_url' ||
    key === 'signed_url'
  ) {
    return '<redacted-private-location>';
  }
  return value;
}

export function redactAndNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactAndNormalize(entry));
  if (typeof value === 'string') {
    if (/^Bearer\s+/u.test(value)) return '<redacted>';
    return value;
  }
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const normalized = normalizedKeyValue(key, entry);
      return [key, normalized === entry ? redactAndNormalize(entry) : normalized];
    }),
  );
}

function sortedJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortedJsonValue(entry));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortedJsonValue(entry)]),
  );
}

export function semanticFingerprint(envelope: unknown): string {
  const normalized = sortedJsonValue(redactAndNormalize(envelope));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function extractMcpEnvelope(result: unknown): JsonRecord {
  const parsed = record(result, 'MCP result');
  if (parsed.structuredContent !== undefined) {
    return record(parsed.structuredContent, 'MCP structured content');
  }
  const content = parsed.content;
  if (!Array.isArray(content)) throw new TypeError('MCP result omitted structured content.');
  const textItem = content.find(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      !Array.isArray(entry) &&
      (entry as JsonRecord).type === 'text' &&
      typeof (entry as JsonRecord).text === 'string',
  ) as JsonRecord | undefined;
  if (textItem === undefined) throw new TypeError('MCP result omitted its text envelope.');
  return record(JSON.parse(String(textItem.text)) as unknown, 'MCP text envelope');
}

function inspectorValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function inspectorCallArguments(options: {
  readonly launcherPath: string;
  readonly endpoint: string;
  readonly tool: P0McpToolName;
  readonly argumentsValue: JsonRecord;
  readonly accessToken?: string;
}): readonly string[] {
  const args = [
    options.launcherPath,
    '--cli',
    options.endpoint,
    '--transport',
    'http',
    '--method',
    'tools/call',
    '--tool-name',
    options.tool,
  ];
  for (const [key, value] of Object.entries(options.argumentsValue)) {
    args.push('--tool-arg', `${key}=${inspectorValue(value)}`);
  }
  if (options.accessToken !== undefined) {
    args.push('--header', `Authorization: Bearer ${options.accessToken}`);
  }
  return args;
}

export function inspectorListArguments(options: {
  readonly launcherPath: string;
  readonly endpoint: string;
  readonly accessToken?: string;
}): readonly string[] {
  const args = [
    options.launcherPath,
    '--cli',
    options.endpoint,
    '--transport',
    'http',
    '--method',
    'tools/list',
  ];
  if (options.accessToken !== undefined) {
    args.push('--header', `Authorization: Bearer ${options.accessToken}`);
  }
  return args;
}

export function parseJsonProcessOutput(result: ProcessResult, label: string): unknown {
  if (result.exitCode !== 0) {
    throw new Error(`${label} exited ${String(result.exitCode)}: ${result.stderr.slice(0, 500)}`);
  }
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new TypeError(`${label} returned invalid JSON.`);
  }
}

export function parseInspectorCallOutput(result: ProcessResult, label: string): unknown {
  // Inspector deliberately exits 5 after printing a valid MCP tools/call
  // result whose isError flag is true. Its Windows launcher can also abort in
  // libuv shutdown after that valid result is flushed. Accept only a parsed
  // isError result on nonzero exit; every non-result failure remains fatal.
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout) as unknown;
  } catch {
    if (result.exitCode !== 0) {
      throw new Error(`${label} exited ${String(result.exitCode)}: ${result.stderr.slice(0, 500)}`);
    }
    throw new TypeError(`${label} returned invalid JSON.`);
  }
  if (result.exitCode === 0 || record(parsed, 'Inspector call result').isError === true) {
    return parsed;
  }
  throw new Error(`${label} exited ${String(result.exitCode)}: ${result.stderr.slice(0, 500)}`);
}

export function safeRequestExcerpt(tool: P0McpToolName, argumentsValue: JsonRecord): JsonRecord {
  if (tool === 'get_canvas_context') return { canvas_id: argumentsValue.canvas_id };
  if (tool === 'get_run') return { run_id: argumentsValue.run_id };
  if (tool === 'quote_run') {
    return {
      canvas_id: argumentsValue.canvas_id,
      expected_revision_id: argumentsValue.expected_revision_id,
      idempotency_key: argumentsValue.idempotency_key,
    };
  }
  if (tool === 'start_run') {
    return {
      quote_id: argumentsValue.quote_id,
      confirmed: argumentsValue.confirmed ?? '<omitted>',
      confirmation_token:
        argumentsValue.confirmation_token === undefined ? '<omitted>' : '<redacted>',
      idempotency_key: argumentsValue.idempotency_key,
    };
  }
  const patch =
    typeof argumentsValue.patch === 'object' &&
    argumentsValue.patch !== null &&
    !Array.isArray(argumentsValue.patch)
      ? (argumentsValue.patch as JsonRecord)
      : {};
  return {
    canvas_id: argumentsValue.canvas_id,
    expected_revision_id: argumentsValue.expected_revision_id ?? '<omitted>',
    reason: argumentsValue.reason ?? '<omitted>',
    idempotency_key: argumentsValue.idempotency_key,
    patch_counts: {
      upsert_nodes: Array.isArray(patch.upsert_nodes) ? patch.upsert_nodes.length : 0,
      remove_node_ids: Array.isArray(patch.remove_node_ids) ? patch.remove_node_ids.length : 0,
      upsert_edges: Array.isArray(patch.upsert_edges) ? patch.upsert_edges.length : 0,
      remove_edge_ids: Array.isArray(patch.remove_edge_ids) ? patch.remove_edge_ids.length : 0,
    },
  };
}

function nodeStatusCounts(nodes: unknown): JsonRecord {
  if (!Array.isArray(nodes)) return {};
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) continue;
    const status = (node as JsonRecord).status;
    if (typeof status !== 'string') continue;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function safeEnvelopeExcerpt(tool: P0McpToolName, envelope: unknown): JsonRecord {
  const normalized = record(redactAndNormalize(envelope), 'normalized envelope');
  if (normalized.error !== undefined) return { error: normalized.error };
  const data = record(normalized.data, 'success data');
  if (tool === 'get_canvas_context') {
    const canvas = record(data.canvas, 'canvas');
    return {
      data: {
        canvas: {
          canvasId: canvas.canvasId,
          projectId: canvas.projectId,
          headRevisionId: canvas.headRevisionId,
          canonicalHash: canvas.canonicalHash,
        },
      },
    };
  }
  if (tool === 'apply_canvas_patch') {
    return {
      data: {
        canvasId: data.canvasId,
        revisionId: data.revisionId,
        canonicalHash: data.canonicalHash,
        affectedDescendants: data.affectedDescendants,
      },
    };
  }
  if (tool === 'quote_run') {
    const quote = record(data.quote, 'quote');
    return {
      data: {
        quote: {
          quoteId: quote.quoteId,
          maximumChargeMicros: quote.maximumChargeMicros,
          expiresAt: quote.expiresAt,
        },
        confirmationToken: '<redacted>',
      },
    };
  }
  const run = record(data.run, 'run');
  return {
    data: {
      run: {
        runId: run.runId,
        quoteId: run.quoteId,
        status: run.status,
        reservationId: run.reservationId,
      },
      ...(tool === 'get_run' ? { node_status_counts: nodeStatusCounts(data.nodes) } : {}),
    },
  };
}
