export const CAMPAIGN_WORKSPACE_SENTINEL = 'campaign';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isCampaignWorkspaceSentinel(workspaceRef: string): boolean {
  return workspaceRef === CAMPAIGN_WORKSPACE_SENTINEL;
}

export function isWorkspaceUuid(workspaceRef: string): boolean {
  return UUID_PATTERN.test(workspaceRef);
}

export function shouldLookupWorkspace(workspaceRef: string): boolean {
  return !isCampaignWorkspaceSentinel(workspaceRef) && isWorkspaceUuid(workspaceRef);
}
