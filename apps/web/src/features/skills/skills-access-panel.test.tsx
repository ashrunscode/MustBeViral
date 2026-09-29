// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SkillsAccessPanel } from './skills-access-panel';

const client = vi.hoisted(() => ({
  listSkills: vi.fn(async () => [
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
  ]),
  listSkillVersions: vi.fn(async () => ({
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
  })),
  publishSkill: vi.fn(async () => ({
    skill_id: 'skill-1',
    skill_version_id: 'version-3',
    name: 'launch-copy',
    version_number: 3,
    title: 'Launch copy v3',
    published_at: '2026-08-31T13:00:00Z',
  })),
  listApiKeys: vi.fn(async () => []),
  createApiKey: vi.fn(async () => {
    throw new Error('not used');
  }),
  revokeApiKey: vi.fn(async () => undefined),
}));

vi.mock('../../lib/core/p1b-client', () => ({
  createP1bManagementClient: async () => client,
}));

afterEach(cleanup);

function alertsInDocument() {
  return document.querySelectorAll('[role="alert"]');
}

async function openPublishDialog() {
  render(<SkillsAccessPanel workspaceId="workspace-1" />);
  await screen.findByRole('button', { name: 'View history' });
  fireEvent.click(screen.getByRole('button', { name: 'Publish Skill' }));
  return screen.getByRole('dialog', { name: 'Publish a Skill version' });
}

describe('SkillsAccessPanel', () => {
  it('renders immutable version copy and credential boundary notice', () => {
    const html = renderToStaticMarkup(<SkillsAccessPanel workspaceId="workspace-1" />);
    expect(html).toContain('Skills and version history');
    expect(html).toContain('immutable');
    expect(html).toContain('cannot access database, storage, or billing credentials');
    expect(html).toContain('Publish Skill');
    expect(html).toContain('Loading skills');
  });

  it('keeps the publish dialog open and announces a failed publish inside it, once', async () => {
    client.publishSkill.mockRejectedValueOnce(new Error('Skill name is reserved.'));
    const dialog = await openPublishDialog();
    const publish = within(dialog).getByRole('button', { name: 'Publish version' });

    fireEvent.click(publish);

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe('Skill name is reserved.');
    expect(alert.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Publish a Skill version' })).toBe(dialog);
    expect(alertsInDocument()).toHaveLength(1);
  });

  it('announces a version-history failure after publishing inside the published dialog, once', async () => {
    const dialog = await openPublishDialog();
    client.listSkillVersions.mockRejectedValueOnce(new Error('Version history failed to load.'));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish version' }));

    const publishedDialog = await screen.findByRole('dialog', { name: 'Skill version published' });
    const alert = await within(publishedDialog).findByRole('alert');
    expect(alert.textContent).toBe('Version history failed to load.');
    expect(alertsInDocument()).toHaveLength(1);
  });

  it('keeps the page-level alert for a failure with no dialog open', async () => {
    client.listSkillVersions.mockRejectedValueOnce(new Error('Version history failed to load.'));
    render(<SkillsAccessPanel workspaceId="workspace-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'View history' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Version history failed to load.');
    expect(alert.closest('[role="dialog"]')).toBeNull();
    expect(alertsInDocument()).toHaveLength(1);
  });

  it('leaves an earlier page error on the page when the publish dialog opens', async () => {
    client.listSkillVersions.mockRejectedValueOnce(new Error('Version history failed to load.'));
    render(<SkillsAccessPanel workspaceId="workspace-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'View history' }));
    const pageAlert = await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Publish Skill' }));

    const dialog = screen.getByRole('dialog', { name: 'Publish a Skill version' });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(pageAlert.isConnected).toBe(true);
    expect(alertsInDocument()).toHaveLength(1);

    client.publishSkill.mockRejectedValueOnce(new Error('Skill name is reserved.'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish version' }));
    const dialogAlert = await within(dialog).findByRole('alert');
    expect(dialogAlert.textContent).toBe('Skill name is reserved.');
    expect(alertsInDocument()).toHaveLength(1);
  });
});
