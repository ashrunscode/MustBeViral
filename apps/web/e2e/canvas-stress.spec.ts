import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('keeps the deterministic 500-node stress graph navigable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop stress evidence only');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas?fixture=500');

  const surface = page.getByTestId('canvas-surface');
  await expect(surface).toBeVisible();
  await expect(page.getByTestId('virtualized-count')).toContainText('/ 500 nodes mounted');

  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(page.getByTestId('graph-plane')).toHaveAttribute('data-lod', 'simplified');
  await expect(page.locator('[data-node-evidence]').first()).toBeHidden();

  for (let count = 0; count < 7; count += 1) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
  }
  await expect(page.getByTestId('graph-plane')).toHaveAttribute('data-lod', 'full');

  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();

  const measurement = page.evaluate(async () => {
    const durationMs = 3_000;
    const startedAt = performance.now();
    let previous = startedAt;
    const deltas: number[] = [];
    await new Promise<void>((resolve) => {
      function sample(now: number) {
        deltas.push(now - previous);
        previous = now;
        if (now - startedAt >= durationMs) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const elapsedMs = previous - startedAt;
    return {
      durationMs: elapsedMs,
      frames: deltas.length,
      measuredFps: (deltas.length * 1_000) / elapsedMs,
      maxFrameDeltaMs: Math.max(...deltas),
    };
  });

  for (let step = 0; step < 135; step += 1) {
    const phase = step / 10;
    await page.mouse.move(centerX + Math.sin(phase) * 180, centerY + Math.cos(phase) * 110);
    if (step % 45 === 0) await page.mouse.wheel(0, step % 90 === 0 ? 6 : -6);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();

  const result = await measurement;
  const measuredFps = Math.round(result.measuredFps * 100) / 100;
  const domNodeCount = await page.locator('[data-node-id]').count();
  expect(domNodeCount).toBeLessThan(200);

  const targetId = await page
    .locator('[data-node-id]:not(.node-selected)')
    .first()
    .getAttribute('data-node-id');
  expect(targetId).not.toBeNull();
  if (targetId === null) return;
  const selectionLatencyMs = await page.evaluate(async (nodeId) => {
    const element = document.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (element === null) throw new Error('Selection target was virtualized before interaction');
    const startedAt = performance.now();
    element.click();
    if (element.classList.contains('node-selected')) return performance.now() - startedAt;
    return new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error('Selection ring did not arrive within one second'));
      }, 1_000);
      const observer = new MutationObserver(() => {
        if (!element.classList.contains('node-selected')) return;
        window.clearTimeout(timeout);
        observer.disconnect();
        resolve(performance.now() - startedAt);
      });
      observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    });
  }, targetId);
  const roundedSelectionLatencyMs = Math.round(selectionLatencyMs * 100) / 100;
  await expect(page.locator(`[data-node-id="${targetId}"]`)).toHaveCSS(
    'border-color',
    'rgb(128, 191, 255)',
  );

  const summary = {
    fixtureNodes: 500,
    viewport: { width: 1440, height: 900 },
    thresholdFps: 30,
    measuredFps,
    frames: result.frames,
    durationMs: Math.round(result.durationMs),
    maxFrameDeltaMs: Math.round(result.maxFrameDeltaMs * 100) / 100,
    domNodeCount,
    selectionLatencyMs: roundedSelectionLatencyMs,
    passed: measuredFps >= 30 && domNodeCount < 200 && roundedSelectionLatencyMs <= 200,
  };
  console.log(`canvas-fps-500 ${JSON.stringify(summary)}`);

  const fromWebPackage = process.cwd().endsWith(path.join('apps', 'web'));
  const directory = path.resolve(
    process.cwd(),
    fromWebPackage ? path.join('test', '__perf__') : path.join('apps', 'web', 'test', '__perf__'),
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'canvas-fps-500.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  await testInfo.attach('canvas-fps-500.json', {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });

  expect(measuredFps).toBeGreaterThanOrEqual(30);
  expect(roundedSelectionLatencyMs).toBeLessThanOrEqual(200);
});
