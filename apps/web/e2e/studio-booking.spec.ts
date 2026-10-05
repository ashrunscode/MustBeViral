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
