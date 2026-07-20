import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

async function screenshotPath(name: string) {
  const fromWebPackage = process.cwd().endsWith(path.join('apps', 'web'));
  const directory = path.resolve(
    process.cwd(),
    fromWebPackage
      ? path.join('test', '__screenshots__')
      : path.join('apps', 'web', 'test', '__screenshots__'),
  );
  await mkdir(directory, { recursive: true });
  return path.join(directory, name);
}

test('renders partial run progress at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/quote?stage=run');
  await expect(page.locator('.quote-stage')).toBeVisible();
  await expect(page.locator('.filament-sweep')).toHaveCount(1);
  await expect(page.locator('[data-first-reviewable="true"]')).toBeVisible();
  await expect(page.locator('[data-run-state="reviewable"]')).toBeVisible();
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('run-progress-1440x900.png'),
      fullPage: false,
    });
  }
});

test('disables run work-motion under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/quote?stage=run');
  await expect(page.locator('[data-first-reviewable="true"]')).toBeVisible();
  await expect(page.locator('.filament-sweep').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.flow-transfer').first()).toHaveCSS('animation-name', 'none');
});

test('renders output comparison at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/review/compare');
  await expect(page.getByRole('heading', { name: 'Output comparison' })).toBeVisible();
  await expect(page.locator('.compare-pair')).toHaveCount(4);
  await expect(page.locator('[data-variant-id="hero-a"] [data-status="verified"]')).toHaveText(
    /Approved/u,
  );
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('output-comparison-1440x900.png'),
      fullPage: false,
    });
  }
});

test('keeps comparison feedback static under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/review/compare');
  await expect(page.locator('[data-variant-id="hero-a"]')).toHaveCSS(
    'transition-duration',
    '1e-05s',
  );
});

test('renders named review at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/review');
  await expect(page.getByText('Reviewer · Maya Chen').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Approve group as Maya Chen' }).first(),
  ).toBeVisible();
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('review-1440x900.png'),
      fullPage: false,
    });
  }
});

test('keeps named review static under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/review');
  await expect(page.locator('[data-variant-id="hero-a"]')).toHaveCSS(
    'transition-duration',
    '1e-05s',
  );
});

test('renders immutable receipt at 1440x900', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/receipt');
  await expect(page.locator('.receipt-seal')).toContainText('Receipt verified');
  await expect(page.locator('.receipt-number')).toContainText('MBV-0042-7F3A');
  await expect(page.locator('[data-lineage-id]')).toHaveCount(4);
  await expect(page.getByText('$4.08').first()).toBeVisible();
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('receipt-1440x900.png'),
      fullPage: false,
    });
  }
});

test('keeps receipt presentation static under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/receipt');
  await expect(page.locator('.receipt-card')).toHaveCSS('transition-duration', '1e-05s');
});

test('uses the Drawer primitive for tablet review at 768x1024', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/studio/lumen-skin/review');
  const drawer = page.locator('.mbv-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('data-state', 'open');
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox?.width).toBeGreaterThan(459);
  expect(drawerBox?.width).toBeLessThan(462);
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('tablet-review-768x1024.png'),
      fullPage: false,
    });
  }
});

test('renders mobile review and export summary without horizontal scroll at 375x812', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/studio/lumen-skin/review');
  await expect(page.getByText(/Graph authoring is desktop-only/u)).toBeVisible();
  await expect(page.locator('[data-variant-id]:visible')).toHaveCount(2);
  await expect(page.locator('.receipt-summary')).toBeVisible();
  await expect(page.locator('.export-status')).toBeVisible();
  await expect(page.locator('.export-row')).toContainText('Ready');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  if (testInfo.project.name === 'desktop-chromium') {
    await page.screenshot({
      path: await screenshotPath('mobile-review-375x812.png'),
      fullPage: false,
    });
  }
});
