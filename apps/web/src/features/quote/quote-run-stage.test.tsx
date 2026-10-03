// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const RUN_ID = '0f3c2c2a-7f3a-4c7e-9a1b-2d4e6f8a0b1c';
const CANVAS_ID = '5b7d9f1a-3c5e-4a7b-8c9d-0e1f2a3b4c5d';

const search = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/studio/w/quote',
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));
vi.mock('../../lib/core/browser-client', () => ({
  createBrowserCoreClient: () => ({ request: () => new Promise(() => undefined) }),
}));

import { QuoteFlow } from '../../../app/(en)/studio/[workspace]/(workflow)/quote/quote-flow';

afterEach(cleanup);

describe('QuoteFlow after a confirmed run joins the link', () => {
  it('remounts straight into the run and never reads or creates another quote', () => {
    search.value = `canvas=${CANVAS_ID}&run=${RUN_ID}`;
    const read = vi.fn(() => new Promise<never>(() => undefined));
    render(
      <QuoteFlow
        workspace="22222222-2222-4222-8222-222222222222"
        dataMode="worker"
        canvasId={CANVAS_ID}
        quotePort={{ read, requote: read } as never}
        runStartPort={{ confirm: vi.fn() } as never}
      />,
    );
    expect(read).not.toHaveBeenCalled();
    expect(screen.queryByText('Review this run before spending')).toBeNull();
    expect(screen.queryByRole('button', { name: /Confirm/u })).toBeNull();
  });

  it('reads the quote when the link names no run', () => {
    search.value = `canvas=${CANVAS_ID}`;
    const read = vi.fn(() => new Promise<never>(() => undefined));
    render(
      <QuoteFlow
        workspace="22222222-2222-4222-8222-222222222222"
        dataMode="worker"
        canvasId={CANVAS_ID}
        quotePort={{ read, requote: read } as never}
        runStartPort={{ confirm: vi.fn() } as never}
      />,
    );
    expect(read).toHaveBeenCalledTimes(1);
  });
});
