// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformOutput } from '@mustbeviral/contracts';

const state = vi.hoisted(() => ({ actions: ['brand:read'] as string[] }));
vi.mock('./use-platform-query', () => ({
  usePlatformQuery: (operation: string) => ({
    loading: false,
    refresh: vi.fn(),
    data:
      operation === 'list_workspace_access_grants'
        ? {
            items: [
              {
                id: 'synthetic-grant',
                brand_id: 'synthetic-brand',
                actions: state.actions,
                status: 'active',
                version: 1,
              },
            ],
          }
        : operation === 'list_studios'
          ? { items: [{ id: 'synthetic-studio', name: 'Synthetic studio' }] }
          : {
              record: { id: 'synthetic-workspace', name: 'Synthetic workspace', status: 'active' },
            },
  }),
}));
vi.mock('./platform-mutation', () => ({
  usePlatformMutation: () => ({ pending: false, mutate: vi.fn() }),
}));

import { BrandSettings } from './brand-settings';

afterEach(cleanup);

describe('brand access permission copy', () => {
  it.each([
    [['brand:read'], 'Read brand details'],
    [['brand:read', 'brand:write'], 'Read brand details, Edit brand details'],
    [['brand:read', 'location:read'], 'Read brand details, Read locations'],
    [
      ['brand:read', 'brand:write', 'location:read', 'location:write'],
      'Read brand details, Edit brand details, Read locations, Edit locations',
    ],
  ])('describes %s without adding permissions or exposing internal keys', (actions, label) => {
    state.actions = actions;
    render(
      <BrandSettings
        studioId="synthetic-studio"
        brand={
          {
            id: 'synthetic-brand',
            workspace_id: 'synthetic-workspace',
            name: 'Synthetic brand',
          } as PlatformOutput<'get_brand'>['record']
        }
        workspaceOwner
        canWrite={false}
        refresh={vi.fn()}
      />,
    );
    expect(screen.getByText(label)).toBeTruthy();
    for (const action of actions) expect(screen.queryByText(new RegExp(action))).toBeNull();
    for (const other of [
      'Read brand details',
      'Edit brand details',
      'Read locations',
      'Edit locations',
    ])
      if (!label.includes(other)) expect(screen.queryByText(new RegExp(other))).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Save brand name' }).closest('fieldset')?.disabled,
    ).toBe(true);
  });
});
