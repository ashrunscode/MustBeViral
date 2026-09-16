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

test('keeps a 32px compact review control at a 44px touch target', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/review');
  const control = page.getByRole('button', { name: 'Approve group as Maya Chen' }).first();
  await expect(control).toBeVisible();
  expect((await control.boundingBox())?.height).toBe(32);
  // The bounding box stays compact; the pointer hit area extends to 44px, centred on the control.
  const probes = await control.evaluate((element) => {
    // elementFromPoint only resolves points inside the viewport.
    element.scrollIntoView({ block: 'center' });
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hits = (probeY: number) => {
      const target = document.elementFromPoint(x, probeY);
      return target !== null && element.contains(target);
    };
    return {
      insideTop: hits(y - 21.5),
      insideBottom: hits(y + 21.5),
      outsideTop: hits(y - 23),
      outsideBottom: hits(y + 23),
    };
  });
  expect(probes).toEqual({
    insideTop: true,
    insideBottom: true,
    outsideTop: false,
    outsideBottom: false,
  });
});

for (const dialog of [
  { route: 'skills', opener: 'Publish Skill', field: 'textarea', action: 'Publish version' },
  { route: 'access', opener: 'Create API key', field: 'fieldset', action: 'Issue key' },
]) {
  test(`keeps the ${dialog.action} hit area off the ${dialog.field} above it`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/studio/lumen-skin/${dialog.route}`);
    await page.getByRole('button', { name: dialog.opener }).click();
    const modal = page.getByRole('dialog');
    const action = modal.getByRole('button', { name: dialog.action });
    await expect(action).toBeVisible();
    const field = modal.locator(dialog.field);
    // Every point on the field's last pixel row above the action button must reach the field.
    const probe = await field.evaluate((element, actionName) => {
      const button = [...document.querySelectorAll('[role="dialog"] button')].find(
        (candidate) => candidate.textContent?.trim() === actionName,
      );
      if (button === undefined) throw new Error(`Missing ${actionName} button.`);
      const fieldRect = element.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const y = fieldRect.bottom - 1;
      const stolen: number[] = [];
      let probed = 0;
      const left = Math.ceil(Math.max(buttonRect.left, fieldRect.left));
      const right = Math.min(buttonRect.right, fieldRect.right);
      for (let x = left; x < right; x += 2) {
        probed += 1;
        const target = document.elementFromPoint(x, y);
        if (target === null || !element.contains(target)) stolen.push(x);
      }
      return { probed, stolen };
    }, dialog.action);
    expect(probe.probed).toBeGreaterThan(20);
    expect(probe.stolen).toEqual([]);
  });
}

// 712dc4e replaced the brief's CSS module with one unrelated rule; the page rendered unstyled with
// overlapping step buttons and the confirm actions clipped below the fold. Guard the layout itself.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`keeps the campaign brief laid out at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/studio/lumen-skin/brief');
    const validate = page.getByRole('button', { name: 'Validate brief' });
    await expect(validate).toBeVisible();

    type Box = { x: number; y: number; width: number; height: number };
    const boxOf = async (locator: ReturnType<typeof page.locator>): Promise<Box> => {
      const box = await locator.boundingBox();
      if (box === null) throw new Error('Expected a rendered box.');
      return box;
    };
    const intersects = (a: Box, b: Box) =>
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

    const steps = page.getByRole('navigation', { name: 'Brief sections' }).getByRole('button');
    await expect(steps).toHaveCount(6);
    const stepBoxes = await Promise.all((await steps.all()).map(boxOf));
    for (const [index, box] of stepBoxes.entries()) {
      expect(box.height, `step ${index + 1} height`).toBeGreaterThanOrEqual(44);
      for (const other of stepBoxes.slice(index + 1)) expect(intersects(box, other)).toBe(false);
    }

    // Both confirm actions sit fully inside the viewport, apart from each other.
    const save = await boxOf(page.getByRole('button', { name: 'Save draft' }));
    const validateBox = await boxOf(validate);
    for (const box of [save, validateBox]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(intersects(save, validateBox)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );

    const rail = await boxOf(page.getByRole('navigation', { name: 'Brief sections' }));
    const form = await boxOf(page.locator('section[aria-labelledby="brief-title"]'));
    const summary = await boxOf(page.getByRole('complementary', { name: 'Brief summary' }));
    const evidence = page.locator('#evidence-source');
    const evidenceBox = await boxOf(evidence);
    const legalBox = await boxOf(page.locator('#legal-copy'));
    await expect(evidence).toHaveCSS('height', '76px');
    await expect(evidence).toHaveCSS('border-top-color', 'rgb(196, 64, 77)');

    if (viewport.width >= 1280) {
      // Approved frame: 228px rail, fluid form, 320px summary; paired fields side by side.
      await expect(page.locator('#main-content')).toHaveCSS(
        'grid-template-columns',
        '228px 892px 320px',
      );
      expect([rail.x, rail.width, summary.x, summary.width]).toEqual([0, 228, 1120, 320]);
      expect(stepBoxes.every((box) => box.x === stepBoxes[0]?.x)).toBe(true);
      expect(legalBox.y).toBe(evidenceBox.y);
      expect(legalBox.x).toBeGreaterThan(evidenceBox.x + evidenceBox.width);
    } else {
      // Narrow screens stack rail, form and summary, and paired fields, in one column.
      expect(form.y).toBeGreaterThanOrEqual(rail.y + rail.height);
      expect(summary.y).toBeGreaterThanOrEqual(form.y + form.height);
      expect(legalBox.y).toBeGreaterThanOrEqual(evidenceBox.y + evidenceBox.height);
    }
  });
}

test('keeps adjacent canvas toolbar buttons at a 44px hit width each', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');
  const toolbar = page.getByRole('button', { name: 'Zoom in' }).locator('..');
  await expect(toolbar).toBeVisible();
  const shortfalls = await toolbar.evaluate((row) => {
    const buttons = [...row.querySelectorAll('button')];
    return buttons.flatMap((button) => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const reach = Math.max(rect.width, 44) / 2 - 0.5;
      return [x - reach, x + reach]
        .filter((probeX) => {
          const target = document.elementFromPoint(probeX, y);
          return target === null || !button.contains(target);
        })
        .map((probeX) => `${button.getAttribute('aria-label') ?? button.textContent}@${probeX}`);
    });
  });
  expect(shortfalls).toEqual([]);
});
