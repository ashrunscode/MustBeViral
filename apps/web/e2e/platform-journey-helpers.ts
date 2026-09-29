import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  createSyntheticUser,
  deleteSyntheticUser,
  SYNTHETIC_JOURNEY_PASSWORD,
} from '../../../packages/db/scripts/platform-journey-fixtures';

export const FORGED_ID = '00000000-0000-4000-8000-ffffffffffff';
export const NOT_FOUND_COPY = 'unavailable or your access has changed';

export async function registerSyntheticUser(
  email: string,
  createdUsers: Array<{ id: string; email: string }>,
) {
  const user = await createSyntheticUser(email);
  createdUsers.push(user);
  return user;
}

export async function cleanupSyntheticUsers(createdUsers: Array<{ id: string; email: string }>) {
  const preserved: Array<{ id: string; email: string; status: number }> = [];
  for (const user of createdUsers) {
    const result = await deleteSyntheticUser(user.id);
    if (!result.deleted) preserved.push({ ...user, status: result.status });
  }
  if (preserved.length) {
    process.stderr.write(
      `Preserved ${preserved.length} synthetic users from this run because cleanup was blocked.\n`,
    );
  }
}

export async function signIn(page: Page, email: string) {
  await page.route('**/api/core/v1/**', async (route) => {
    const authorization = route.request().headers()['authorization'];
    if (authorization?.startsWith('Bearer ')) {
      const parts = authorization.slice(7).split('.');
      const claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString()) as {
        iss?: string;
        iat?: number;
      };
      if (
        claims.iss !== 'http://127.0.0.1:54321/auth/v1' ||
        typeof claims.iat !== 'number' ||
        !Number.isSafeInteger(claims.iat)
      ) {
        throw new Error('Synthetic readiness requires a local issued-at claim.');
      }
      const issuedAt = claims.iat;
      const aheadSeconds = issuedAt - Math.floor(Date.now() / 1000);
      expect(
        aheadSeconds,
        'Local clock skew exceeds the fixture readiness bound',
      ).toBeLessThanOrEqual(3);
      if (aheadSeconds > 0) {
        await expect
          .poll(() => Math.floor(Date.now() / 1000), { timeout: 5000, intervals: [50, 100, 250] })
          .toBeGreaterThanOrEqual(issuedAt);
        await test.info().attach('synthetic-session-clock', {
          body: JSON.stringify({ ahead_seconds: aheadSeconds, ready: true }),
          contentType: 'application/json',
        });
      }
    }
    await route.continue();
  });
  await page.goto('/login?next=/studio');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(SYNTHETIC_JOURNEY_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/studio');
  await expect(
    page.getByRole('heading', { name: 'Good work starts with the right context.' }),
  ).toBeVisible();
}

export function parseBrandLocation(url: string) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/studio\/([0-9a-f-]{36})\/brands\/([0-9a-f-]{36})$/iu);
  const studioId = parsed.searchParams.get('studio');
  if (!match?.[1] || !match[2] || !studioId) {
    throw new Error('Brand location was not returned.');
  }
  return { workspaceId: match[1], brandId: match[2], studioId, url };
}

export async function createStudioAndBrands(page: Page) {
  await page.getByLabel('Studio name').fill(`Synthetic W1 journeys ${randomUUID()}`);
  await page.getByRole('button', { name: 'Create studio' }).click();
  await expect(page.getByRole('button', { name: '+ Add a brand' })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: '+ Add a brand' }).click();
  await page.getByLabel('Brand name').fill('WashBodega');
  await page.getByRole('button', { name: 'Create brand draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
  ).toBeVisible();
  const washbodega = parseBrandLocation(page.url());
  await page.getByRole('link', { name: '← All brands' }).click();
  await page.getByRole('button', { name: '+ Add a brand' }).click();
  await page.getByLabel('Brand name').fill('UnPile');
  await page.getByRole('button', { name: 'Create brand draft' }).click();
  await expect(page.getByRole('heading', { name: 'Make UnPile feel like itself.' })).toBeVisible();
  const unpile = parseBrandLocation(page.url());
  await page.goto(washbodega.url);
  await expect(
    page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
  ).toBeVisible();
  return {
    washbodegaUrl: washbodega.url,
    unpileUrl: unpile.url,
    workspaceId: washbodega.workspaceId,
    studioId: washbodega.studioId,
    washbodegaBrandId: washbodega.brandId,
    unpileWorkspaceId: unpile.workspaceId,
    unpileBrandId: unpile.brandId,
  };
}

export async function switchToBrand(page: Page, name: string) {
  const select = page.getByLabel('Switch brand');
  await expect(select).toBeVisible({ timeout: 15_000 });
  await expect(select.locator('option', { hasText: name })).toHaveCount(1, { timeout: 15_000 });
  await select.selectOption({ label: name });
  await expect(page.getByRole('heading', { name: `Make ${name} feel like itself.` })).toBeVisible({
    timeout: 15_000,
  });
}

export function findingsUrl(brandUrl: string) {
  const parsed = new URL(brandUrl);
  parsed.searchParams.set('view', 'findings');
  return parsed.toString();
}

export async function revalidateOnFocus(page: Page) {
  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

export function holdBrandPathGets(page: Page, brandId: string, leaf: string) {
  const held: Array<{ release: () => void; completed: Promise<void> }> = [];
  const match = (url: URL) => url.pathname.includes(`/brands/${brandId}/${leaf}`);
  const handler = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    let release: () => void = () => {
      return;
    };
    const opened = new Promise<void>((resolve) => {
      release = () => {
        resolve();
      };
    });
    const request = route.request();
    const completed = (async () => {
      try {
        const response = await route.fetch();
        const body = await response.text();
        await opened;
        await route.fulfill({
          status: response.status(),
          contentType: 'application/json',
          body,
        });
        const browserResponse = await request.response();
        if (browserResponse) await browserResponse.finished();
      } finally {
        release();
      }
    })();
    held.push({ release, completed });
    await completed;
  };
  let installed = false;
  return {
    async install() {
      if (installed) return;
      installed = true;
      await page.route(match, handler);
    },
    async release() {
      for (const item of held) item.release();
      await Promise.all(held.map((item) => item.completed));
    },
    async finish() {
      for (const item of held) item.release();
      await Promise.all(held.map((item) => item.completed));
      if (installed) {
        installed = false;
        await page.unroute(match, handler);
      }
    },
  };
}
