import { expect, test, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import {
  createSyntheticUser,
  deleteSyntheticUser,
  requireConnectedPlatformServers,
  requireMustBeViralDatabase,
  seedLegacyProject,
  seedWorkspaceBilling,
  SEEDED_WALLET_MICROS,
  SYNTHETIC_JOURNEY_PASSWORD,
} from '../../../packages/db/scripts/platform-journey-fixtures';

const connected =
  process.env['MBV_PLATFORM_CONNECTED'] === '1' && process.env['MBV_PLAYWRIGHT_EXTERNAL'] === '1';
const FORGED_ID = '00000000-0000-4000-8000-ffffffffffff';
const NOT_FOUND_COPY = 'unavailable or your access has changed';
const createdUsers: Array<{ id: string; email: string }> = [];
const preservedUsers: Array<{ id: string; email: string; status: number }> = [];

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

test.describe('connected platform journeys', () => {
  test.describe.configure({ retries: 0 });
  test.beforeAll(async () => {
    if (!connected) return;
    requireMustBeViralDatabase();
    await requireConnectedPlatformServers();
  });

  test.afterAll(async () => {
    if (!connected || createdUsers.length === 0) return;
    requireMustBeViralDatabase();
    for (const user of createdUsers) {
      const result = await deleteSyntheticUser(user.id);
      if (!result.deleted) preservedUsers.push({ ...user, status: result.status });
    }
    if (preservedUsers.length) {
      process.stderr.write(
        `Preserved ${preservedUsers.length} synthetic users from this run because cleanup was blocked.\n`,
      );
    }
  });

  test.beforeEach(() => {
    test.skip(
      !connected,
      'Requires MustBeViral start-platform-local.mjs on 127.0.0.1:3111/8789 with MBV_PLATFORM_CONNECTED=1 and MBV_PLAYWRIGHT_EXTERNAL=1',
    );
  });

  test('keeps unauthenticated studio entry on the live sign-in path', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('#lumen-skin, [data-fixture]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp('^http://127\\.0\\.0\\.1:3111/'));
  });

  test('saves WashBodega and UnPile separately through reload, reconnect, concurrency, and interrupted leave', async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`w1b004-owner-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await saveDraftDescription(page, 'WashBodega operator input, not approved knowledge.');
    await page.screenshot({ path: test.info().outputPath('washbodega-saved.png'), fullPage: true });
    await page.getByLabel('Switch brand').selectOption({ label: 'UnPile' });
    await expect(
      page.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
    ).toBeVisible();
    await expect(page.getByLabel('What should we know?')).not.toHaveValue(/WashBodega/);
    await saveDraftDescription(page, 'UnPile operator input stays on UnPile.');
    await page.screenshot({ path: test.info().outputPath('unpile-saved.png'), fullPage: true });
    await page.reload();
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'UnPile operator input stays on UnPile.',
    );
    await page.goBack();
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible();
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'WashBodega operator input, not approved knowledge.',
    );
    await page.goForward();
    await expect(
      page.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
    ).toBeVisible();
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'UnPile operator input stays on UnPile.',
    );
    await expect(page.getByText(/analyzed your website|approved knowledge/i)).toHaveCount(0);

    const competitor = await page.context().newPage();
    await competitor.goto(brands.unpileUrl);
    await expect(competitor.getByLabel('What should we know?')).toHaveValue(
      'UnPile operator input stays on UnPile.',
    );
    await page.getByLabel('What should we know?').fill('UnPile concurrent owner edit.');
    await competitor.getByLabel('What should we know?').fill('UnPile concurrent second edit.');
    await Promise.all([
      page.getByRole('button', { name: 'Save draft' }).click(),
      competitor.getByRole('button', { name: 'Save draft' }).click(),
    ]);
    await expect
      .poll(async () => {
        const onPage = await page.getByText('newer version').count();
        const onCompetitor = await competitor.getByText('newer version').count();
        return onPage + onCompetitor;
      })
      .toBeGreaterThan(0);
    await competitor.close();
    await page.goto(brands.unpileUrl);
    await expect(page.getByLabel('What should we know?')).not.toHaveValue(/WashBodega/);

    await page.getByLabel('What should we know?').fill('Interrupted UnPile edit must not save.');
    await expect(page.getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByRole('link', { name: '← All brands' }).click();
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'Interrupted UnPile edit must not save.',
    );
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('link', { name: '← All brands' }).click();
    await expect(
      page.getByRole('heading', { name: 'Good work starts with the right context.' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Open UnPile →' }).click();
    await expect(page.getByLabel('What should we know?')).not.toHaveValue(
      'Interrupted UnPile edit must not save.',
    );
    await expectReconnectedSavedDrafts(browser, owner.email, brands);
  });

  test('hides forged identities, recovers old links, archives, and invites without outreach', async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`w1b004-nav-${randomUUID()}@synthetic.example.test`);
    const editor = await registerUser(`w1b004-editor-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    const studioQuery = new URL(brands.washbodegaUrl).search;
    await page.goto(`/studio/${FORGED_ID}/brands/${FORGED_ID}${studioQuery}`);
    await expect(page.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(page.getByText('do not have permission')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /WashBodega|UnPile/ })).toHaveCount(0);
    await page.goto(`/studio/${FORGED_ID}/billing`);
    await expect(page.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(page.getByText('$')).toHaveCount(0);
    await expect(page.getByText('Saved wallet')).toHaveCount(0);

    const project = await seedLegacyProject(
      brands.workspaceId,
      owner.id,
      'Legacy synthetic campaign',
    );
    await page.goto(`/studio/${brands.workspaceId}/projects/${project.id}`);
    await expect(
      page.getByRole('heading', { name: 'This project needs a brand mapping.' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /WashBodega|UnPile/ })).toHaveCount(0);

    await page.goto(brands.washbodegaUrl);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Archive brand' })).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Archive brand' }).click();
    await expect(page.getByText('This brand is archived')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: '← All brands' }).click();
    await expect(page.getByRole('link', { name: 'Open WashBodega →' })).toHaveCount(0);
    await page.getByLabel('Show').selectOption('all');
    await expect(page.getByRole('link', { name: 'Open WashBodega →' })).toBeVisible();
    await page.goto(brands.washbodegaUrl);
    await expect(page.getByText('This brand is archived')).toBeVisible();

    await page.goto(`/studio${studioQuery}&view=team`);
    await expect(page.getByText('No email is sent')).toBeVisible();
    await page.getByLabel('Verified email').fill(editor.email);
    await page.getByLabel('Studio role').selectOption('editor');
    await page.getByRole('button', { name: 'Save invitation' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Invitation saved' })).toBeVisible();
    const pendingInvite = page.getByRole('article').filter({ hasText: editor.email });
    await expect(pendingInvite.getByRole('heading', { name: editor.email })).toBeVisible();
    await expect(pendingInvite.getByText(/editor · pending/)).toBeVisible();
    await expect(page.getByLabel('Verified email')).toHaveValue('');
    await expect(page.getByLabel('Studio role')).toHaveValue('viewer');
    await expect(page.getByText('No email is sent')).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('invitation-pending.png'),
      fullPage: true,
    });
    await expect(page.getByText(/we emailed|sms/i)).toHaveCount(0);

    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await signIn(editorPage, editor.email);
    await expect(editorPage.getByRole('button', { name: 'Accept invitation' })).toBeVisible();
    await editorPage.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(editorPage.getByRole('link', { name: 'Open UnPile →' })).toBeVisible();
    await editorPage.getByRole('link', { name: 'Open UnPile →' }).click();
    await expect(
      editorPage.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
    ).toBeVisible();
    await editorPage.goto(`/studio/${brands.workspaceId}/billing`);
    await expect(editorPage.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(editorPage.getByText('$250.00')).toHaveCount(0);

    await page.reload();
    await page.getByRole('button', { name: 'Revoke access' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Studio access revoked' }),
    ).toBeVisible();
    await editorPage.goto(brands.unpileUrl);
    await expect(editorPage.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(
      editorPage.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
    ).toHaveCount(0);
    await editorContext.close();
  });

  test('reads seeded integer billing, missing profile, unavailable, and keyboard skip targets', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`w1b004-bill-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await page.goto(brands.washbodegaUrl);
    await page.locator('.skip-link').focus();
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await expect(page.locator('.skip-link')).toBeVisible();

    await page.goto(`/studio/${brands.workspaceId}/billing`);
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Charging is turned off' }),
    ).toBeVisible();
    await expect(page.getByText('No billing profile is on file')).toBeVisible();
    await expect(page.getByText('Missing profile')).toBeVisible();
    await expect(page.getByText('Not available')).toBeVisible();
    await expect(page.getByText('Checkout')).toHaveCount(0);
    await page.locator('.skip-link').focus();
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();

    await seedWorkspaceBilling(brands.workspaceId);
    await page.reload();
    await expect(page.getByText('$250.00', { exact: true })).toBeVisible();
    await expect(page.getByText('Subscription: active')).toBeVisible();
    await expect(page.getByText('Charging is turned off')).toBeVisible();
    await expect(page.getByText('No billing profile is on file')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('billing-seeded.png'), fullPage: true });
    expect(SEEDED_WALLET_MICROS).toBe('250000000');

    await page.route('**/api/core/v1/workspaces/*/billing', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'hidden' } }),
      });
    });
    await page.reload();
    await expect(page.getByText('We could not confirm this request')).toBeVisible();
    await expect(page.getByText('not marked as saved')).toHaveCount(0);
    await expect(page.getByText('$250.00')).toHaveCount(0);
    await page.unroute('**/api/core/v1/workspaces/*/billing');
  });
});

async function registerUser(email: string) {
  requireMustBeViralDatabase();
  const user = await createSyntheticUser(email);
  createdUsers.push(user);
  return user;
}

async function signIn(page: Page, email: string) {
  await page.goto('/login?next=/studio');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(SYNTHETIC_JOURNEY_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/studio');
  await expect(
    page.getByRole('heading', { name: 'Good work starts with the right context.' }),
  ).toBeVisible();
}

async function createStudioAndBrands(page: Page) {
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
  const washbodegaUrl = page.url();
  const workspaceId = washbodegaUrl.match(/\/studio\/([0-9a-f-]{36})\//i)?.[1];
  if (!workspaceId) throw new Error('WashBodega workspace identity was not returned.');
  await page.getByRole('link', { name: '← All brands' }).click();
  await page.getByRole('button', { name: '+ Add a brand' }).click();
  await page.getByLabel('Brand name').fill('UnPile');
  await page.getByRole('button', { name: 'Create brand draft' }).click();
  await expect(page.getByRole('heading', { name: 'Make UnPile feel like itself.' })).toBeVisible();
  const unpileUrl = page.url();
  await page.goto(washbodegaUrl);
  await expect(
    page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
  ).toBeVisible();
  return { washbodegaUrl, unpileUrl, workspaceId };
}

async function saveDraftDescription(page: Page, value: string) {
  await page.getByLabel('What should we know?').fill(value);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible();
  await expect(page.getByLabel('What should we know?')).toHaveValue(value);
}

async function expectReconnectedSavedDrafts(
  browser: Browser,
  email: string,
  brands: { washbodegaUrl: string; unpileUrl: string },
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email);
  await expect(
    page.getByRole('heading', { name: 'Good work starts with the right context.' }),
  ).toBeVisible();
  await page.goto(brands.washbodegaUrl);
  await expect(
    page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByLabel('What should we know?')).toHaveValue(
    'WashBodega operator input, not approved knowledge.',
  );
  await page.goto(brands.unpileUrl);
  await expect(page.getByLabel('What should we know?')).not.toHaveValue(
    'Interrupted UnPile edit must not save.',
  );
  await expect(page.getByLabel('What should we know?')).not.toHaveValue(/WashBodega/);
  await context.close();
}
