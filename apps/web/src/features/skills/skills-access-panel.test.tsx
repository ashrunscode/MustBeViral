import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SkillsAccessPanel } from './skills-access-panel';

vi.mock('../../lib/core/p1b-client', () => ({
  createP1bManagementClient: async () => ({
    listSkills: async () => [
      {
        id: 'skill-1',
        name: 'launch-copy',
        latest_version: {
          skill_id: 'skill-1',
          skill_version_id: 'version-2',
          name: 'launch-copy',
          version_number: 2,
          title: 'Launch copy v2',
          published_at: '2026-08-31T12:00:00Z',
        },
      },
    ],
    listSkillVersions: async () => ({
      skill_id: 'skill-1',
      name: 'launch-copy',
      versions: [
        {
          skill_id: 'skill-1',
          skill_version_id: 'version-2',
          version_number: 2,
          title: 'Launch copy v2',
          instructions: 'Write concise launch copy.',
          published_at: '2026-08-31T12:00:00Z',
        },
        {
          skill_id: 'skill-1',
          skill_version_id: 'version-1',
          version_number: 1,
          title: 'Launch copy v1',
          instructions: 'Original launch copy.',
          published_at: '2026-08-30T12:00:00Z',
        },
      ],
    }),
    publishSkill: async () => ({
      skill_id: 'skill-1',
      skill_version_id: 'version-3',
      name: 'launch-copy',
      version_number: 3,
      title: 'Launch copy v3',
      published_at: '2026-08-31T13:00:00Z',
    }),
    listApiKeys: async () => [],
    createApiKey: async () => {
      throw new Error('not used');
    },
    revokeApiKey: async () => undefined,
  }),
}));

describe('SkillsAccessPanel', () => {
  it('renders immutable version copy and credential boundary notice', () => {
    const html = renderToStaticMarkup(<SkillsAccessPanel workspaceId="workspace-1" />);
    expect(html).toContain('Skills and version history');
    expect(html).toContain('immutable');
    expect(html).toContain('cannot access database, storage, or billing credentials');
    expect(html).toContain('Publish Skill');
    expect(html).toContain('Loading skills');
  });
});
