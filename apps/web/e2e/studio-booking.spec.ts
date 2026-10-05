import { expect, test } from '@playwright/test';

for (const route of ['/', '/pricing']) {
  test(`${route} offers a keyboard-accessible phone booking without collecting customer data`, async ({
    page,
  }) => {
    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const trigger = page.getByRole('link', { name: 'Book a test shoot.', exact: true }).first();
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Book a test shoot.' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('$700', { exact: true })).toBeVisible();
      await expect(dialog.getByText('2 edited Reels', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Call 713-899-9346.' })).toHaveAttribute(
        'href',
        'tel:+17138999346',
      );
      await expect(dialog.locator('form, input, textarea')).toHaveCount(0);
      await expect(dialog).toContainText('Nothing is booked or charged on this page.');
      for (let step = 0; step < 6; step += 1) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        );
      }
      const close = dialog.getByRole('button', { name: 'Close Book a test shoot.' });
      const bounds = await close.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
  });
}

test('the Spanish page retains its phone booking and the approved copy', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/es');
  await expect(page.getByRole('heading', { name: 'Filmamos Houston.' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Agende un test shoot.', exact: true }).first(),
  ).toHaveAttribute('href', 'tel:+17138999346');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('form, input, textarea')).toHaveCount(0);
});

for (const route of ['/', '/es', '/pricing']) {
  test(`${route} keeps exact prices intact when all mobile text is doubled`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      // Freeze every computed size before resizing, including the fixed-size money spans.
      const measured = [document.body, ...document.querySelectorAll<HTMLElement>('body *')].map(
        (element) => {
          const style = getComputedStyle(element);
          return {
            element,
            font: Number.parseFloat(style.fontSize),
            line: style.lineHeight === 'normal' ? null : Number.parseFloat(style.lineHeight),
          };
        },
      );
      for (const { element, font, line } of measured) {
        element.style.fontSize = `${font * 2}px`;
        if (line !== null) element.style.lineHeight = `${line * 2}px`;
      }
    });
    for (const amount of ['$700', '$3,500']) {
      const price = page.locator('.pub-price').filter({ hasText: amount }).first();
      await expect(price).toHaveText(amount);
      await expect(price).toHaveCSS('font-size', '56px');
      await price.scrollIntoViewIfNeeded();
      await expect(price).toBeVisible();
      expect(
        await price.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth;
        }),
      ).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}
