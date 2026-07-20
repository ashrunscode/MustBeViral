import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

async function screenshotPath(name: string) {
  const fromWebPackage = process.cwd().endsWith(path.join('apps', 'web'));
  const screenshotDirectory = path.resolve(
    process.cwd(),
    fromWebPackage
      ? path.join('test', '__screenshots__')
      : path.join('apps', 'web', 'test', '__screenshots__'),
  );
  await mkdir(screenshotDirectory, { recursive: true });
  return path.join(screenshotDirectory, name);
}

test('renders the approved campaign brief golden at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/studio\/lumen-skin\/brief$/);
  await expect(page.getByRole('heading', { name: 'Claims & legal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Validate brief' })).toBeDisabled();
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('campaign-brief-1440x900.png'),
      fullPage: false,
    });
  }
});

test('renders the golden canvas markers and screenshot at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');

  const selected = page.locator('.node-selected');
  await expect(selected).toHaveCSS('border-color', 'rgb(128, 191, 255)');
  await expect(page.locator('.flow-transfer')).toHaveCSS('stroke-dasharray', '6px, 8px');
  await expect(page.locator('.filament-sweep')).toHaveCount(1);
  await expect(page.locator('.node-dim').first()).toBeVisible();
  await expect(page.locator('[data-outline-id="2"]')).toHaveAttribute('aria-current', 'true');
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('canvas-1440x900.png'),
      fullPage: false,
    });
  }
});

test('disables canvas work-motion under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');
  await expect(page.locator('.filament-sweep')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.flow-transfer')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.flow-transfer')).toHaveCSS('stroke-dasharray', 'none');
});

test('renders the named-price quote and screenshot at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/quote');

  await expect(page.getByTestId('quote-total')).toHaveText('$4.20');
  const confirm = page.getByRole('button', { name: 'Confirm $4.20 run' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/I acknowledge this revision/u).check();
  await expect(confirm).toBeEnabled();
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('quote-1440x900.png'),
      fullPage: false,
    });
  }
});

test('keeps quote feedback static under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/quote');
  await expect(page.locator('[data-testid="quote-total"]')).toHaveText('$4.20');
  await expect(page.locator('.mbv-quote-pill')).toHaveCSS('animation-name', 'none');
});
