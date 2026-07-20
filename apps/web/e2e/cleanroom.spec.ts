import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test('renders the approved campaign brief golden at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/studio\/lumen-skin\/brief$/);
  await expect(page.getByRole('heading', { name: 'Claims & legal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Validate brief' })).toBeDisabled();
  const screenshotDirectory = path.join(process.cwd(), 'test', '__screenshots__');
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'campaign-brief-1440x900.png'),
    fullPage: false,
  });
});
