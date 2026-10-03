import { expect, test } from '@playwright/test';

const canonicalOrigin = 'https://mustbeviral.com';
const publicRoutes = [
  '/',
  '/es',
  '/pricing',
  '/software',
  '/software/pricing',
  '/privacy',
  '/terms',
  '/advertising',
] as const;

for (const route of publicRoutes) {
  test(`renders canonical metadata on ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    // A bare origin and its '/' spelling are the same absolute URL.
    expect(new URL((await canonical.getAttribute('href')) ?? '').href).toBe(
      `${canonicalOrigin}${route}`,
    );
    const urls = await page
      .locator(
        'link[hreflang], meta[property="og:url"], meta[property="og:image"], meta[name="twitter:image"]',
      )
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('href') ?? element.getAttribute('content')),
      );
    for (const url of urls) {
      expect(url).not.toBeNull();
      expect(new URL(url ?? '').origin).toBe(canonicalOrigin);
    }
    if (route === '/' || route === '/es') {
      for (const [language, pathname] of [
        ['en', '/'],
        ['es', '/es'],
        ['x-default', '/'],
      ]) {
        const alternate = page.locator(`link[hreflang="${language}"]`);
        await expect(alternate).toHaveCount(1);
        const href = await alternate.getAttribute('href');
        // Next normalizes a root alternate without a trailing slash. Both spellings name '/'.
        expect(new URL(href ?? '').href).toBe(`${canonicalOrigin}${pathname}`);
      }
    }
    if (!['/privacy', '/terms', '/advertising'].includes(route)) {
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
    }
    const structuredData = page.locator('script[type="application/ld+json"]');
    if (route === '/' || route === '/es' || route === '/software') {
      await expect(structuredData).toHaveCount(1);
    }
    for (const json of await structuredData.allTextContents()) {
      const data = JSON.parse(json) as { url?: string; '@id'?: string };
      expect(new URL(data.url ?? '').origin).toBe(canonicalOrigin);
      expect(new URL(data['@id'] ?? '').origin).toBe(canonicalOrigin);
    }
  });
}

test('serves canonical sitemap, robots and llms links', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  expect(locations).toEqual(publicRoutes.map((route) => `${canonicalOrigin}${route}`));
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${canonicalOrigin}/sitemap.xml`);
  const llms = await request.get('/llms.txt');
  expect(llms.status()).toBe(200);
  const text = await llms.text();
  expect(text).toContain(`English page: ${canonicalOrigin}/`);
  expect(text).not.toContain('vercel.app');
});
