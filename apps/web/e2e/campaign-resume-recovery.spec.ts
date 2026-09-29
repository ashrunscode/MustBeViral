import { expect, test } from '@playwright/test';

test('workspace settings preserve the last campaign step without crashing resume', async ({
  page,
}) => {
  await page.goto('/studio/lumen-skin/canvas');
  await expect(page.getByRole('navigation', { name: 'Campaign workflow' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(sessionStorage.getItem('mbv.campaign.progress') ?? 'null')?.step,
      ),
    )
    .toBe('canvas');
  for (const step of ['Billing', 'Access', 'Skills']) {
    await page
      .getByRole('navigation', { name: 'Campaign workflow' })
      .getByRole('link', { name: step, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${step.toLowerCase()}$`, 'u'));
  }
  await page.goto('/studio/continue');
  await expect(page.getByRole('link', { name: 'Resume launch-pack canvas' })).toHaveAttribute(
    'href',
    '/studio/lumen-skin/canvas',
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
