import { describe, expect, it } from 'vitest';

import {
  briefOnlyGraph,
  canonicalGraphDigestFixtures,
  diamondGraph,
  linearGraph,
} from './fixtures';
import {
  affectedDescendants,
  assertValidGraph,
  canonicalizeGraph,
  GraphValidationError,
  hashCanonicalGraph,
  isGraphEdgeKind,
  isGraphNodeKind,
  serializeCanonicalGraph,
  serializePostgresJsonb,
  sha256PostgresJsonb,
  validateGraph,
  type GraphSnapshot,
  type JsonValue,
} from './index';

const issueCodes = (snapshot: unknown): readonly string[] => {
  const result = validateGraph(snapshot);
  return result.valid ? [] : result.issues.map((issue) => issue.code);
};

describe('P0 graph type boundary', () => {
  it('accepts approved kinds and rejects deferred kinds', () => {
    expect(isGraphNodeKind('image_generation')).toBe(true);
    expect(isGraphNodeKind('audio_generation')).toBe(false);
    expect(isGraphEdgeKind('dependency')).toBe(true);
    expect(isGraphEdgeKind('loop')).toBe(false);
  });

  it('rejects malformed node and edge payloads before graph checks', () => {
    expect(
      issueCodes({
        nodes: [
          {
            id: 'brief',
            kind: 'audio_generation',
            parameter_schema_version: 1,
            parameters: {},
          },
        ],
        edges: [{ id: 'edge', kind: 'loop', source_node_id: 'a', target_node_id: 'b' }],
      }),
    ).toEqual(['INVALID_NODE_KIND', 'INVALID_EDGE_KIND']);
  });
});

describe('graph validation', () => {
  it.each([
    ['brief-only', briefOnlyGraph],
    ['linear', linearGraph],
    ['diamond', diamondGraph],
  ])('accepts the valid %s fixture', (_name, graph) => {
    expect(validateGraph(graph)).toEqual({ valid: true, issues: [] });
    expect(() => assertValidGraph(graph)).not.toThrow();
  });

  it('rejects missing endpoints, duplicate ids, and illegal edge pairs', () => {
    const graph = {
      nodes: [
        {
          id: 'brief',
          kind: 'brief',
          parameter_schema_version: 1,
          parameters: {},
        },
        {
          id: 'brief',
          kind: 'brief',
          parameter_schema_version: 1,
          parameters: {},
        },
        {
          id: 'planner',
          kind: 'planner_text',
          parameter_schema_version: 1,
          parameters: {},
        },
      ],
      edges: [
        {
          id: 'duplicate',
          kind: 'dependency',
          source_node_id: 'planner',
          target_node_id: 'brief',
        },
        {
          id: 'duplicate',
          kind: 'dependency',
          source_node_id: 'missing',
          target_node_id: 'planner',
        },
      ],
    };

    expect(issueCodes(graph)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_NODE_ID',
        'ILLEGAL_EDGE',
        'DUPLICATE_EDGE_ID',
        'EDGE_ENDPOINT_NOT_FOUND',
        'MULTIPLE_BRIEF_ROOTS',
      ]),
    );
  });

  it('rejects cycles and self edges', () => {
    const editNode = (id: string) => ({
      id,
      kind: 'image_edit' as const,
      parameter_schema_version: 1,
      parameters: {},
    });
    const graph: GraphSnapshot = {
      nodes: [
        {
          id: 'brief',
          kind: 'brief',
          parameter_schema_version: 1,
          parameters: {},
        },
        {
          id: 'planner',
          kind: 'planner_text',
          parameter_schema_version: 1,
          parameters: {},
        },
        editNode('edit-a'),
        editNode('edit-b'),
      ],
      edges: [
        {
          id: 'brief-planner',
          kind: 'dependency',
          source_node_id: 'brief',
          target_node_id: 'planner',
        },
        {
          id: 'planner-edit-a',
          kind: 'dependency',
          source_node_id: 'planner',
          target_node_id: 'edit-a',
        },
        {
          id: 'edit-a-edit-b',
          kind: 'dependency',
          source_node_id: 'edit-a',
          target_node_id: 'edit-b',
        },
        {
          id: 'edit-b-edit-a',
          kind: 'dependency',
          source_node_id: 'edit-b',
          target_node_id: 'edit-a',
        },
        {
          id: 'self',
          kind: 'dependency',
          source_node_id: 'edit-a',
          target_node_id: 'edit-a',
        },
      ],
    };

    expect(issueCodes(graph)).toEqual(expect.arrayContaining(['CYCLE', 'SELF_EDGE']));
  });

  it('enforces exactly one brief root and reachability from it', () => {
    const noBrief = {
      nodes: [
        {
          id: 'planner',
          kind: 'planner_text',
          parameter_schema_version: 1,
          parameters: {},
        },
      ],
      edges: [],
    };
    expect(issueCodes(noBrief)).toContain('BRIEF_ROOT_REQUIRED');

    const disconnected = {
      nodes: [
        {
          id: 'brief',
          kind: 'brief',
          parameter_schema_version: 1,
          parameters: {},
        },
        {
          id: 'planner',
          kind: 'planner_text',
          parameter_schema_version: 1,
          parameters: {},
        },
      ],
      edges: [],
    };
    expect(issueCodes(disconnected)).toEqual(
      expect.arrayContaining(['NON_BRIEF_ROOT', 'UNREACHABLE_NODE']),
    );
  });

  it('throws one typed aggregate error', () => {
    expect(() => assertValidGraph({ nodes: [], edges: [] })).toThrow(GraphValidationError);
  });
});

describe('PostgreSQL jsonb canonical serialization and hashing', () => {
  it('uses jsonb key ordering, spacing, nested values, and numeric expansion', () => {
    const value: JsonValue = {
      list: [3, null, false],
      z: 1,
      a: { long_key: true, b: 'x' },
    };
    expect(serializePostgresJsonb(value)).toBe(
      '{"a": {"b": "x", "long_key": true}, "z": 1, "list": [3, null, false]}',
    );
    expect(serializePostgresJsonb({ emoji: 'viral 🚀', n: 1e-7 })).toBe(
      '{"n": 0.0000001, "emoji": "viral 🚀"}',
    );
  });

  it('rejects values that PostgreSQL jsonb cannot represent', () => {
    expect(() => serializePostgresJsonb(Number.NaN)).toThrow(TypeError);
    expect(() => serializePostgresJsonb(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it.each(canonicalGraphDigestFixtures)(
    'locks the DB-compatible $name digest',
    async ({ graph, canonical, digest }) => {
      expect(serializeCanonicalGraph(graph)).toBe(canonical);
      await expect(hashCanonicalGraph(graph)).resolves.toBe(digest);
    },
  );

  it('locks independent jsonb digest vectors', async () => {
    await expect(sha256PostgresJsonb({})).resolves.toBe(
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
    await expect(sha256PostgresJsonb({ nodes: [], edges: [] })).resolves.toBe(
      'f5f601586348141cb59f4afc4fab6c1a56cf15d36b9b45c2bfbfcc92b9154bcc',
    );
    await expect(
      sha256PostgresJsonb({
        list: [3, null, false],
        z: 1,
        a: { long_key: true, b: 'x' },
      }),
    ).resolves.toBe('9f43020073e0272fc7a4d93f3f7ed15d14f37171746c01e9d891182ec0f6fc2e');
  });

  it('normalizes node and edge array order without mutating input', () => {
    const canonical = canonicalizeGraph(diamondGraph);
    expect(canonical.nodes.map((node) => node.id)).toEqual([
      'brief',
      'export',
      'image-a',
      'image-b',
      'planner',
      'qa',
    ]);
    expect(canonical.edges.map((edge) => edge.id)).toEqual([
      'brief-to-planner',
      'image-a-to-qa',
      'image-b-to-qa',
      'planner-to-image-a',
      'planner-to-image-b',
      'qa-to-export',
    ]);
    expect(diamondGraph.nodes[0]?.id).toBe('export');
  });
});

describe('affected descendant calculation', () => {
  it('returns stable fan-out descendants', () => {
    expect(affectedDescendants(diamondGraph, ['planner'])).toEqual([
      'export',
      'image-a',
      'image-b',
      'qa',
    ]);
  });

  it('deduplicates the convergence of a diamond', () => {
    expect(affectedDescendants(diamondGraph, ['image-a', 'image-b'])).toEqual(['export', 'qa']);
  });

  it('excludes changed nodes and rejects unknown ids', () => {
    expect(affectedDescendants(diamondGraph, ['qa'])).toEqual(['export']);
    expect(() => affectedDescendants(diamondGraph, ['missing'])).toThrow(RangeError);
  });
});
