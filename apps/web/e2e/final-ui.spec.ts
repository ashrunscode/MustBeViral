import { expect, test, type Page } from '@playwright/test';
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

test('keeps dimmed canvas node text at AA contrast with a non-colour inactive cue', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');
  await expect(page.locator('[data-node-id].node-dim').first()).toBeVisible();
  const report = await page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba => {
      const srgb = /color\(srgb ([^)]+)\)/u.exec(value);
      const rgb = /rgba?\(([^)]+)\)/u.exec(value);
      const parts = (srgb?.[1] ?? rgb?.[1] ?? '0 0 0 / 0')
        .split(/[\s,/]+/u)
        .filter(Boolean)
        .map(Number);
      const scale = srgb === null ? 1 : 255;
      return [
        (parts[0] ?? 0) * scale,
        (parts[1] ?? 0) * scale,
        (parts[2] ?? 0) * scale,
        parts[3] ?? 1,
      ];
    };
    const over = (top: Rgba, bottom: Rgba, alpha = top[3]): Rgba => [
      top[0] * alpha + bottom[0] * (1 - alpha),
      top[1] * alpha + bottom[1] * (1 - alpha),
      top[2] * alpha + bottom[2] * (1 - alpha),
      1,
    ];
    const luminance = (color: Rgba) =>
      color
        .slice(0, 3)
        .map((channel) => channel / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, index) => sum + c * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
    // Composite every ancestor's background and opacity, so a dimmed ancestor counts against its text.
    const composite = (chain: readonly Element[], text: Rgba | null): Rgba => {
      const paint = (index: number, backdrop: Rgba): Rgba => {
        const element = chain[index];
        if (element === undefined) return text === null ? backdrop : over(text, backdrop);
        const style = getComputedStyle(element);
        const inner = paint(index + 1, over(parse(style.backgroundColor), backdrop));
        const opacity = Number.parseFloat(style.opacity);
        return opacity < 1 ? over(inner, backdrop, opacity) : inner;
      };
      return paint(0, [255, 255, 255, 1]);
    };
    const failures: string[] = [];
    const cues: string[] = [];
    let texts = 0;
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-node-id].node-dim')];
    for (const node of nodes) {
      cues.push(`${node.dataset.nodeId ?? '?'}:${getComputedStyle(node).borderTopStyle}`);
      for (const element of [node, ...node.querySelectorAll('*')]) {
        if (element.closest('[aria-hidden="true"]') !== null) continue;
        const hasText = [...element.childNodes].some(
          (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '',
        );
        if (!hasText) continue;
        const chain: Element[] = [];
        for (let current: Element | null = element; current; current = current.parentElement) {
          chain.unshift(current);
        }
        const foreground = composite(chain, parse(getComputedStyle(element).color));
        const background = composite(chain, null);
        const [light = 0, dark = 0] = [luminance(foreground), luminance(background)].sort(
          (a, b) => b - a,
        );
        const ratio = (light + 0.05) / (dark + 0.05);
        texts += 1;
        if (ratio < 4.5) {
          failures.push(
            `${node.dataset.nodeId ?? '?'} "${element.textContent}" ${ratio.toFixed(2)}`,
          );
        }
      }
    }
    return { nodes: nodes.length, texts, failures, cues };
  });
  expect(report.nodes).toBeGreaterThan(0);
  expect(report.texts).toBeGreaterThan(report.nodes * 4);
  expect(report.failures).toEqual([]);
  // Inactive reads through a dashed border, a cue that survives without colour or opacity.
  expect(report.cues.filter((cue) => !cue.endsWith(':dashed'))).toEqual([]);
});

test('keeps the dimmed-node dashed border at 3:1 against the canvas at rest, on hover and on focus', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');
  const node = page.locator('[data-node-id].node-dim').first();
  await expect(node).toBeVisible();
  const borderContrast = () =>
    node.evaluate((element) => {
      type Rgba = [number, number, number, number];
      const parse = (value: string): Rgba => {
        const parts = (/rgba?\(([^)]+)\)/u.exec(value)?.[1] ?? '0 0 0 0')
          .split(/[\s,/]+/u)
          .filter(Boolean)
          .map(Number);
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
      };
      const over = (top: Rgba, bottom: Rgba): Rgba => [
        top[0] * top[3] + bottom[0] * (1 - top[3]),
        top[1] * top[3] + bottom[1] * (1 - top[3]),
        top[2] * top[3] + bottom[2] * (1 - top[3]),
        1,
      ];
      const luminance = (color: Rgba) =>
        color
          .slice(0, 3)
          .map((channel) => channel / 255)
          .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
          .reduce((sum, c, index) => sum + c * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
      // The canvas field around the node: the page, the canvas page and the surface wash.
      const surface = element.closest('[data-testid="canvas-surface"]');
      const main = element.closest('main');
      if (surface === null || main === null) throw new Error('Node outside the canvas surface.');
      let canvas: Rgba = parse(getComputedStyle(document.body).backgroundColor);
      canvas = over(parse(getComputedStyle(main).backgroundColor), canvas);
      canvas = over(parse(getComputedStyle(surface).backgroundColor), canvas);
      const style = getComputedStyle(element);
      const border = over(parse(style.borderTopColor), over(parse(style.backgroundColor), canvas));
      const [light = 0, dark = 0] = [luminance(border), luminance(canvas)].sort((a, b) => b - a);
      return { style: style.borderTopStyle, ratio: (light + 0.05) / (dark + 0.05) };
    });
  const rest = await borderContrast();
  await node.hover();
  const hover = await borderContrast();
  await page.mouse.move(1, 1);
  await node.focus();
  const focus = await borderContrast();
  for (const state of [rest, hover, focus]) {
    expect(state.style).toBe('dashed');
    expect(state.ratio).toBeGreaterThanOrEqual(3);
  }
});

// Zoom is emulated through the CSS viewport: 375x812 at 200% is a 187x406 CSS px viewport.
for (const viewport of [
  { width: 320, height: 568, label: '320x568' },
  { width: 375, height: 667, label: '375x667' },
  { width: 375, height: 812, label: '375x812' },
  { width: 414, height: 896, label: '414x896' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1440, height: 900, label: '1440x900' },
  { width: 256, height: 454, label: '320x568 at 125%' },
  { width: 250, height: 541, label: '375x812 at 150%' },
  { width: 187, height: 406, label: '375x812 at 200%' },
  { width: 207, height: 448, label: '414x896 at 200%' },
]) {
  // The action row sticks only where Issue key and Cancel fit on one line (see globals.css).
  const actionRowSticks = viewport.width >= 300 && viewport.height >= 320;
  test(`gives every API-key scope a clear 44px target and never hides the focused control at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/studio/lumen-skin/access');
    await page.getByRole('button', { name: 'Create API key' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByRole('button', { name: 'Issue key' })).toBeAttached();
    const probe = await modal.evaluate((dialog) => {
      // The primary action, before anything scrolls the dialog.
      const issue = [...dialog.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Issue key',
      );
      if (issue === undefined) throw new Error('Missing Issue key button.');
      const dialogRect = dialog.getBoundingClientRect();
      const issueRect = issue.getBoundingClientRect();
      const hit = document.elementFromPoint(
        issueRect.left + issueRect.width / 2,
        issueRect.top + issueRect.height / 2,
      );
      const actionInView =
        dialog.scrollTop === 0 &&
        issueRect.top >= Math.max(dialogRect.top, 0) &&
        issueRect.bottom <= Math.min(dialogRect.bottom, innerHeight) &&
        hit !== null &&
        issue.contains(hit);
      const boxes = [
        ...dialog.querySelectorAll<HTMLInputElement>('.access-panel__scope input[type="checkbox"]'),
      ];
      const faults: string[] = [];
      for (const [index, box] of boxes.entries()) {
        box.scrollIntoView({ block: 'center' });
        const label = box.closest('label');
        if (label === null) throw new Error('Scope checkbox without a label.');
        const left = label.getBoundingClientRect().left;
        const boxRect = box.getBoundingClientRect();
        const centreY = boxRect.top + boxRect.height / 2;
        // A 44x44 square from the label's left edge, centred on the checkbox: every sampled point must
        // toggle this checkbox, so the target is 44px and no neighbouring scope or field reaches into it.
        for (let dx = 0.5; dx <= 43.5; dx += 3) {
          for (let dy = -21.5; dy <= 21.5; dy += 3) {
            const target = document.elementFromPoint(left + dx, centreY + dy);
            const owner =
              target instanceof HTMLInputElement ? target : target?.closest('label')?.control;
            if (owner !== box) faults.push(`${String(index)}@${String(dx)},${String(dy)}`);
          }
        }
      }
      // Back to the state the dialog opens in.
      dialog.scrollTop = 0;
      return { count: boxes.length, faults, actionInView };
    });
    expect(probe.count).toBe(11);
    expect(probe.faults).toEqual([]);
    // Where the row sticks, the scopes never push the primary action out of view.
    if (actionRowSticks) expect(probe.actionInView).toBe(true);

    // Tab through every control from Close to Cancel and once more, wrapping back to Close. The
    // focused control and its 2px focus ring (2px offset) must stay in view and clear of the action
    // row (WCAG 2.4.11).
    await modal.getByRole('button', { name: 'Close Create scoped API key' }).focus();
    const hidden: string[] = [];
    const visited: string[] = [];
    for (let step = 0; step < 20; step += 1) {
      const state = await modal.evaluate((dialog) => {
        const focused = document.activeElement;
        const row = dialog.querySelector('.access-panel__actions');
        if (!(focused instanceof HTMLElement) || !dialog.contains(focused) || row === null) {
          return { name: 'outside the dialog', fault: 'focus left the dialog' };
        }
        const name = (
          focused.getAttribute('aria-label') ??
          focused.closest('label')?.textContent ??
          focused.textContent ??
          ''
        ).trim();
        const box = focused.getBoundingClientRect();
        const ring = {
          top: box.top - 4,
          bottom: box.bottom + 4,
          left: box.left - 4,
          right: box.right + 4,
        };
        const rowRect = row.getBoundingClientRect();
        const dialogRect = dialog.getBoundingClientRect();
        const underRow =
          !row.contains(focused) &&
          ring.bottom > rowRect.top &&
          ring.top < rowRect.bottom &&
          ring.right > rowRect.left &&
          ring.left < rowRect.right;
        const visibleBottom = Math.min(
          dialogRect.top + dialog.clientTop + dialog.clientHeight,
          innerHeight,
        );
        const inView =
          box.top >= Math.max(dialogRect.top, 0) - 0.5 && box.bottom <= visibleBottom + 0.5;
        const fault = underRow
          ? `${name} under the action row`
          : inView
            ? ''
            : `${name} out of view`;
        return { name, fault };
      });
      visited.push(state.name);
      if (state.fault !== '') hidden.push(state.fault);
      if (visited.length > 1 && state.name === 'Close Create scoped API key') break;
      await page.keyboard.press('Tab');
    }
    // Close, Name, eleven scopes, Issue key, Cancel, then Close again.
    expect(visited).toHaveLength(16);
    expect(visited.at(-1)).toBe('Close Create scoped API key');
    expect(hidden).toEqual([]);
  });
}

for (const region of [
  { route: 'receipt', width: 375, height: 812, scrolls: true },
  { route: 'billing', width: 375, height: 812, scrolls: true },
  { route: 'billing', width: 1440, height: 900, scrolls: true },
  { route: 'billing', width: 768, height: 1024, scrolls: false },
]) {
  test(`makes the ${region.route} scroll region a named tab stop only while it scrolls at ${String(region.width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: region.width, height: region.height });
    await page.goto(`/studio/lumen-skin/${region.route}`);
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();
    const describeRegions = () =>
      main.evaluate((root) => {
        const focusable =
          'a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]';
        return [root, ...root.querySelectorAll('*')]
          .filter((element) => /(auto|scroll)/u.test(getComputedStyle(element).overflowY))
          .map((element) => {
            const labelledBy = element.getAttribute('aria-labelledby');
            const labelText =
              labelledBy === null ? null : document.getElementById(labelledBy)?.textContent;
            return {
              scrolls:
                element.scrollHeight > element.clientHeight + 1 ||
                element.scrollWidth > element.clientWidth + 1,
              tabIndex: element.getAttribute('tabindex'),
              hasFocusableContent: element.querySelector(focusable) !== null,
              name: (element.getAttribute('aria-label') ?? labelText ?? '').trim(),
            };
          });
      });
    if (region.scrolls) {
      // The region measures its own overflow after mount, then becomes a named tab stop.
      await expect
        .poll(async () =>
          (await describeRegions()).filter((entry) => entry.scrolls && !entry.hasFocusableContent),
        )
        .toEqual([expect.objectContaining({ tabIndex: '0', name: expect.stringMatching(/\S/u) })]);
      const scroller = page.locator('#main-content[tabindex="0"], #main-content [tabindex="0"]');
      await expect(scroller).toHaveCount(1);
      await scroller.focus();
      await expect(scroller).toBeFocused();
      await page.keyboard.press('PageDown');
      await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    } else {
      await page.waitForTimeout(300);
      const regions = await describeRegions();
      expect(regions.filter((entry) => entry.scrolls)).toEqual([]);
      expect(regions.filter((entry) => entry.tabIndex !== null)).toEqual([]);
    }
  });
}

for (const region of [
  { route: 'receipt', from: { width: 375, height: 812 }, to: { width: 768, height: 1200 } },
  { route: 'billing', from: { width: 375, height: 812 }, to: { width: 768, height: 1024 } },
  { route: 'billing', from: { width: 1440, height: 900 }, to: { width: 1440, height: 1100 } },
]) {
  test(`keeps focus on the ${region.route} scroll region when it stops overflowing at ${String(region.from.width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize(region.from);
    await page.goto(`/studio/lumen-skin/${region.route}`);
    const scroller = page.locator('#main-content[tabindex="0"], #main-content [tabindex="0"]');
    await expect(scroller).toHaveCount(1);
    await scroller.focus();
    await expect(scroller).toBeFocused();
    // A larger window or a zoom-out: the region no longer overflows while it has focus.
    await page.setViewportSize(region.to);
    await expect
      .poll(() =>
        scroller.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    await page.waitForTimeout(300);
    await expect(scroller).toBeFocused();
    // Sequential navigation continues from the region: the next control, or the previous one when
    // the region is the last stop on the page.
    const neighbour = await scroller.evaluate((element) => {
      const focusable = [
        ...document.querySelectorAll<Element>(
          'a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]',
        ),
      ].filter((candidate) => candidate.getClientRects().length > 0);
      const index = focusable.indexOf(element);
      const next = focusable.slice(index + 1).find((candidate) => !element.contains(candidate));
      const target = next ?? focusable[index - 1];
      target?.setAttribute('data-expected-focus', 'true');
      return { key: next === undefined ? 'Shift+Tab' : 'Tab', found: target !== undefined };
    });
    expect(neighbour.found).toBe(true);
    await page.keyboard.press(neighbour.key);
    await expect(page.locator('[data-expected-focus="true"]')).toBeFocused();
    // Once focus has left, the region is measured again and, fitting, is no longer a tab stop.
    await expect(page.locator('#main-content')).not.toHaveAttribute('tabindex');
    await expect(page.locator('#main-content [tabindex]')).toHaveCount(0);
  });
}

test('names the billing page and its introduction distinctly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/billing');
  await expect(page.getByRole('main')).toBeVisible();
  const names = await page.evaluate(() => {
    const nameOf = (element: Element) => {
      const labelledBy = element.getAttribute('aria-labelledby');
      return (
        element.getAttribute('aria-label') ??
        (labelledBy === null ? '' : (document.getElementById(labelledBy)?.textContent ?? ''))
      ).trim();
    };
    const mainElement = document.querySelector('main');
    const intro = mainElement?.querySelector('section');
    return { main: mainElement ? nameOf(mainElement) : '', intro: intro ? nameOf(intro) : '' };
  });
  expect(names.main).not.toBe('');
  expect(names.intro).not.toBe('');
  expect(names.main).not.toBe(names.intro);
});

test('keeps adjacent canvas outline rows from sharing hit-test pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');
  const list = page.locator('ol:has([data-outline-id])');
  await expect(list.locator('[data-outline-id]')).toHaveCount(12);
  const collisions = await list.evaluate((element) => {
    const rows = [...element.querySelectorAll<HTMLElement>('[data-outline-id]')];
    const ownerAt = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-outline-id]') ?? null;
    const found: string[] = [];
    for (let index = 0; index < rows.length - 1; index += 1) {
      const upper = rows[index];
      const lower = rows[index + 1];
      if (upper === undefined || lower === undefined) continue;
      const name = (row: HTMLElement) => `row ${row.dataset.outlineId ?? '?'}`;
      // Centre the boundary between the two rows inside the scrolling list.
      const listRect = element.getBoundingClientRect();
      element.scrollTop +=
        upper.getBoundingClientRect().bottom - (listRect.top + listRect.bottom) / 2;
      const upperRect = upper.getBoundingClientRect();
      const lowerRect = lower.getBoundingClientRect();
      for (let x = upperRect.left + 8; x < upperRect.right - 8; x += 24) {
        for (const y of [upperRect.bottom - 2, upperRect.bottom - 1]) {
          if (ownerAt(x, y) === lower) found.push(`${name(lower)} over ${name(upper)}`);
        }
        for (const y of [lowerRect.top + 1, lowerRect.top + 2]) {
          if (ownerAt(x, y) === upper) found.push(`${name(upper)} over ${name(lower)}`);
        }
        if (ownerAt(x, upperRect.bottom - 3) !== upper) found.push(`${name(upper)} lost its edge`);
      }
    }
    return [...new Set(found)];
  });
  expect(collisions).toEqual([]);
});

test('keeps canvas nodes inside their column at 375px so none sits over a side-rail field', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/studio/lumen-skin/canvas');
  await expect(page.locator('[data-node-id]').first()).toBeAttached();
  await expect(page.locator('textarea').first()).toBeVisible();
  const report = await page.evaluate(() => {
    const interactive = 'a[href], button, input, select, textarea';
    const surface = document.querySelector('[data-testid="canvas-surface"]');
    const rail = document.querySelector('aside[aria-labelledby="outline-title"]')?.parentElement;
    if (!surface || !rail) throw new Error('Missing canvas surface or side rail.');
    const surfaceRect = surface.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const stolen: string[] = [];
    // Every point of a node inside the canvas viewport must stay on the canvas and never reach
    // another control. (A rounded corner falls through to the graph plane, which is still canvas.)
    for (const node of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
      const rect = node.getBoundingClientRect();
      const left = Math.max(rect.left, surfaceRect.left, 0) + 1;
      const right = Math.min(rect.right, surfaceRect.right, innerWidth) - 1;
      const top = Math.max(rect.top, surfaceRect.top, 0) + 1;
      const bottom = Math.min(rect.bottom, surfaceRect.bottom, innerHeight) - 1;
      for (let x = left; x <= right; x += 4) {
        for (let y = top; y <= bottom; y += 4) {
          const target = document.elementFromPoint(x, y);
          const owner = target?.closest(interactive) ?? null;
          if (!surface.contains(target) || (owner !== null && owner !== node)) {
            stolen.push(`node ${node.dataset.nodeId ?? '?'} -> ${owner?.tagName ?? 'rail'}`);
          }
        }
      }
    }
    // Every visible point of a side-rail text field must reach that field.
    for (const field of rail.querySelectorAll('textarea')) {
      const rect = field.getBoundingClientRect();
      const clip =
        field.closest('[class*="collaborationStack"]')?.getBoundingClientRect() ?? railRect;
      const top = Math.max(rect.top, clip.top) + 1;
      const bottom = Math.min(rect.bottom, clip.bottom) - 1;
      for (let x = rect.left + 1; x < rect.right - 1; x += 4) {
        for (let y = top; y < bottom; y += 4) {
          const owner = document.elementFromPoint(x, y)?.closest(interactive);
          if (owner !== field) stolen.push(`textarea -> ${owner?.tagName ?? 'none'}`);
        }
      }
    }
    return {
      surfaceRight: surfaceRect.right,
      railLeft: railRect.left,
      stolen: [...new Set(stolen)],
    };
  });
  expect(report.stolen).toEqual([]);
  expect(report.surfaceRight).toBeLessThanOrEqual(report.railLeft + 0.5);
});

test('keeps the quote acknowledgment checkbox clear of the side panel at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/studio/lumen-skin/quote');
  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).toBeEnabled();
  const probe = await checkbox.evaluate((box) => {
    const stage = box.closest('section');
    const aside = document.querySelector('aside[aria-labelledby="impact-title"]');
    const label = box instanceof HTMLInputElement ? box.labels?.[0] : undefined;
    if (!(box instanceof HTMLInputElement) || !label || !stage || !aside) {
      throw new Error('Missing quote stage, checkbox, label or side panel.');
    }
    const stolen: string[] = [];
    // Every point of the label (and so the checkbox) inside the scrolling stage must reach it.
    const sample = (element: Element, phase: string) => {
      const rect = element.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const left = Math.max(rect.left, stageRect.left, 0) + 1;
      const right = Math.min(rect.right, stageRect.right) - 1;
      const top = Math.max(rect.top, stageRect.top, 0) + 1;
      const bottom = Math.min(rect.bottom, stageRect.bottom, innerHeight) - 1;
      for (let x = left; x <= right; x += 2) {
        for (let y = top; y <= bottom; y += 2) {
          const target = document.elementFromPoint(x, y);
          if (target !== box && !label.contains(target)) {
            stolen.push(`${phase}: ${target?.tagName ?? 'none'}`);
          }
        }
      }
      return right - left;
    };
    // Scroll the stage vertically so the acknowledgment row is in view, then sample it.
    const labelRect = label.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    stage.scrollTop += (labelRect.top + labelRect.bottom - stageBox.top - stageBox.bottom) / 2;
    sample(label, 'label');
    // Scroll the stage until the checkbox sits at its right edge, as scrolling towards it would.
    stage.scrollLeft += box.getBoundingClientRect().right - stage.getBoundingClientRect().right;
    const visibleWidth = sample(box, 'checkbox at the stage edge');
    return {
      visibleWidth,
      stolen: [...new Set(stolen)],
      stageRight: stage.getBoundingClientRect().right,
      asideLeft: aside.getBoundingClientRect().left,
    };
  });
  expect(probe.visibleWidth).toBeGreaterThan(8);
  expect(probe.stolen).toEqual([]);
  expect(probe.stageRight).toBeLessThanOrEqual(probe.asideLeft + 0.5);
});

test('keeps every canvas outline row reachable and unclipped beside the collaboration panel at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/studio/lumen-skin/canvas');
  const list = page.locator('ol:has([data-outline-id])');
  await expect(list.locator('[data-outline-id]')).toHaveCount(12);
  const report = await list.evaluate((element) => {
    const faults: string[] = [];
    for (const row of element.querySelectorAll<HTMLElement>('[data-outline-id]')) {
      const name = `row ${row.dataset.outlineId ?? '?'}`;
      // Scrolling the outline list must bring the whole row into view, and every point of it must
      // reach the row rather than the collaboration panel or anything else in the rail.
      row.scrollIntoView({ block: 'nearest' });
      const listRect = element.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      if (rect.top < listRect.top - 0.5 || rect.bottom > listRect.bottom + 0.5) {
        faults.push(`${name} clipped by the list`);
      }
      if (rect.top < 0 || rect.bottom > innerHeight) faults.push(`${name} outside the viewport`);
      for (let x = rect.left + 2; x < rect.right - 2; x += 16) {
        for (let y = rect.top + 1; y < rect.bottom - 1; y += 4) {
          if (document.elementFromPoint(x, y)?.closest('[data-outline-id]') !== row) {
            faults.push(`${name} covered`);
          }
        }
      }
    }
    return { visibleListHeight: element.clientHeight, faults: [...new Set(faults)] };
  });
  expect(report.faults).toEqual([]);
  expect(report.visibleListHeight).toBeGreaterThanOrEqual(104);
});

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`shows at least five canvas outline rows beside the collaboration panel at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/studio/lumen-skin/canvas');
    const list = page.locator('ol:has([data-outline-id])');
    await expect(list.locator('[data-outline-id]')).toHaveCount(12);
    const visibleRows = await list.evaluate((element) => {
      const listRect = element.getBoundingClientRect();
      // Rows fully inside the list without scrolling it, whose every sampled point reaches the row.
      return [...element.querySelectorAll<HTMLElement>('[data-outline-id]')].filter((row) => {
        const rect = row.getBoundingClientRect();
        if (rect.top < listRect.top - 0.5 || rect.bottom > listRect.bottom + 0.5) return false;
        for (let x = rect.left + 2; x < rect.right - 2; x += 24) {
          for (let y = rect.top + 1; y < rect.bottom - 1; y += 6) {
            if (document.elementFromPoint(x, y)?.closest('[data-outline-id]') !== row) return false;
          }
        }
        return true;
      }).length;
    });
    expect(visibleRows).toBeGreaterThanOrEqual(5);
  });
}

async function selectFailedAsset(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas');
  await page.locator('[data-outline-id="7"]').click();
  const node = page.locator('[data-node-id="7"]');
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  return node;
}

test('keeps the failure reason of a selected failed node at AA contrast', async ({ page }) => {
  const node = await selectFailedAsset(page);
  const reason = node.locator('[class*="invalidReason"]');
  await expect(reason).toBeVisible();

  // The failure reason keeps AA contrast on the selected node's wash.
  const ratio = await reason.evaluate((element) => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba => {
      const srgb = /color\(srgb ([^)]+)\)/u.exec(value);
      const rgb = /rgba?\(([^)]+)\)/u.exec(value);
      const parts = (srgb?.[1] ?? rgb?.[1] ?? '0 0 0 / 0')
        .split(/[\s,/]+/u)
        .filter(Boolean)
        .map(Number);
      const scale = srgb === null ? 1 : 255;
      return [
        (parts[0] ?? 0) * scale,
        (parts[1] ?? 0) * scale,
        (parts[2] ?? 0) * scale,
        parts[3] ?? 1,
      ];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
      1,
    ];
    const luminance = (color: Rgba) =>
      color
        .slice(0, 3)
        .map((channel) => channel / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, index) => sum + c * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
    const chain: Element[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      chain.unshift(current);
    }
    let background: Rgba = [255, 255, 255, 1];
    for (const ancestor of chain)
      background = over(parse(getComputedStyle(ancestor).backgroundColor), background);
    const text = over(parse(getComputedStyle(element).color), background);
    const [light = 0, dark = 0] = [luminance(text), luminance(background)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('keeps only list items in the selected node comment list', async ({ page }) => {
  await selectFailedAsset(page);
  // Every comment in the thread is an article inside a list item, not a list child itself.
  const list = page.getByRole('list', { name: /^Comment thread for/u });
  await expect(list).toBeVisible();
  const childRoles = await list.evaluate((element) =>
    [...element.children].map((child) => child.getAttribute('role') ?? child.tagName.toLowerCase()),
  );
  expect(childRoles.length).toBeGreaterThan(0);
  expect(childRoles.every((role) => role === 'li')).toBe(true);
  await expect(list.getByRole('article').first()).toBeVisible();
});

test('gives Retry lease a 44px hit area clear of its textarea', async ({ page }) => {
  await selectFailedAsset(page);
  // Retry lease keeps a 44px hit area that no neighbouring control or field reaches into.
  const retries = page.getByRole('button', { name: 'Retry lease' });
  await expect(retries.first()).toBeVisible();
  const faults = await retries.evaluateAll((buttons) =>
    buttons.flatMap((button, index) => {
      button.scrollIntoView({ block: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const found: string[] = [];
      for (const probeY of [y - 21.5, y + 21.5]) {
        const target = document.elementFromPoint(x, probeY);
        if (target === null || !button.contains(target))
          found.push(`${String(index)}@${String(probeY - y)}`);
      }
      // The control above keeps its own last pixel row.
      const field = button.closest('[data-field-path]')?.querySelector('textarea');
      if (field) {
        const fieldRect = field.getBoundingClientRect();
        const target = document.elementFromPoint(x, fieldRect.bottom - 1);
        if (target !== field) found.push(`${String(index)} covers its textarea`);
      }
      return found;
    }),
  );
  expect(faults).toEqual([]);
});
