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

export type GraphNodeKind = (typeof graphNodeKinds)[number];

export function isGraphNodeKind(value: string): value is GraphNodeKind {
  return graphNodeKinds.some((candidate) => candidate === value);
}
