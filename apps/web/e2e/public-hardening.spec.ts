import { expect, test } from '@playwright/test';

const authRoutes = ['/login', '/forgot-password', '/verify-email'] as const;

for (const width of [375, 1280]) {
  for (const route of authRoutes) {
    test(`keeps ${route} fields inside their card at ${width}px and 200% text size`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.locator('.auth-form')).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        const sizes = [...document.querySelectorAll('body, body *')].map((element) => ({
          element,
          size: Number.parseFloat(getComputedStyle(element).fontSize),
        }));
        for (const { element, size } of sizes) {
          if (element instanceof HTMLElement && size > 0) {
            element.style.fontSize = `${size * 2}px`;
          }
        }
      });

      const layout = await page.locator('.auth-card').evaluate((card) => {
        const cardRect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        const contentLeft =
          cardRect.left +
          Number.parseFloat(style.borderLeftWidth) +
          Number.parseFloat(style.paddingLeft);
        const contentRight =
          cardRect.right -
          Number.parseFloat(style.borderRightWidth) -
          Number.parseFloat(style.paddingRight);
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          controls: [
            ...card.querySelectorAll('.auth-form input:not([type="hidden"]), .auth-form button'),
          ].map((control) => {
            const rect = control.getBoundingClientRect();
            return {
              tag: control.tagName,
              width: rect.width,
              contentLeft,
              contentRight,
              left: rect.left,
              right: rect.right,
            };
          }),
        };
      });

      expect(layout.controls.length).toBeGreaterThan(0);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      for (const control of layout.controls) {
        expect(control.width, `${control.tag} has a usable width`).toBeGreaterThan(0);
        expect(control.left, `${control.tag} stays inside the left padding`).toBeGreaterThanOrEqual(
          control.contentLeft - 1,
        );
        expect(control.right, `${control.tag} stays inside the right padding`).toBeLessThanOrEqual(
          control.contentRight + 1,
        );
      }
    });
  }
}
