// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/studio',
  useSearchParams: () => new URLSearchParams(),
}));

const platformRequest = vi.fn();
vi.mock('./platform-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('./platform-client')>();
  return { ...original, platformRequest: (...args: unknown[]) => platformRequest(...args) };
});

import { NewBrandForm } from './studio-sections';

afterEach(() => {
  cleanup();
  platformRequest.mockReset();
  push.mockReset();
});

describe('NewBrandForm', () => {
  it('sends one start_brand_draft for two rapid submits and stays locked after success', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    platformRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(<NewBrandForm studioId="11111111-1111-4111-8111-111111111111" />);
    const input = screen.getByLabelText('Brand name');
    fireEvent.change(input, { target: { value: 'WashBodega' } });
    const form = input.closest('form');
    if (form === null) throw new Error('form missing');
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(platformRequest).toHaveBeenCalledTimes(1);
    expect(platformRequest.mock.calls[0]?.[0]).toBe('start_brand_draft');
    expect(screen.getByRole('button', { name: 'Saving your new brand…' })).toBeTruthy();
    await act(async () => {
      resolveRequest({
        brand: {
          id: '33333333-3333-4333-8333-333333333333',
          workspace_id: '22222222-2222-4222-8222-222222222222',
        },
      });
    });
    // A third submit after the answer, before navigation lands, must not start another brand.
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(platformRequest).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Opening your new brand…' })).toBeTruthy();
    expect(screen.getByLabelText('Brand name').matches(':disabled')).toBe(true);
  });
});
