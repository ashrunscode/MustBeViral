export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const graphNodeKinds = [
  'brief',
  'brand_context',
  'planner_text',
  'image_generation',
  'image_edit',
  'video_generation',
  'qa',
  'output_export',
  'group',
] as const;

export const graphEdgeKinds = ['dependency'] as const;

export type GraphNodeKind = (typeof graphNodeKinds)[number];
export type GraphEdgeKind = (typeof graphEdgeKinds)[number];

export interface GraphNode {
  readonly id: string;
  readonly kind: GraphNodeKind;
  readonly parameter_schema_version: number;
  readonly parameters: Readonly<Record<string, JsonValue>>;
}

export interface GraphEdge {
  readonly id: string;
  readonly kind: GraphEdgeKind;
  readonly source_node_id: string;
  readonly target_node_id: string;
}

export interface GraphSnapshot {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export function isGraphNodeKind(value: string): value is GraphNodeKind {
  return graphNodeKinds.some((candidate) => candidate === value);
}

export function isGraphEdgeKind(value: string): value is GraphEdgeKind {
  return graphEdgeKinds.some((candidate) => candidate === value);
}

const legalDependencyTargets = {
  brief: [],
  brand_context: ['brief'],
  planner_text: ['brief', 'brand_context'],
  image_generation: ['brief', 'brand_context', 'planner_text'],
  image_edit: ['brief', 'brand_context', 'planner_text', 'image_generation', 'image_edit'],
  video_generation: ['brief', 'brand_context', 'planner_text', 'image_generation', 'image_edit'],
  qa: ['planner_text', 'image_generation', 'image_edit', 'video_generation'],
  output_export: ['planner_text', 'image_generation', 'image_edit', 'video_generation', 'qa'],
  group: [],
} as const satisfies Readonly<Record<GraphNodeKind, readonly GraphNodeKind[]>>;

export const dependencyLegalityTable: Readonly<Record<GraphNodeKind, readonly GraphNodeKind[]>> =
  legalDependencyTargets;

export type GraphValidationIssueCode =
  | 'INVALID_SNAPSHOT'
  | 'INVALID_NODE'
  | 'INVALID_NODE_KIND'
  | 'INVALID_EDGE'
  | 'INVALID_EDGE_KIND'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'EDGE_ENDPOINT_NOT_FOUND'
  | 'SELF_EDGE'
  | 'ILLEGAL_EDGE'
  | 'CYCLE'
  | 'BRIEF_ROOT_REQUIRED'
  | 'MULTIPLE_BRIEF_ROOTS'
  | 'NON_BRIEF_ROOT'
  | 'UNREACHABLE_NODE';

export interface GraphValidationIssue {
  readonly code: GraphValidationIssueCode;
  readonly message: string;
  readonly node_id?: string;
  readonly edge_id?: string;
}

export type GraphValidationResult =
  | { readonly valid: true; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly GraphValidationIssue[] };

export class GraphValidationError extends Error {
  readonly code = 'GRAPH_INVALID';

  constructor(readonly issues: readonly GraphValidationIssue[]) {
    super(`Graph validation failed with ${String(issues.length)} issue(s)`);
    this.name = 'GraphValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function validateNode(value: unknown): value is GraphNode {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.kind === 'string' &&
    isGraphNodeKind(value.kind) &&
    Number.isInteger(value.parameter_schema_version) &&
    Number(value.parameter_schema_version) > 0 &&
    isRecord(value.parameters) &&
    isJsonValue(value.parameters)
  );
}

function validateEdge(value: unknown): value is GraphEdge {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.kind === 'string' &&
    isGraphEdgeKind(value.kind) &&
    typeof value.source_node_id === 'string' &&
    value.source_node_id.length > 0 &&
    typeof value.target_node_id === 'string' &&
    value.target_node_id.length > 0
  );
}

function nodeIssue(value: unknown, index: number): GraphValidationIssue {
  if (isRecord(value) && typeof value.kind === 'string') {
    if (!isGraphNodeKind(value.kind)) {
      return {
        code: 'INVALID_NODE_KIND',
        message: `Node at index ${String(index)} has an unsupported kind`,
      };
    }
  }
  return {
    code: 'INVALID_NODE',
    message: `Node at index ${String(index)} is malformed`,
  };
}

function edgeIssue(value: unknown, index: number): GraphValidationIssue {
  if (isRecord(value) && typeof value.kind === 'string') {
    if (!isGraphEdgeKind(value.kind)) {
      return {
        code: 'INVALID_EDGE_KIND',
        message: `Edge at index ${String(index)} has an unsupported kind`,
      };
    }
  }
  return {
    code: 'INVALID_EDGE',
    message: `Edge at index ${String(index)} is malformed`,
  };
}

function findCycle(
  nodeIds: readonly string[],
  outgoing: ReadonlyMap<string, readonly string[]>,
): readonly string[] | undefined {
  const visited = new Set<string>();
  const active = new Set<string>();
  const path: string[] = [];

  const visit = (nodeId: string): readonly string[] | undefined => {
    if (active.has(nodeId)) {
      const start = path.indexOf(nodeId);
      return [...path.slice(start), nodeId];
    }
    if (visited.has(nodeId)) {
      return undefined;
    }

    visited.add(nodeId);
    active.add(nodeId);
    path.push(nodeId);
    for (const targetId of outgoing.get(nodeId) ?? []) {
      const cycle = visit(targetId);
      if (cycle !== undefined) {
        return cycle;
      }
    }
    path.pop();
    active.delete(nodeId);
    return undefined;
  };

  for (const nodeId of nodeIds) {
    const cycle = visit(nodeId);
    if (cycle !== undefined) {
      return cycle;
    }
  }
  return undefined;
}

export function validateGraph(snapshot: unknown): GraphValidationResult {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
    return {
      valid: false,
      issues: [
        {
          code: 'INVALID_SNAPSHOT',
          message: 'Graph snapshot must contain node and edge arrays',
        },
      ],
    };
  }

  const issues: GraphValidationIssue[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  snapshot.nodes.forEach((node, index) => {
    if (validateNode(node)) {
      nodes.push(node);
    } else {
      issues.push(nodeIssue(node, index));
    }
  });
  snapshot.edges.forEach((edge, index) => {
    if (validateEdge(edge)) {
      edges.push(edge);
    } else {
      issues.push(edgeIssue(edge, index));
    }
  });

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  const nodesById = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node id: ${node.id}`,
        node_id: node.id,
      });
    } else {
      nodesById.set(node.id, node);
    }
  }

  const edgeIds = new Set<string>();
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        code: 'DUPLICATE_EDGE_ID',
        message: `Duplicate edge id: ${edge.id}`,
        edge_id: edge.id,
      });
    }
    edgeIds.add(edge.id);

    const source = nodesById.get(edge.source_node_id);
    const target = nodesById.get(edge.target_node_id);
    if (source === undefined || target === undefined) {
      issues.push({
        code: 'EDGE_ENDPOINT_NOT_FOUND',
        message: `Edge ${edge.id} references a missing endpoint`,
        edge_id: edge.id,
      });
      continue;
    }
    if (source.id === target.id) {
      issues.push({
        code: 'SELF_EDGE',
        message: `Edge ${edge.id} cannot reference one node twice`,
        edge_id: edge.id,
      });
      continue;
    }
    if (!legalDependencyTargets[target.kind].includes(source.kind as never)) {
      issues.push({
        code: 'ILLEGAL_EDGE',
        message: `${source.kind} cannot be a dependency of ${target.kind}`,
        edge_id: edge.id,
      });
      continue;
    }

    const targets = outgoing.get(source.id) ?? [];
    targets.push(target.id);
    outgoing.set(source.id, targets);
    incomingCount.set(target.id, (incomingCount.get(target.id) ?? 0) + 1);
  }

  const cycle = findCycle(
    nodes.map((node) => node.id),
    outgoing,
  );
  if (cycle !== undefined) {
    issues.push({
      code: 'CYCLE',
      message: `Graph contains a cycle: ${cycle.join(' -> ')}`,
    });
  }

  const executableNodes = nodes.filter((node) => node.kind !== 'group');
  const briefNodes = executableNodes.filter((node) => node.kind === 'brief');
  if (briefNodes.length === 0) {
    issues.push({
      code: 'BRIEF_ROOT_REQUIRED',
      message: 'Graph requires exactly one brief root',
    });
  } else if (briefNodes.length > 1) {
    issues.push({
      code: 'MULTIPLE_BRIEF_ROOTS',
      message: 'Graph cannot contain more than one brief root',
    });
  }

  const root = briefNodes[0];
  if (root !== undefined) {
    for (const node of executableNodes) {
      if (node.id !== root.id && (incomingCount.get(node.id) ?? 0) === 0) {
        issues.push({
          code: 'NON_BRIEF_ROOT',
          message: `Only the brief may be an executable root: ${node.id}`,
          node_id: node.id,
        });
      }
    }

    const reachable = new Set<string>();
    const queue = [root.id];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (nodeId === undefined || reachable.has(nodeId)) {
        continue;
      }
      reachable.add(nodeId);
      queue.push(...(outgoing.get(nodeId) ?? []));
    }
    for (const node of executableNodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          code: 'UNREACHABLE_NODE',
          message: `Node is not reachable from the brief root: ${node.id}`,
          node_id: node.id,
        });
      }
    }
  }

  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

export function assertValidGraph(snapshot: unknown): asserts snapshot is GraphSnapshot {
  const result = validateGraph(snapshot);
  if (!result.valid) {
    throw new GraphValidationError(result.issues);
  }
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return leftBytes.length - rightBytes.length;
  }
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function compareUtf8Bytewise(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return leftBytes.length - rightBytes.length;
}

function postgresNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError('PostgreSQL jsonb does not accept non-finite numbers');
  }
  if (Object.is(value, -0)) {
    return '0';
  }

  const source = String(value);
  if (!/[eE]/u.test(source)) {
    return source;
  }

  const [coefficient = '', exponentText = '0'] = source.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const negative = coefficient.startsWith('-');
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integer = '', fraction = ''] = unsigned.split('.');
  const digits = `${integer}${fraction}`;
  const decimalPosition = integer.length + exponent;
  let expanded: string;

  if (decimalPosition <= 0) {
    expanded = `0.${'0'.repeat(-decimalPosition)}${digits}`;
  } else if (decimalPosition >= digits.length) {
    expanded = `${digits}${'0'.repeat(decimalPosition - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }
  return negative ? `-${expanded}` : expanded;
}

/**
 * Mirrors PostgreSQL `jsonb::text`: object keys use jsonb's UTF-8 byte-length
 * then bytewise ordering, and values use PostgreSQL's spaces after separators.
 */
export function serializePostgresJsonb(value: JsonValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return postgresNumber(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializePostgresJsonb).join(', ')}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) => compareUtf8(left, right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}: ${serializePostgresJsonb(entryValue)}`)
    .join(', ')}}`;
}

function compareEdges(left: GraphEdge, right: GraphEdge): number {
  return (
    compareUtf8Bytewise(left.source_node_id, right.source_node_id) ||
    compareUtf8Bytewise(left.target_node_id, right.target_node_id) ||
    compareUtf8Bytewise(left.kind, right.kind) ||
    compareUtf8Bytewise(left.id, right.id)
  );
}

export function canonicalizeGraph(snapshot: GraphSnapshot): GraphSnapshot {
  assertValidGraph(snapshot);
  return {
    nodes: [...snapshot.nodes].sort((left, right) => compareUtf8Bytewise(left.id, right.id)),
    edges: [...snapshot.edges].sort(compareEdges),
  };
}

function graphAsJsonValue(snapshot: GraphSnapshot): JsonValue {
  return {
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      parameters: { ...node.parameters },
      parameter_schema_version: node.parameter_schema_version,
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      kind: edge.kind,
      source_node_id: edge.source_node_id,
      target_node_id: edge.target_node_id,
    })),
  };
}

export function serializeCanonicalGraph(snapshot: GraphSnapshot): string {
  return serializePostgresJsonb(graphAsJsonValue(canonicalizeGraph(snapshot)));
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256PostgresJsonb(value: JsonValue): Promise<string> {
  const serialized = serializePostgresJsonb(value);
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized),
  );
  return toHex(digest);
}

export async function hashCanonicalGraph(snapshot: GraphSnapshot): Promise<string> {
  const canonical = graphAsJsonValue(canonicalizeGraph(snapshot));
  return sha256PostgresJsonb(canonical);
}

export function affectedDescendants(
  snapshot: GraphSnapshot,
  changedNodeIds: readonly string[],
): readonly string[] {
  assertValidGraph(snapshot);
  const nodeIds = new Set(snapshot.nodes.map((node) => node.id));
  const unknownIds = changedNodeIds.filter((nodeId) => !nodeIds.has(nodeId));
  if (unknownIds.length > 0) {
    throw new RangeError(`Unknown changed node id(s): ${unknownIds.join(', ')}`);
  }

  const changed = new Set(changedNodeIds);
  const outgoing = new Map<string, string[]>();
  for (const edge of snapshot.edges) {
    const targets = outgoing.get(edge.source_node_id) ?? [];
    targets.push(edge.target_node_id);
    outgoing.set(edge.source_node_id, targets);
  }

  const affected = new Set<string>();
  const queue = [...changed];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined) {
      continue;
    }
    for (const targetId of outgoing.get(nodeId) ?? []) {
      if (!changed.has(targetId) && !affected.has(targetId)) {
        affected.add(targetId);
        queue.push(targetId);
      }
    }
  }
  return [...affected].sort(compareUtf8Bytewise);
}
