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

test('gives every API-key scope checkbox a 44px hit area clear of its neighbours', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/access');
  await page.getByRole('button', { name: 'Create API key' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Issue key' })).toBeVisible();
  const probe = await modal.evaluate((dialog) => {
    const boxes = [
      ...dialog.querySelectorAll<HTMLInputElement>('.access-panel__scope input[type="checkbox"]'),
    ];
    const faults: string[] = [];
    for (const [index, box] of boxes.entries()) {
      box.scrollIntoView({ block: 'center' });
      const rect = box.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      // A 44px target centred on the checkbox: both ends must still reach this checkbox.
      for (const probeY of [y - 21.5, y + 21.5]) {
        const target = document.elementFromPoint(x, probeY);
        const owner =
          target instanceof HTMLInputElement ? target : target?.closest('label')?.control;
        if (owner !== box) faults.push(`${String(index)}@${(probeY - y).toFixed(1)}`);
      }
    }
    return { count: boxes.length, faults };
  });
  expect(probe.count).toBe(11);
  expect(probe.faults).toEqual([]);
});

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
