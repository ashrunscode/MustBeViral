import type { GraphSnapshot } from './index';

const node = (
  id: string,
  kind: GraphSnapshot['nodes'][number]['kind'],
  parameters: GraphSnapshot['nodes'][number]['parameters'] = {},
): GraphSnapshot['nodes'][number] => ({
  id,
  kind,
  parameter_schema_version: 1,
  parameters,
});

const edge = (
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
): GraphSnapshot['edges'][number] => ({
  id,
  kind: 'dependency',
  source_node_id: sourceNodeId,
  target_node_id: targetNodeId,
});

export const briefOnlyGraph: GraphSnapshot = {
  nodes: [node('brief', 'brief', { title: 'Summer launch' })],
  edges: [],
};

export const linearGraph: GraphSnapshot = {
  nodes: [
    node('planner', 'planner_text', { temperature: 0.7 }),
    node('brief', 'brief', { audience: 'existing customers' }),
  ],
  edges: [edge('brief-to-planner', 'brief', 'planner')],
};

export const diamondGraph: GraphSnapshot = {
  nodes: [
    node('export', 'output_export'),
    node('image-b', 'image_generation', { aspect_ratio: '4:5' }),
    node('brief', 'brief'),
    node('qa', 'qa'),
    node('image-a', 'image_generation', { aspect_ratio: '1:1' }),
    node('planner', 'planner_text'),
  ],
  edges: [
    edge('qa-to-export', 'qa', 'export'),
    edge('image-b-to-qa', 'image-b', 'qa'),
    edge('planner-to-image-b', 'planner', 'image-b'),
    edge('brief-to-planner', 'brief', 'planner'),
    edge('image-a-to-qa', 'image-a', 'qa'),
    edge('planner-to-image-a', 'planner', 'image-a'),
  ],
};

export interface CanonicalGraphDigestFixture {
  readonly name: string;
  readonly graph: GraphSnapshot;
  readonly canonical: string;
  readonly digest: string;
}

export const canonicalGraphDigestFixtures: readonly CanonicalGraphDigestFixture[] = [
  {
    name: 'brief-only',
    graph: briefOnlyGraph,
    canonical:
      '{"edges": [], "nodes": [{"id": "brief", "kind": "brief", "parameters": {"title": "Summer launch"}, "parameter_schema_version": 1}]}',
    digest: 'b09ab15ac7bb66478aeefdae909da7945fdda44a0bea71009835c19b74835609',
  },
  {
    name: 'linear-with-number-and-shuffled-nodes',
    graph: linearGraph,
    canonical:
      '{"edges": [{"id": "brief-to-planner", "kind": "dependency", "source_node_id": "brief", "target_node_id": "planner"}], "nodes": [{"id": "brief", "kind": "brief", "parameters": {"audience": "existing customers"}, "parameter_schema_version": 1}, {"id": "planner", "kind": "planner_text", "parameters": {"temperature": 0.7}, "parameter_schema_version": 1}]}',
    digest: '01b153d766dda3ecf55bad4b02ad84092e194019e0c02c13d66ab2c1ba0e4a2d',
  },
  {
    name: 'diamond-fan-out-with-shuffled-input',
    graph: diamondGraph,
    canonical:
      '{"edges": [{"id": "brief-to-planner", "kind": "dependency", "source_node_id": "brief", "target_node_id": "planner"}, {"id": "image-a-to-qa", "kind": "dependency", "source_node_id": "image-a", "target_node_id": "qa"}, {"id": "image-b-to-qa", "kind": "dependency", "source_node_id": "image-b", "target_node_id": "qa"}, {"id": "planner-to-image-a", "kind": "dependency", "source_node_id": "planner", "target_node_id": "image-a"}, {"id": "planner-to-image-b", "kind": "dependency", "source_node_id": "planner", "target_node_id": "image-b"}, {"id": "qa-to-export", "kind": "dependency", "source_node_id": "qa", "target_node_id": "export"}], "nodes": [{"id": "brief", "kind": "brief", "parameters": {}, "parameter_schema_version": 1}, {"id": "export", "kind": "output_export", "parameters": {}, "parameter_schema_version": 1}, {"id": "image-a", "kind": "image_generation", "parameters": {"aspect_ratio": "1:1"}, "parameter_schema_version": 1}, {"id": "image-b", "kind": "image_generation", "parameters": {"aspect_ratio": "4:5"}, "parameter_schema_version": 1}, {"id": "planner", "kind": "planner_text", "parameters": {}, "parameter_schema_version": 1}, {"id": "qa", "kind": "qa", "parameters": {}, "parameter_schema_version": 1}]}',
    digest: '5bdfa7bcd8a8e3cc273a049d07f1874ecf37b90a821d8ecf7ce7bda607dacff3',
  },
];
