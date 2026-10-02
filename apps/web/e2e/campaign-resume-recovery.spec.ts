import { expect, test, type Page } from '@playwright/test';

const savedStep = (page: Page) =>
  page.evaluate(
    () => JSON.parse(sessionStorage.getItem('mbv.campaign.progress') ?? 'null')?.step as unknown,
  );

test('workspace tools preserve the last campaign step without crashing resume', async ({
  page,
}) => {
  await page.goto('/studio/lumen-skin/canvas');
  await expect(page.getByRole('navigation', { name: 'Campaign workflow' })).toBeVisible();
  await expect.poll(() => savedStep(page)).toBe('canvas');
  for (const tool of ['billing', 'access', 'skills']) {
    await page.goto(`/studio/lumen-skin/${tool}`);
    await expect(page).toHaveURL(new RegExp(`/${tool}$`, 'u'));
    await expect(page.locator('h1, h2').first()).toBeVisible();
    expect(await savedStep(page)).toBe('canvas');
  }
  await page.goto('/studio/continue');
  await expect(page.getByRole('link', { name: 'Resume campaign plan' })).toHaveAttribute(
    'href',
    '/studio/lumen-skin/canvas',
  );
});

test('campaign steps advance the saved step and resume at the latest one', async ({ page }) => {
  await page.goto('/studio/lumen-skin/canvas');
  await expect(page.getByRole('navigation', { name: 'Campaign workflow' })).toBeVisible();
  await expect.poll(() => savedStep(page)).toBe('canvas');
  for (const [step, path] of [
    ['Budget', 'quote'],
    ['Content', 'review'],
    ['Results', 'receipt'],
  ] as const) {
    await page
      .getByRole('navigation', { name: 'Campaign workflow' })
      .getByRole('link', { name: step, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`, 'u'));
  }
  await page.goto('/studio/continue');
  await expect(page.getByRole('link', { name: 'Resume export and receipt' })).toHaveAttribute(
    'href',
    '/studio/lumen-skin/receipt',
  );
});

test('a stored settings step recovers to an empty resume state', async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'mbv.campaign.progress',
      JSON.stringify({
        workspace: 'campaign',
        step: 'skills',
        resumeHref: '/studio/campaign/skills',
      }),
    ),
  );
  await page.goto('/studio/continue');
  await expect(page.getByRole('link', { name: 'Start campaign brief' })).toBeVisible();
  await expect(page.getByText('No in-progress step is saved for this browser yet.')).toBeVisible();
});
