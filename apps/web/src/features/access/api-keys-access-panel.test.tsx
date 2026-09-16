// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiKeysAccessPanel } from './api-keys-access-panel';

const client = vi.hoisted(() => ({
  listApiKeys: vi.fn(async () => [
    {
      id: 'key-1',
      name: 'CI automation',
      prefix: 'mbv_sk_abcd',
      scopes: ['run:read'],
      created_at: '2026-08-31T12:00:00Z',
      last_used_at: null,
      revoked_at: null,
    },
    {
      id: 'key-2',
      name: 'Retired key',
      prefix: 'mbv_sk_dead',
      scopes: ['canvas:read'],
      created_at: '2026-08-30T12:00:00Z',
      last_used_at: '2026-08-31T10:00:00Z',
      revoked_at: '2026-08-31T11:00:00Z',
    },
  ]),
  createApiKey: vi.fn(async () => ({
    secret: 'mbv_sk_' + 'a'.repeat(64),
    key: {
      id: 'key-3',
      name: 'New',
      prefix: 'mbv_sk_new',
      scopes: ['run:read'],
      created_at: '2026-08-31T13:00:00Z',
      last_used_at: null,
      revoked_at: null,
    },
  })),
  revokeApiKey: vi.fn(async () => undefined),
}));

vi.mock('../../lib/core/p1b-client', () => ({
  createP1bManagementClient: async () => client,
}));

afterEach(cleanup);

function alertsInDocument() {
  return document.querySelectorAll('[role="alert"]');
}

async function openCreateDialog() {
  render(<ApiKeysAccessPanel workspaceId="workspace-1" />);
  await screen.findByText('CI automation');
  fireEvent.click(screen.getByRole('button', { name: 'Create API key' }));
  return screen.getByRole('dialog', { name: 'Create scoped API key' });
}

describe('ApiKeysAccessPanel', () => {
  it('renders audit shell and non-autonomous spend copy', () => {
    const html = renderToStaticMarkup(<ApiKeysAccessPanel workspaceId="workspace-1" />);
    expect(html).toContain('API keys and audit');
    expect(html).toContain('Loading keys');
    expect(html).toContain('cannot bypass quote confirmation');
    expect(html).toContain('Create API key');
  });

  it('keeps the create dialog open and announces a failed create inside it, once', async () => {
    client.createApiKey.mockRejectedValueOnce(new Error('Core rejected the requested scopes.'));
    const dialog = await openCreateDialog();
    const issue = within(dialog).getByRole('button', { name: 'Issue key' });

    fireEvent.click(issue);

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toBe('Core rejected the requested scopes.');
    expect(alert.compareDocumentPosition(issue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Create scoped API key' })).toBe(dialog);
    expect(alertsInDocument()).toHaveLength(1);
  });

  it('announces a key-list refresh failure inside the one-time secret dialog, once', async () => {
    const dialog = await openCreateDialog();
    client.listApiKeys.mockRejectedValueOnce(new Error('Key list refresh failed.'));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Issue key' }));

    const secretDialog = await screen.findByRole('dialog', { name: 'Copy your API key now' });
    const alert = await within(secretDialog).findByRole('alert');
    expect(alert.textContent).toBe('Key list refresh failed.');
    expect(alertsInDocument()).toHaveLength(1);
  });

  it('keeps the page-level alert for a failure with no dialog open', async () => {
    client.revokeApiKey.mockRejectedValueOnce(new Error('Revocation failed.'));
    render(<ApiKeysAccessPanel workspaceId="workspace-1" />);
    await screen.findByText('CI automation');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Revocation failed.');
    expect(alert.closest('[role="dialog"]')).toBeNull();
    expect(alertsInDocument()).toHaveLength(1);
  });

  it('leaves an earlier page error on the page when the create dialog opens', async () => {
    client.revokeApiKey.mockRejectedValueOnce(new Error('Revocation failed.'));
    render(<ApiKeysAccessPanel workspaceId="workspace-1" />);
    await screen.findByText('CI automation');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const pageAlert = await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }));

    const dialog = screen.getByRole('dialog', { name: 'Create scoped API key' });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(pageAlert.isConnected).toBe(true);
    expect(alertsInDocument()).toHaveLength(1);

    client.createApiKey.mockRejectedValueOnce(new Error('Core rejected the requested scopes.'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Issue key' }));
    const dialogAlert = await within(dialog).findByRole('alert');
    expect(dialogAlert.textContent).toBe('Core rejected the requested scopes.');
    expect(alertsInDocument()).toHaveLength(1);
  });
});
