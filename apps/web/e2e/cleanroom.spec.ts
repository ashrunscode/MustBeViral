import { expect, test } from '@playwright/test';

test('renders only the cleanroom scaffold before design approval', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cleanroom application scaffold' })).toBeVisible();
  await expect(page.getByText('Production interface work remains gated')).toBeVisible();
});
