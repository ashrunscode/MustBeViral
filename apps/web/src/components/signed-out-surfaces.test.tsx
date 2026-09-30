import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio/campaign/brief',
}));

import SignUpPage from '../../app/signup/page';
import { SoftwareLanding } from './software-landing';
import { SoftwarePricing } from './software-pricing';
import { StatusScreen } from './status-screen';
import { StudioLanding } from './studio-landing';
import { StudioWorkflowNav, workflowStepIsActive } from './studio-workflow-nav';

describe('workflowStepIsActive', () => {
  it('marks compare under review', () => {
    expect(workflowStepIsActive('compare', 'review')).toBe(true);
    expect(workflowStepIsActive('review', 'review')).toBe(true);
    expect(workflowStepIsActive('compare', 'receipt')).toBe(false);
  });
});

const banned = [
  'AI-powered',
  'Request access',
  'Meta Campaign Launch Pack',
  'MustBeViral',
  '$500',
  'solutions',
];

describe('StudioLanding', () => {
  it('tells a Houston owner the gap, the two prices, and calls the studio', () => {
    const html = renderToStaticMarkup(<StudioLanding locale="en" />);
    expect(html).toContain('We film Houston.');
    expect(html).toContain(
      'You do. The gap is the weeks you don&#x27;t. We keep the cadence so it doesn&#x27;t depend on somebody remembering.',
    );
    expect(html).toContain('>$700<');
    expect(html).toContain('one time');
    expect(html).toContain('>$3,500<');
    expect(html).toContain('a month');
    expect(html).toContain('href="tel:+17138999346"');
    expect(html).toContain('Book a test shoot.');
    expect(html).toContain('Call 713-899-9346.');
    expect(html.match(/class="pub-cta"/g)).toHaveLength(2);
    expect(html).not.toContain('$149');
    expect(html).not.toContain('You brief. Agents produce. You approve every dollar.');
    for (const phrase of banned) expect(html).not.toContain(phrase);
  });

  it('uses the approved Spanish lines and keeps the same booking action', () => {
    const html = renderToStaticMarkup(<StudioLanding locale="es" />);
    expect(html).toContain('lang="es"');
    expect(html).toContain('Filmamos Houston.');
    expect(html).toContain(
      'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
    );
    expect(html).toContain('Agende un test shoot.');
    expect(html).toContain('$700');
    expect(html).toContain('$3,500');
    expect(html).toContain('href="tel:+17138999346"');
    expect(html.match(/class="pub-cta"/g)).toHaveLength(2);
    expect(html).not.toContain('We film Houston.');
    expect(html).not.toContain('$149');
    for (const phrase of banned) expect(html).not.toContain(phrase);
  });
});

describe('SoftwareLanding', () => {
  it('shows the specified path and does not sell the Houston studio', () => {
    const html = renderToStaticMarkup(<SoftwareLanding />);
    expect(html).toContain('You brief. Agents produce. You approve every dollar.');
    expect(html).toContain('The film shows the specified path.');
    expect(html).toContain('Specified path');
    expect(html).toContain('photo.jpg arrives from a selected Google Drive folder.');
    expect(html).toContain('Enrollment is closed.');
    expect(html).toContain('href="/login"');
    expect(html).toContain('Sign in to Studio');
    expect(html).toContain('p0-software-hero-poster.jpg');
    expect(html).not.toContain('We film Houston.');
    expect(html).not.toContain('$700');
    expect(html).not.toContain('$3,500');
    for (const phrase of banned) expect(html).not.toContain(phrase);
  });
});

describe('SoftwarePricing', () => {
  it('lists the provisional catalog without a buy button', () => {
    const html = renderToStaticMarkup(<SoftwarePricing />);
    expect(html).toContain('These prices are the provisional catalog.');
    expect(html).toContain('Signing in does not start a subscription.');
    expect(html).toContain('$49');
    expect(html).toContain('$149');
    expect(html).toContain('$399');
    expect(html).toContain('1 brand, 2 seats');
    expect(html).toContain('9 accounts, 10 GB');
    expect(html).toContain('Studio on this page is a software plan.');
    expect(html).toContain('1,000,000,000 bytes');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('Buy');
    expect(html).not.toContain('$700');
    expect(html).not.toContain('$3,500');
    expect(html).not.toContain('We film Houston.');
    for (const phrase of banned) expect(html).not.toContain(phrase);
  });
});

describe('SignUpPage', () => {
  it('collects nothing and does not ask for a request', () => {
    const html = renderToStaticMarkup(<SignUpPage />);
    expect(html).toContain('Enrollment is closed');
    expect(html).toContain('This screen collects nothing. No account is created here.');
    expect(html).toContain('Sign in to Studio');
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('Create account');
    for (const phrase of banned) expect(html).not.toContain(phrase);
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
