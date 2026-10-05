import { expect, test } from '@playwright/test';

for (const width of [375, 768, 1280, 1920]) {
  test(`keeps operations unavailable without data reads at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const operationsRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/core/') || url.pathname.startsWith('/rest/v1/')) {
        operationsRequests.push(url.pathname);
      }
    });
    await page.goto('/studio/lumen-skin/internal');
    await expect(page.getByRole('main', { name: 'Operations', exact: true })).toBeVisible();
    const unavailable = page.getByRole('status').filter({
      has: page.getByRole('heading', {
        level: 2,
        name: 'Operations access is unavailable.',
        exact: true,
      }),
    });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Operations', exact: true }),
    ).toBeVisible();
    await expect(unavailable).toContainText('Operations access is unavailable.');
    await expect(page.getByText('Product safety gates', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(unavailable).toContainText('Operations access is unavailable.');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    for (const paragraph of await unavailable.locator('p').all()) {
      const measure = await paragraph.evaluate((element) => {
        const probe = document.createElement('span');
        probe.style.cssText =
          'display:block;position:absolute;width:70ch;max-width:none;font:inherit';
        element.append(probe);
        const limit = probe.getBoundingClientRect().width;
        probe.remove();
        return {
          width: element.getBoundingClientRect().width,
          limit,
          maxWidth: getComputedStyle(element).maxWidth,
        };
      });
      expect(Number.parseFloat(measure.maxWidth)).toBeLessThanOrEqual(measure.limit + 1);
      expect(measure.width).toBeLessThanOrEqual(measure.limit + 1);
    }
    expect(operationsRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const recovery = page.getByRole('link', { name: 'Return to your studios' });
    await recovery.focus();
    await expect(recovery).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/studio\/continue$/);
  });
}
