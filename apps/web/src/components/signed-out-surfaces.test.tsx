import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio/campaign/brief',
}));

import { LandingPage } from './landing-page';
import { StatusScreen } from './status-screen';
import { StudioWorkflowNav, workflowStepIsActive } from './studio-workflow-nav';

describe('workflowStepIsActive', () => {
  it('marks compare under review', () => {
    expect(workflowStepIsActive('compare', 'review')).toBe(true);
    expect(workflowStepIsActive('review', 'review')).toBe(true);
    expect(workflowStepIsActive('compare', 'receipt')).toBe(false);
  });
});

describe('LandingPage', () => {
  it('names the launch-pack value and honest enrollment path', () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain('Meta Campaign Launch Pack');
    expect(html).toContain('named price before any provider spend');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('Request access');
    expect(html).toContain('Sign in to Studio');
  });
});

describe('StatusScreen', () => {
  it('renders closed enrollment without a signup form', () => {
    const html = renderToStaticMarkup(
      <StatusScreen title="Enrollment is closed" actions={[{ href: '/login', label: 'Sign in' }]}>
        <p>Self-service signup is not enabled.</p>
      </StatusScreen>,
    );
    expect(html).toContain('Enrollment is closed');
    expect(html).toContain('Self-service signup is not enabled.');
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('Create account');
  });
});

describe('StudioWorkflowNav', () => {
  it('exposes keyboard-focusable workflow links for every P0 step', () => {
    const html = renderToStaticMarkup(<StudioWorkflowNav workspace="campaign" />);
    expect(html).toContain('href="/studio/campaign/brief"');
    expect(html).toContain('href="/studio/campaign/canvas"');
    expect(html).toContain('href="/studio/campaign/quote"');
    expect(html).toContain('href="/studio/campaign/review"');
    expect(html).toContain('href="/studio/campaign/receipt"');
    expect(html).toContain('href="/studio/campaign/billing"');
    expect(html).toContain('aria-label="Campaign workflow"');
    expect(html).toContain('studio-workflow-nav__link--active');
  });
});
