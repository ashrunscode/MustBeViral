import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type Request,
  type Route,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  requireConnectedPlatformServers,
  requireMustBeViralDatabase,
  seedLegacyProject,
  seedProjectBrandMapping,
  seedWorkspaceBilling,
  SEEDED_WALLET_MICROS,
} from '../../../packages/db/scripts/platform-journey-fixtures';
import {
  cleanupSyntheticUsers,
  createStudioAndBrands,
  FORGED_ID,
  NOT_FOUND_COPY,
  registerSyntheticUser,
  signIn,
  switchToBrand,
} from './platform-journey-helpers';

const connected =
  process.env['MBV_PLATFORM_CONNECTED'] === '1' && process.env['MBV_PLAYWRIGHT_EXTERNAL'] === '1';
const createdUsers: Array<{ id: string; email: string }> = [];

test.use({
  screenshot: 'off',
  trace: 'off',
  video: 'off',
  actionTimeout: 15_000,
  navigationTimeout: 30_000,
});

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
    await cleanupSyntheticUsers(createdUsers);
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
    await captureSignedInSurface(page, 'washbodega-saved.png');
    await page
      .getByLabel('What should we know?')
      .fill('Unsaved WashBodega stays through revalidation.');
    await expect(page.getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
    await revalidateOnFocus(page);
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'Unsaved WashBodega stays through revalidation.',
    );
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    const heldAccess = holdBrandAccessGets(page, brands.washbodegaBrandId);
    await heldAccess.install();
    try {
      await revalidateOnFocus(page);
      await expect(page.getByText('Confirming your access…')).toBeVisible();
      await expect(page.getByLabel('What should we know?')).toHaveValue(
        'Unsaved WashBodega stays through revalidation.',
      );
      await expect(page.getByLabel('What should we know?')).toBeDisabled();
      await expect(page.getByLabel('What should we know?')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
      await heldAccess.release();
      await expect(page.getByLabel('What should we know?')).toHaveValue(
        'Unsaved WashBodega stays through revalidation.',
      );
      await expect(page.getByLabel('What should we know?')).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    } finally {
      await heldAccess.finish();
    }
    // Reverting to the already saved value is clean; no redundant write should be enabled.
    await page
      .getByLabel('What should we know?')
      .fill('WashBodega operator input, not approved knowledge.');
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible();
    await switchToBrand(page, 'UnPile');
    await expect(page.getByLabel('What should we know?')).not.toHaveValue(/WashBodega/);
    await saveDraftDescription(page, 'UnPile operator input stays on UnPile.');
    await captureSignedInSurface(page, 'unpile-saved.png');
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
    // UI journey only. Invitation lifecycle, recipient/owner injection, idempotency, and
    // NOT_FOUND parity are in packages/contracts/src/platform-setup.test.ts,
    // packages/contracts/src/platform.test.ts, apps/core/test/unit/platform-parity.test.ts,
    // and apps/core/test/unit/platform-port.test.ts. Authorization handlers are the shared
    // SQL functions covered by supabase/tests/database/00038_platform_operations.test.sql,
    // 00039_platform_saved_setup.test.sql, and packages/db/scripts/verify-platform-setup-connected.mjs.
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
    await captureSignedInSurface(page, 'invitation-pending.png');
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
    ).toBeVisible({ timeout: 15_000 });
    await editorPage.goto(`/studio/${brands.workspaceId}/billing`);
    await expect(editorPage.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(editorPage.getByText('$250.00')).toHaveCount(0);

    await editorPage.goto(brands.unpileUrl);
    await expect(
      editorPage.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });
    const heldDraft = holdBrandOnboardingGets(editorPage, brands.unpileBrandId);
    await heldDraft.install();
    try {
      await editorPage.getByRole('link', { name: 'Settings', exact: true }).click();
      await expect(editorPage.getByRole('heading', { name: 'Brand settings.' })).toBeVisible();
      await editorPage.getByRole('link', { name: 'Brand draft' }).click();
      await expect(editorPage.getByText('Loading your saved draft')).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: 'Revoke access' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Studio access revoked' }),
      ).toBeVisible();
      await editorPage.bringToFront();
      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(editorPage.getByText(NOT_FOUND_COPY)).toBeVisible({ timeout: 15_000 });
      await expect(
        editorPage.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
      ).toHaveCount(0);
      await heldDraft.release();
      await expect(editorPage.getByText(NOT_FOUND_COPY)).toBeVisible();
      await expect(editorPage.getByLabel('What should we know?')).toHaveCount(0);
      await expect(
        editorPage.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
      ).toHaveCount(0);
    } finally {
      await heldDraft.finish();
    }
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

    await page.getByRole('link', { name: 'Billing & usage' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Campaign workflow' })).toHaveCount(0);
    await expect(
      page.getByRole('status').filter({ hasText: 'Charging is turned off' }),
    ).toBeVisible();
    await expect(page.getByText('No billing profile is on file')).toBeVisible();
    await expect(page.getByText('Missing profile')).toBeVisible();
    await expect(page.getByText('Not available')).toBeVisible();
    await expect(page.getByText('Checkout')).toHaveCount(0);
    await page.locator('.skip-link').focus();
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

    await seedWorkspaceBilling(brands.workspaceId);
    await page.reload();
    await expect(page.getByText('$250.00', { exact: true })).toBeVisible();
    await expect(page.getByText('Subscription: active')).toBeVisible();
    await expect(page.getByText('Charging is turned off')).toBeVisible();
    await expect(page.getByText('No billing profile is on file')).toHaveCount(0);
    await captureSignedInSurface(page, 'billing-seeded.png');
    expect(SEEDED_WALLET_MICROS).toBe('250000000');

    await page.getByRole('link', { name: 'Switch studio' }).click();
    await expect(
      page.getByRole('heading', { name: 'Good work starts with the right context.' }),
    ).toBeVisible();
    const unrelatedName = `Unrelated studio ${randomUUID()}`;
    await page.getByLabel('Studio name').fill(unrelatedName);
    await page.getByRole('button', { name: 'Create studio' }).click();
    await expect(page.getByRole('button', { name: '+ Add a brand' })).toBeVisible({
      timeout: 60_000,
    });
    const unrelatedStudioId = new URL(page.url()).searchParams.get('studio');
    if (!unrelatedStudioId) throw new Error('Unrelated studio identity was not returned.');
    await page.goto(`/studio/${brands.workspaceId}/billing?studio=${unrelatedStudioId}`);
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.getByText('$250.00', { exact: true })).toBeVisible();
    await expect(page.locator('.platform-breadcrumb')).toHaveText('Your studios');
    await expect(page.getByText(unrelatedName)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Studio team' })).toHaveCount(0);
    await page.goto(`/studio/${brands.workspaceId}/billing`);
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.locator('.platform-breadcrumb')).toHaveText('Your studios');
    await expect(page.getByRole('link', { name: 'Studio team' })).toHaveCount(0);

    await page.goto(brands.washbodegaUrl);
    await page.getByRole('link', { name: 'Billing & usage' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Studio team' })).toBeVisible();

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
    await page.getByRole('link', { name: 'Overview' }).click();
    await expect(
      page.getByRole('heading', { name: 'Good work starts with the right context.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open WashBodega →' })).toBeVisible();
  });

  test('retries an aborted in-flight save without mixing a deferred UnPile commit', async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`w1b004-save-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await saveDraftDescription(page, 'WashBodega operator input, not approved knowledge.');
    await switchToBrand(page, 'UnPile');

    const capturedKeys: string[] = [];
    const capturedBodies: string[] = [];
    const capturedVersions: number[] = [];
    const saveUrl = '**/api/core/v1/workspaces/*/brands/*/onboarding';
    await page.route(saveUrl, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      capturedKeys.push(route.request().headers()['idempotency-key'] ?? '');
      capturedBodies.push(route.request().postData() ?? '');
      const response = await route.fetch();
      capturedVersions.push(readSavedVersion(await response.text()));
      await route.abort('connectionreset');
    });

    const interrupted = 'Interrupted UnPile save after server commit.';
    await page.getByLabel('What should we know?').fill(interrupted);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'not marked as saved' })).toBeVisible();
    await expect(page.getByLabel('What should we know?')).toHaveValue(interrupted);
    await expect(page.getByRole('button', { name: 'Retry the same save' })).toBeVisible();

    await page.unroute(saveUrl);
    await page.route(saveUrl, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      capturedKeys.push(route.request().headers()['idempotency-key'] ?? '');
      capturedBodies.push(route.request().postData() ?? '');
      const response = await route.fetch();
      const body = await response.text();
      capturedVersions.push(readSavedVersion(body));
      await route.fulfill({ status: response.status(), contentType: 'application/json', body });
    });
    await page.getByRole('button', { name: 'Retry the same save' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Saved · version / })).toBeVisible();
    await expect(page.getByLabel('What should we know?')).toHaveValue(interrupted);
    expect(capturedKeys).toHaveLength(2);
    expect(capturedKeys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(capturedKeys[0]).toBe(capturedKeys[1]);
    expect(capturedBodies[0]).toBe(capturedBodies[1]);
    expect(capturedVersions[0]).toBe(capturedVersions[1]);
    const savedVersion = capturedVersions[1];
    if (savedVersion === undefined) throw new Error('Retry did not return a server version.');
    await expect(
      page.getByRole('status').filter({ hasText: `Saved · version ${savedVersion}` }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('What should we know?')).toHaveValue(interrupted);
    await expect(
      page.getByRole('status').filter({ hasText: `Saved · version ${savedVersion}` }),
    ).toBeVisible();
    const context = await browser.newContext();
    const reconnected = await context.newPage();
    await signIn(reconnected, owner.email);
    await reconnected.goto(brands.unpileUrl);
    await expect(reconnected.getByLabel('What should we know?')).toHaveValue(interrupted);
    await expect(
      reconnected.getByRole('status').filter({ hasText: `Saved · version ${savedVersion}` }),
    ).toBeVisible();
    await context.close();
    await page.unroute(saveUrl);

    const deferred = createGate();
    let deferredCompleted = Promise.resolve();
    let deferredSaves = 0;
    await page.goto(brands.unpileUrl);
    await expect(page.getByRole('heading', { name: 'Make UnPile feel like itself.' })).toBeVisible({
      timeout: 15_000,
    });
    await page.route(saveUrl, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const request = route.request();
      deferredSaves += 1;
      deferredCompleted = (async () => {
        const response = await route.fetch();
        const body = await response.text();
        await deferred.opened;
        await route.fulfill({ status: response.status(), contentType: 'application/json', body });
        await waitForBrowserResponse(request);
      })();
      await deferredCompleted;
    });
    await page.getByLabel('What should we know?').fill('UnPile deferred save stays on UnPile.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saving' })).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('link', { name: '← All brands' }).click();
    await expect(
      page.getByRole('heading', { name: 'Good work starts with the right context.' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Open WashBodega →' }).click();
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'WashBodega operator input, not approved knowledge.',
    );
    expect(deferredSaves).toBeGreaterThan(0);
    deferred.release();
    await deferredCompleted;
    await waitForRenderTurn(page);
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible();
    await expect(page.getByLabel('What should we know?')).not.toHaveValue(/UnPile deferred/);
    await page.getByRole('link', { name: '← All brands' }).click();
    await page.getByRole('link', { name: 'Open UnPile →' }).click();
    await expect(page.getByRole('heading', { name: 'Make UnPile feel like itself.' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'UnPile deferred save stays on UnPile.',
    );
  });

  test('holds delayed old-brand HTTP and resolves mapped old links without wrong-parent leakage', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`w1b004-map-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await saveDraftDescription(page, 'WashBodega operator input, not approved knowledge.');
    await switchToBrand(page, 'UnPile');
    await saveDraftDescription(page, 'UnPile operator input stays on UnPile.');
    await page.goto(brands.washbodegaUrl);
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });

    const heldWashbodega = holdBrandOnboardingGets(page, brands.washbodegaBrandId);
    await heldWashbodega.install();
    try {
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Brand settings.' })).toBeVisible();
      await page.getByRole('link', { name: 'Brand draft' }).click();
      await expect(page.getByText('Loading your saved draft')).toBeVisible();
      await switchToBrand(page, 'UnPile');
      await expect(page.getByLabel('What should we know?')).toHaveValue(
        'UnPile operator input stays on UnPile.',
      );
      await heldWashbodega.release();
      await expect(
        page.getByRole('heading', { name: 'Make UnPile feel like itself.' }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
      ).toHaveCount(0);
      await expect(page.getByLabel('What should we know?')).not.toHaveValue(/WashBodega/);
    } finally {
      await heldWashbodega.finish();
    }

    const project = await seedLegacyProject(
      brands.workspaceId,
      owner.id,
      `Mapped synthetic campaign ${randomUUID()}`,
    );
    await seedProjectBrandMapping(brands.workspaceId, project.id, brands.washbodegaBrandId);
    await page.goto(`/studio/${brands.workspaceId}/projects/${project.id}`);
    await expect(
      page.getByRole('heading', { name: 'This project needs a brand mapping.' }),
    ).toHaveCount(0);
    await page.getByRole('link', { name: /Open brand/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'WashBodega operator input, not approved knowledge.',
    );
    await expect(page.getByLabel('What should we know?')).not.toHaveValue(/UnPile/);
    await page.goto(`/studio/${brands.unpileWorkspaceId}/projects/${project.id}`);
    await expect(page.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(page.getByRole('heading', { name: /WashBodega|UnPile/ })).toHaveCount(0);
    await page.goto(brands.unpileUrl);
    await expect(page.getByRole('heading', { name: 'Make UnPile feel like itself.' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'UnPile operator input stays on UnPile.',
    );
  });

  test('keeps keyboard, landmarks, contrast, zoom, and motion evidence on connected studio', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`w1b004-a11y-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeVisible();
    await expectPlatformLandmarks(page);
    await expectNoHorizontalOverflow(page);
    await attachAxeAndAria(page, 'portfolio');

    const brands = await createStudioAndBrands(page);
    await expectPlatformLandmarks(page);
    await expectSkipKeyboard(page);
    const reached = await tabActionableNames(page, 16);
    expect(reached.join(' ')).toMatch(/All brands|Switch brand|Brand draft|Save draft|Billing/i);

    const keyboardField = page.getByLabel('What should we know?');
    const keyboardSave = page.getByRole('button', { name: 'Save draft' });
    await expect(keyboardField).toBeVisible();
    await expect(keyboardField).toBeEnabled();
    await keyboardField.focus();
    await expect(keyboardField).toBeFocused();
    await keyboardField.pressSequentially('Keyboard WashBodega draft stays on WashBodega.');
    await expect(keyboardField).toHaveValue('Keyboard WashBodega draft stays on WashBodega.');
    await expect(keyboardSave).toBeEnabled();
    await keyboardSave.focus();
    await expect(keyboardSave).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Saved · version 2' })).toBeVisible();
    await captureSignedInSurface(page, 'a11y-brand-draft.png');
    await attachAxeAndAria(page, 'brand-draft');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Studio team' }).click();
    await expect(page.getByRole('heading', { name: 'Your studio team.' })).toBeVisible({
      timeout: 15_000,
    });
    await attachAxeAndAria(page, 'studio-team');

    await page.getByRole('link', { name: 'Overview' }).click();
    await page.getByRole('link', { name: 'Open WashBodega →' }).click();
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'Billing & usage' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Campaign workflow' })).toHaveCount(0);
    await expectSkipKeyboard(page);
    await attachAxeAndAria(page, 'billing-missing');

    await seedWorkspaceBilling(brands.workspaceId);
    await page.reload();
    await expect(page.getByText('$250.00', { exact: true })).toBeVisible();
    await captureSignedInSurface(page, 'a11y-billing-seeded.png');
    await attachAxeAndAria(page, 'billing-success');

    await page.route('**/api/core/v1/workspaces/*/billing', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'hidden' } }),
      });
    });
    await page.reload();
    await expect(page.getByText('We could not confirm this request')).toBeVisible();
    await attachAxeAndAria(page, 'billing-unavailable');
    await page.unroute('**/api/core/v1/workspaces/*/billing');

    await page.getByRole('link', { name: 'Overview' }).click();
    await page.getByRole('link', { name: 'Open WashBodega →' }).click();
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    const zoomHeading = page.getByRole('heading', { name: 'Make WashBodega feel like itself.' });
    const zoomSave = page.getByRole('button', { name: 'Save draft' });
    await expectScrolledIntoViewport(zoomHeading);
    await page
      .getByLabel('What should we know?')
      .fill('Keyboard save at 200 percent remains usable.');
    await expectActionableInViewport(zoomSave);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureSignedInSurface(page, 'a11y-zoom-200.png');
    await page.evaluate(() => {
      document.documentElement.style.removeProperty('zoom');
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectReducedMotionDurations(page);
    await expectSkipKeyboard(page);
    await captureSignedInSurface(page, 'a11y-reduced-motion.png');

    await page.emulateMedia({ forcedColors: 'active' });
    await expectForcedColorsSemantics(page);
    await expectScrolledIntoViewport(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    );
    await captureSignedInSurface(page, 'a11y-forced-colors.png');
    await test.info().attach('forced-colors-aria', {
      body: await page.locator('.platform-app').ariaSnapshot(),
      contentType: 'text/plain',
    });
  });
});

async function registerUser(email: string) {
  requireMustBeViralDatabase();
  return registerSyntheticUser(email, createdUsers);
}

async function saveDraftDescription(page: Page, value: string) {
  await expect(page.getByRole('heading', { name: /feel like itself/ })).toBeVisible({
    timeout: 15_000,
  });
  const save = page.getByRole('button', { name: 'Save draft' });
  await page.getByLabel('What should we know?').fill(value);
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible({
    timeout: 15_000,
  });
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

function createGate() {
  let release: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    opened,
    release() {
      release();
    },
  };
}

function holdBrandOnboardingGets(page: Page, brandId: string) {
  return holdBrandPathGets(page, brandId, 'onboarding');
}

function holdBrandAccessGets(page: Page, brandId: string) {
  return holdBrandPathGets(page, brandId, 'access');
}

function holdBrandPathGets(page: Page, brandId: string, leaf: 'onboarding' | 'access') {
  const held: Array<{ release: () => void; completed: Promise<void>; request: Request }> = [];
  const match = (url: URL) => url.pathname.includes(`/brands/${brandId}/${leaf}`);
  const handler = async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const request = route.request();
    const gate = createGate();
    const completed = (async () => {
      try {
        const response = await route.fetch();
        const body = await response.text();
        await gate.opened;
        await route.fulfill({
          status: response.status(),
          contentType: 'application/json',
          body,
        });
        await waitForBrowserResponse(request);
      } finally {
        gate.release();
      }
    })();
    held.push({ release: gate.release, completed, request });
    await completed;
  };
  let installed = false;
  return {
    async install() {
      await page.route(match, handler);
      installed = true;
    },
    async release() {
      expect(held.length).toBeGreaterThan(0);
      for (const item of held) item.release();
      await Promise.all(held.map((item) => item.completed));
      await waitForRenderTurn(page);
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

async function waitForBrowserResponse(request: Request) {
  const response = await request.response();
  if (!response) throw new Error('Intercepted request did not reach a browser response.');
  const error = await response.finished();
  if (error) throw error;
}

async function waitForRenderTurn(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function expectScrolledIntoViewport(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
}

async function expectActionableInViewport(locator: Locator) {
  await expectScrolledIntoViewport(locator);
  await expect(locator).toBeEnabled();
  await locator.focus();
  await expect(locator).toBeFocused();
}

async function captureSignedInSurface(page: Page, name: string) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('platform-main');
    if (main instanceof HTMLElement) main.focus();
  });
  await page.screenshot({ path: test.info().outputPath(name), fullPage: true });
}

async function expectPlatformLandmarks(page: Page) {
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
}

async function expectSkipKeyboard(page: Page) {
  await page.evaluate(() => {
    const body = document.body;
    body.setAttribute('tabindex', '-1');
    body.focus();
    body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  const focusedClip = await skip.evaluate((el) =>
    getComputedStyle(el).clipPath.replace(/\s+/gu, ''),
  );
  expect(focusedClip.includes('inset(50%')).toBe(false);
  await page.keyboard.press('Enter');
  await expect(page.locator('#platform-main')).toBeFocused();
  const clipped = await skip.evaluate((el) => getComputedStyle(el).clipPath.replace(/\s+/gu, ''));
  expect(clipped).toMatch(/inset\(50%/u);
}

async function revalidateOnFocus(page: Page) {
  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function tabActionableNames(page: Page, steps: number) {
  const names: string[] = [];
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press('Tab');
    names.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return '';
        return (
          active.getAttribute('aria-label') ||
          active.textContent ||
          active.getAttribute('name') ||
          active.tagName
        )
          .replace(/\s+/gu, ' ')
          .trim()
          .slice(0, 80);
      }),
    );
  }
  return names;
}

async function expectNoHorizontalOverflow(page: Page) {
  const box = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
}

function cssTimeSeconds(value: string) {
  return Math.max(
    0,
    ...value.split(',').map((part) => {
      const token = part.trim();
      if (token.endsWith('ms')) return Number.parseFloat(token) / 1000;
      if (token.endsWith('s')) return Number.parseFloat(token);
      return 0;
    }),
  );
}

async function expectReducedMotionDurations(page: Page) {
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('.platform-app, .platform-app *')].slice(0, 60).map((node) => {
      const style = getComputedStyle(node);
      return {
        transitionDuration: style.transitionDuration,
        animationDuration: style.animationDuration,
      };
    }),
  );
  for (const duration of durations) {
    expect(cssTimeSeconds(duration.transitionDuration)).toBeLessThanOrEqual(0.05);
    expect(cssTimeSeconds(duration.animationDuration)).toBeLessThanOrEqual(0.05);
  }
}

async function expectForcedColorsSemantics(page: Page) {
  const snapshot = await page.evaluate(() => {
    const heading = document.querySelector('.platform-app h1');
    const card = document.querySelector('.platform-card');
    const active = document.querySelector('.platform-tabs a[aria-current="page"]');
    const primary = document.querySelector('button.platform-primary');
    const styleOf = (node: Element | null) => (node ? getComputedStyle(node) : null);
    const headingStyle = styleOf(heading);
    const cardStyle = styleOf(card);
    const activeStyle = styleOf(active);
    const primaryStyle = styleOf(primary);
    return {
      forced: window.matchMedia('(forced-colors: active)').matches,
      headingColor: headingStyle?.color ?? '',
      headingBackground: headingStyle?.backgroundColor ?? '',
      cardColor: cardStyle?.color ?? '',
      cardBackground: cardStyle?.backgroundColor ?? '',
      activeColor: activeStyle?.color ?? '',
      activeBackground: activeStyle?.backgroundColor ?? '',
      activeDecoration: activeStyle?.textDecorationLine ?? '',
      primaryColor: primaryStyle?.color ?? '',
      primaryBackground: primaryStyle?.backgroundColor ?? '',
      primaryDisabled: primary instanceof HTMLButtonElement ? primary.disabled : false,
      primaryOpacity: primaryStyle?.opacity ?? '',
    };
  });
  expect(snapshot.forced).toBe(true);
  expect(snapshot.headingColor).not.toBe(snapshot.headingBackground);
  expect(snapshot.cardColor).not.toBe(snapshot.cardBackground);
  expect(snapshot.activeColor).not.toBe('');
  expect(snapshot.activeColor).not.toBe(snapshot.activeBackground);
  expect(snapshot.activeDecoration).toMatch(/underline/u);
  expect(snapshot.primaryColor).not.toBe('');
  expect(snapshot.primaryColor).not.toBe(snapshot.primaryBackground);
  if (snapshot.primaryDisabled) {
    expect(Number.parseFloat(snapshot.primaryOpacity)).toBeGreaterThan(0.9);
  }
}

function readSavedVersion(body: string) {
  const payload = JSON.parse(body) as { data?: { record?: { version?: number } } };
  const version = payload.data?.record?.version;
  if (typeof version !== 'number') throw new Error('Save did not return a server version.');
  return version;
}

function findRepoRoot(): string {
  let current = process.cwd();
  for (;;) {
    if (
      existsSync(join(current, 'pnpm-workspace.yaml')) &&
      existsSync(join(current, 'package.json'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) throw new Error('MustBeViral repository root was not found.');
    current = parent;
  }
}

function resolveAxeCoreScript(): string {
  const fromProject = createRequire(pathToFileURL(join(findRepoRoot(), 'package.json')).href);
  const fromEslintConfigNext = createRequire(fromProject.resolve('eslint-config-next'));
  const fromJsxA11y = createRequire(fromEslintConfigNext.resolve('eslint-plugin-jsx-a11y'));
  return fromJsxA11y.resolve('axe-core/axe.min.js');
}

async function attachAxeAndAria(page: Page, label: string) {
  const info = test.info();
  const snapshot = await page.locator('.platform-app').ariaSnapshot();
  await info.attach(`${label}-aria`, { body: snapshot, contentType: 'text/plain' });
  const axeLoaded = await page.evaluate(() => 'axe' in window);
  if (!axeLoaded) await page.addScriptTag({ path: resolveAxeCoreScript() });
  const compact = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: { runOnly: { type: string; values: string[] } },
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              help: string;
              tags: string[];
              nodes: Array<{ target: string[]; failureSummary?: string }>;
            }>;
            incomplete: Array<{
              id: string;
              impact: string | null;
              help: string;
              nodes: Array<{ target: string[]; failureSummary?: string }>;
            }>;
            passes: unknown[];
          }>;
        };
      }
    ).axe;
    const results = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
    return {
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        tags: violation.tags.filter((tag) => tag.startsWith('wcag')),
        nodes: violation.nodes.slice(0, 6).map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      })),
      incomplete: results.incomplete.map((item) => ({
        id: item.id,
        impact: item.impact,
        help: item.help,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      })),
      passes: results.passes.length,
    };
  });
  await info.attach(`${label}-axe`, {
    body: JSON.stringify(compact),
    contentType: 'application/json',
  });
  expect(compact.violations).toEqual([]);
}
