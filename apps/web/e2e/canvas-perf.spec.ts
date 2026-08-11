import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('sustains at least 55 FPS while panning and zooming the 100-node canvas', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop performance evidence only');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/lumen-skin/canvas?fixture=100');
  const surface = page.getByTestId('canvas-surface');
  await expect(surface).toBeVisible();
  await expect(page.getByTestId('virtualized-count')).toContainText('/ 100 nodes mounted');

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

  for (let step = 0; step < 120; step += 1) {
    const phase = step / 12;
    await page.mouse.move(centerX + Math.sin(phase) * 150, centerY + Math.cos(phase) * 90);
    if (step % 6 === 0) await page.mouse.wheel(0, step % 12 === 0 ? 8 : -8);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  const result = await measurement;
  const measuredFps = Math.round(result.measuredFps * 100) / 100;
  const summary = {
    fixtureNodes: 100,
    viewport: { width: 1440, height: 900 },
    thresholdFps: 55,
    measuredFps,
    frames: result.frames,
    durationMs: Math.round(result.durationMs),
    maxFrameDeltaMs: Math.round(result.maxFrameDeltaMs * 100) / 100,
    passed: measuredFps >= 55,
  };
  console.log(`canvas-fps ${JSON.stringify(summary)}`);

  const fromWebPackage = process.cwd().endsWith(path.join('apps', 'web'));
  const directory = path.resolve(
    process.cwd(),
    fromWebPackage ? path.join('test', '__perf__') : path.join('apps', 'web', 'test', '__perf__'),
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'canvas-fps.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  await testInfo.attach('canvas-fps.json', {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
  expect(measuredFps).toBeGreaterThanOrEqual(55);

  for (let count = 0; count < 4; count += 1)
    await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.getByTestId('graph-plane')).toHaveAttribute('data-lod', 'simplified');
  await expect(page.locator('[data-node-evidence]').first()).toBeHidden();
});
