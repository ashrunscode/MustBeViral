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

// 712dc4e replaced the brief's CSS module with one unrelated rule (unstyled page, overlapping
// steps), and e64eaa2's restore clipped the summary below 1024px. Guard layout and reachability,
// not exact pixel values.
const briefSections = [
  'Product truth',
  'Brand kit',
  'Audience',
  'Offer',
  'Claims & legal',
  'Assets',
];

type Edges = { top: number; right: number; bottom: number; left: number };

const edgesOverlap = (a: Edges, b: Edges) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 600 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]) {
  test(`keeps the campaign brief laid out and unclipped at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/studio/lumen-skin/brief');
    await expect(page.getByRole('button', { name: 'Validate brief' })).toBeVisible();
    const steps = page.getByRole('navigation', { name: 'Brief sections' }).getByRole('button');
    await expect(steps).toHaveCount(6);

    // Measure every box in one pass, before anything scrolls.
    const layout = await page.locator('#main-content').evaluate((main) => {
      const edges = (element: Element | null) => {
        if (element === null) throw new Error('Missing brief element.');
        const { top, right, bottom, left } = element.getBoundingClientRect();
        return { top, right, bottom, left };
      };
      const one = (selector: string) => edges(document.querySelector(selector));
      const label = document.querySelector('label[for="legal-copy"]');
      const marker = label?.querySelector('span');
      if (!label || !marker) throw new Error('Missing required-field label.');
      const border = (selector: string) =>
        getComputedStyle(document.querySelector(selector) ?? main).borderTopColor;
      return {
        steps: [...main.querySelectorAll('nav[aria-label="Brief sections"] button')].map(edges),
        rail: one('nav[aria-label="Brief sections"]'),
        form: one('section[aria-labelledby="brief-title"]'),
        summary: one('aside[aria-labelledby="summary-title"]'),
        evidence: one('#evidence-source'),
        legal: one('#legal-copy'),
        actions: [...(main.nextElementSibling?.querySelectorAll('button') ?? [])].map(edges),
        mainOverflowX: main.scrollWidth - main.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        labelColor: getComputedStyle(label).color,
        markerColor: getComputedStyle(marker).color,
        invalidBorder: border('#evidence-source'),
        validBorder: border('#legal-copy'),
      };
    });

    for (const [index, step] of layout.steps.entries()) {
      expect(step.bottom - step.top, `step ${index + 1} height`).toBeGreaterThanOrEqual(44);
      for (const other of layout.steps.slice(index + 1))
        expect(edgesOverlap(step, other)).toBe(false);
    }
    // Save draft and Validate brief stay on screen, apart from each other.
    expect(layout.actions).toHaveLength(2);
    for (const action of layout.actions) {
      expect(action.left).toBeGreaterThanOrEqual(0);
      expect(action.top).toBeGreaterThanOrEqual(0);
      expect(action.right).toBeLessThanOrEqual(viewport.width);
      expect(action.bottom).toBeLessThanOrEqual(viewport.height);
    }
    expect(edgesOverlap(layout.actions[0]!, layout.actions[1]!)).toBe(false);
    expect(layout.pageWidth).toBeLessThanOrEqual(viewport.width);
    expect(layout.mainOverflowX).toBeLessThanOrEqual(0);
    // Required marks and the invalid field are styled apart from ordinary text and fields.
    expect(layout.markerColor).not.toBe(layout.labelColor);
    expect(layout.invalidBorder).not.toBe(layout.validBorder);

    const { rail, form, summary, evidence, legal } = layout;
    if (viewport.width >= 1280) {
      // Three panels side by side in one row, the form the widest; paired fields side by side.
      expect(rail.right).toBeLessThanOrEqual(form.left + 1);
      expect(form.right).toBeLessThanOrEqual(summary.left + 1);
      expect(Math.abs(rail.top - form.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(summary.top - form.top)).toBeLessThanOrEqual(1);
      expect(form.right - form.left).toBeGreaterThan(rail.right - rail.left);
      expect(form.right - form.left).toBeGreaterThan(summary.right - summary.left);
      expect(Math.abs(legal.top - evidence.top)).toBeLessThanOrEqual(1);
      expect(legal.left).toBeGreaterThanOrEqual(evidence.right);
    } else {
      // Below 1280px the panels stack; below 768px paired fields stack too.
      expect(form.top).toBeGreaterThanOrEqual(rail.bottom - 1);
      expect(summary.top).toBeGreaterThanOrEqual(form.bottom - 1);
      if (viewport.width < 768) expect(legal.top).toBeGreaterThanOrEqual(evidence.bottom - 1);
    }

    // In every section, each step, field, summary item and confirm action must be fully inside
    // its scroll range, never cut by an overflow-clipping ancestor, and hit at its centre once
    // user-scrollable ancestors bring it into view.
    const targets = page.locator(
      [
        '#main-content :is(nav button, h1, textarea, input[type="checkbox"])',
        '#main-content aside :is([role="progressbar"], ul, [aria-live="polite"])',
        '#main-content + div button',
      ].join(', '),
    );
    for (const [index, section] of briefSections.entries()) {
      // A synthetic click: Playwright's own click would scroll overflow-hidden ancestors first.
      await steps.nth(index).dispatchEvent('click');
      await expect(
        page.getByRole('heading', { level: 1, name: section, exact: true }),
      ).toBeVisible();
      // Steps, heading, summary items and confirm actions at least; fields vary by section.
      expect(await targets.count()).toBeGreaterThanOrEqual(12);
      const unreachable = await targets.evaluateAll((elements) => {
        const scrolls = (style: CSSStyleDeclaration) =>
          ['auto', 'scroll'].includes(style.overflowY) ||
          ['auto', 'scroll'].includes(style.overflowX);
        const name = (element: Element) =>
          `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 32)}"`;
        const problems: string[] = [];
        elements: for (const element of elements) {
          let subject = element.getBoundingClientRect();
          for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
            const port = ancestor.getBoundingClientRect();
            if (scrolls(style)) {
              const top = subject.top - port.top - ancestor.clientTop + ancestor.scrollTop;
              const left = subject.left - port.left - ancestor.clientLeft + ancestor.scrollLeft;
              if (
                top < -1 ||
                left < -1 ||
                top + subject.height > ancestor.scrollHeight + 1 ||
                left + subject.width > ancestor.scrollWidth + 1
              ) {
                problems.push(
                  `${name(element)} lies outside the scroll range of ${name(ancestor)}`,
                );
                continue elements;
              }
              subject = port;
            } else if (
              subject.top < port.top - 1 ||
              subject.left < port.left - 1 ||
              subject.bottom > port.bottom + 1 ||
              subject.right > port.right + 1
            ) {
              problems.push(
                `${name(element)} is clipped by overflow ${style.overflowY} on ${name(ancestor)}`,
              );
              continue elements;
            }
          }
          for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            if (!scrolls(getComputedStyle(ancestor))) continue;
            const rect = element.getBoundingClientRect();
            const port = ancestor.getBoundingClientRect();
            ancestor.scrollTop +=
              rect.top +
              rect.height / 2 -
              (port.top + ancestor.clientTop + ancestor.clientHeight / 2);
            ancestor.scrollLeft +=
              rect.left +
              rect.width / 2 -
              (port.left + ancestor.clientLeft + ancestor.clientWidth / 2);
          }
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          if (hit === null || !element.contains(hit)) {
            problems.push(`${name(element)} is covered or off screen at its centre`);
          }
        }
        return problems;
      });
      expect(unreachable, `${section} at ${viewport.width}x${viewport.height}`).toEqual([]);
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
