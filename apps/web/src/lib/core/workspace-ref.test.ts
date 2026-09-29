import { describe, expect, it } from 'vitest';

import {
  isCampaignWorkspaceSentinel,
  isWorkspaceUuid,
  shouldLookupWorkspace,
} from './workspace-ref';

describe('authenticated workspace references', () => {
  it('reserves only the exact campaign sentinel and suppresses its membership lookup', () => {
    expect(isCampaignWorkspaceSentinel('campaign')).toBe(true);
    expect(shouldLookupWorkspace('campaign')).toBe(false);
    expect(isCampaignWorkspaceSentinel('Campaign')).toBe(false);
    expect(shouldLookupWorkspace('campaign-typo')).toBe(false);
  });

  it('allows membership lookup only for real UUID workspace references', () => {
    const workspaceId = '10000000-0000-4000-8000-000000000001';
    expect(isWorkspaceUuid(workspaceId)).toBe(true);
    expect(shouldLookupWorkspace(workspaceId)).toBe(true);
    expect(isWorkspaceUuid('not-a-workspace')).toBe(false);
  });
});
