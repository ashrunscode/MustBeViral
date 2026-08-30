import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio/workspace-1/review/compare',
  useSearchParams: () => new URLSearchParams('run=run-1&left=artifact-a&right=artifact-b'),
}));

import { SessionExpiredAction } from './session-expired-action';

describe('SessionExpiredAction', () => {
  it('fails closed with the exact current Studio path and query as login continuation', () => {
    const html = renderToStaticMarkup(<SessionExpiredAction />);

    expect(html).toContain('data-result="session_expired"');
    expect(html).toContain('No pending action was replayed.');
    expect(html).toContain(
      'href="/login?next=%2Fstudio%2Fworkspace-1%2Freview%2Fcompare%3Frun%3Drun-1%26left%3Dartifact-a%26right%3Dartifact-b"',
    );
  });
});
