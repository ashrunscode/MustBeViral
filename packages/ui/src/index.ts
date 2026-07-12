export const UI_IMPLEMENTATION_GATE = 'superdesign-approval-required' as const;

export function mayImplementProductionUi(approvedArtifactId?: string): boolean {
  return typeof approvedArtifactId === 'string' && approvedArtifactId.trim().length > 0;
}
