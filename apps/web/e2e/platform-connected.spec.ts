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
  openBrandDraft,
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

  test('keeps studio breadcrumb targets complete and keyboard usable at every supported width', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const owner = await registerUser(`breadcrumb-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const names = [
      'Synthetic breadcrumb studio',
      'Synthetic breadcrumb studio with a deliberately long name for narrow screens',
    ];
    await page.getByLabel('Studio name').fill(names[0]!);
    await page.getByRole('button', { name: 'Create studio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Studio overview', exact: true })).toBeVisible();
    const studioId = new URL(page.url()).searchParams.get('studio');
    expect(studioId).not.toBeNull();
    const studioUrl = `/studio?studio=${studioId}`;

    for (const [index, name] of names.entries()) {
      if (index > 0) {
        await page.goto(`${studioUrl}&view=settings`);
        await page.getByLabel('Studio name').fill(name);
        await page.getByRole('button', { name: 'Save studio name', exact: true }).click();
        await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(name);
      }
      for (const width of [375, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 1024 });
        await page.goto(`${studioUrl}&view=creators`);
        const link = page
          .getByRole('navigation', { name: 'Breadcrumb' })
          .getByRole('link', { name, exact: true });
        await expect(link).toBeVisible();
        await link.scrollIntoViewIfNeeded();
        const box = await link.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const hits = await link.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const inside = (y: number) => {
            const target = document.elementFromPoint(x, y);
            return target !== null && element.contains(target);
          };
          return {
            top: inside(rect.top + 0.5),
            bottom: inside(rect.bottom - 0.5),
            outsideTop: inside(rect.top - 1),
            outsideBottom: inside(rect.bottom + 1),
          };
        });
        expect(hits).toEqual({ top: true, bottom: true, outsideTop: false, outsideBottom: false });
        await link.focus();
        await expect(link).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp(`/studio\\?studio=${studioId}$`));
        await expect(
          page.getByRole('heading', { name: 'Studio overview', exact: true }),
        ).toBeVisible();
      }
    }
  });

  test('keeps collapsed mobile navigation stable while workspace access resolves', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const owner = await registerUser(`workspace-layout-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    await page.getByLabel('Studio name').fill('Synthetic stable workspace studio');
    await page.getByRole('button', { name: 'Create studio', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add a brand', exact: true })).toBeVisible();
    await page.getByLabel('Brand name').fill('Synthetic stable workspace');
    await page.getByRole('button', { name: 'Create brand draft', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Make Synthetic stable workspace feel like itself.' }),
    ).toBeVisible();
    const brandLocation = new URL(page.url());
    const workspaceId = brandLocation.pathname.split('/')[2]!;
    const studioId = brandLocation.searchParams.get('studio')!;
    const context = new URLSearchParams({
      studio: studioId,
      brand: brandLocation.pathname.split('/')[4]!,
    });
    const accessRoute = `**/api/core/v1/studios/${studioId}/access`;

    for (const width of [375, 767]) {
      await page.setViewportSize({ width, height: 812 });
      for (const [screen, title] of [
        ['access', 'API keys'],
        ['skills', 'Skills and version history'],
      ] as const) {
        let releaseAccess!: () => void;
        let markRequested!: () => void;
        const delayedAccess = new Promise<void>((resolve) => {
          releaseAccess = resolve;
        });
        const requested = new Promise<void>((resolve) => {
          markRequested = resolve;
        });
        // Delay the real local read, preserving Core's response and all permission checks.
        const delayRead = async (route: Route) => {
          markRequested();
          await delayedAccess;
          await route.continue();
        };
        await page.route(accessRoute, delayRead);
        try {
          await page.goto(`/studio/${workspaceId}/${screen}?${context.toString()}`);
          await requested;
          await expect(page.getByRole('status')).toContainText(
            'Confirming the studio and brand for this campaign',
          );
          const shell = page.locator('.platform-shell');
          const railHead = page.locator('.platform-rail__head');
          const pendingShell = await shell.boundingBox();
          const pendingHead = await railHead.boundingBox();
          const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
          const pendingCurrent = await breadcrumb.locator('li[aria-current="page"]').boundingBox();
          const pendingStudio = await breadcrumb.locator('li').first().boundingBox();
          expect(pendingShell).not.toBeNull();
          expect(pendingHead).not.toBeNull();
          // A collapsed menu must not absorb free space and then move the whole screen upward.
          expect(pendingShell!.y - (pendingHead!.y + pendingHead!.height)).toBeLessThanOrEqual(12);
          expect(pendingStudio?.height).toBeGreaterThanOrEqual(44);
          releaseAccess();
          await expect(
            page.getByRole('heading', { level: 1, name: title, exact: true }),
          ).toBeVisible();
          const readyShell = await shell.boundingBox();
          expect(readyShell).not.toBeNull();
          expect(Math.abs(readyShell!.y - pendingShell!.y)).toBeLessThanOrEqual(1);
          const readyCurrent = await breadcrumb.locator('li[aria-current="page"]').boundingBox();
          expect(pendingCurrent).not.toBeNull();
          expect(readyCurrent).not.toBeNull();
          expect(Math.abs(readyCurrent!.x - pendingCurrent!.x)).toBeLessThanOrEqual(1);
          await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
          await expectNoHorizontalOverflow(page);
        } finally {
          releaseAccess();
          await page.unroute(accessRoute, delayRead);
        }
      }
    }
  });

  test('reserves the brand header before access resolves and restores mobile menu focus', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const owner = await registerUser(`brand-header-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    await page.getByLabel('Studio name').fill('Synthetic stable brand studio');
    await page.getByRole('button', { name: 'Create studio', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add a brand', exact: true })).toBeVisible();
    await page.getByLabel('Brand name').fill('Synthetic stable brand');
    await page.getByRole('button', { name: 'Create brand draft', exact: true }).click();
    const title = 'Make Synthetic stable brand feel like itself.';
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const brandUrl = page.url();
    const studioId = new URL(brandUrl).searchParams.get('studio')!;
    const accessRoute = `**/api/core/v1/studios/${studioId}/access`;

    for (const width of [375, 767, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      let releaseAccess!: () => void;
      let markRequested!: () => void;
      const held = new Promise<void>((resolve) => {
        releaseAccess = resolve;
      });
      const requested = new Promise<void>((resolve) => {
        markRequested = resolve;
      });
      const delayRead = async (route: Route) => {
        markRequested();
        await held;
        await route.continue();
      };
      await page.route(accessRoute, delayRead);
      try {
        await page.goto(brandUrl);
        await requested;
        await expect(page.getByRole('status')).toContainText('Opening the selected brand');
        await page.evaluate(() => document.fonts.ready);
        const main = page.locator('#platform-main');
        const pending = await main.boundingBox();
        const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
        await expect(breadcrumb).not.toContainText('Synthetic stable brand');
        await expect(page.getByRole('combobox', { name: 'Switch brand' })).toHaveCount(0);
        releaseAccess();
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        const ready = await main.boundingBox();
        expect(pending).not.toBeNull();
        expect(ready).not.toBeNull();
        expect(Math.abs(ready!.y - pending!.y)).toBeLessThanOrEqual(1);
        await expect(breadcrumb).toContainText('Synthetic stable brand');
        await expect(page.getByRole('combobox', { name: 'Switch brand' })).toBeEnabled();
        await expectNoHorizontalOverflow(page);
        if (width < 768) {
          const toggle = page.getByRole('button', { name: /^(Menu|Close menu)$/ });
          await toggle.focus();
          await page.keyboard.press('Enter');
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await page.getByRole('link', { name: 'Switch studio', exact: true }).focus();
          await page.keyboard.press('Escape');
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await expect(toggle).toBeFocused();
        }
      } finally {
        releaseAccess();
        await page.unroute(accessRoute, delayRead);
      }
    }
  });

  test('keeps the selected brand readable when text is enlarged', async ({ page }) => {
    test.setTimeout(120_000);
    const owner = await registerUser(`brand-text-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    await page.getByLabel('Studio name').fill('Synthetic enlarged studio');
    await page.getByRole('button', { name: 'Create studio', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add a brand', exact: true })).toBeVisible();
    await page.getByLabel('Brand name').fill('Synthetic enlarged brand');
    await page.getByRole('button', { name: 'Create brand draft', exact: true }).click();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Make Synthetic enlarged brand feel like itself.',
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll<HTMLElement>('body *')].map((element) => {
        const style = getComputedStyle(element);
        return { element, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
      });
      for (const { element, font, line } of sizes) {
        element.style.fontSize = `${font * 2}px`;
        if (Number.isFinite(line)) element.style.lineHeight = `${line * 2}px`;
      }
    });
    const readable = await page
      .getByRole('combobox', { name: 'Switch brand' })
      .evaluate((element: HTMLSelectElement) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Text measurement is unavailable.');
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const text = element.selectedOptions[0]?.text ?? '';
        const required =
          context.measureText(text).width +
          parseFloat(style.paddingLeft) +
          parseFloat(style.paddingRight) +
          32;
        return { text, width: element.getBoundingClientRect().width, required };
      });
    expect(readable.text).toBe('Synthetic enlarged brand');
    expect(readable.width).toBeGreaterThanOrEqual(readable.required);
    await expectNoHorizontalOverflow(page);
  });

  test('keeps review recovery targets complete at the short enlargement viewport', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const owner = await registerUser(`review-zoom-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    await page.getByLabel('Studio name').fill('Synthetic short viewport studio');
    await page.getByRole('button', { name: 'Create studio', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add a brand', exact: true })).toBeVisible();
    await page.getByLabel('Brand name').fill('Synthetic short viewport brand');
    await page.getByRole('button', { name: 'Create brand draft', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Make Synthetic short viewport brand feel like itself.' }),
    ).toBeVisible();
    const brandLocation = new URL(page.url());
    const workspaceId = brandLocation.pathname.split('/')[2]!;
    const context = new URLSearchParams({
      studio: brandLocation.searchParams.get('studio')!,
      brand: brandLocation.pathname.split('/')[4]!,
    });
    // 640 by 450 CSS pixels emulate a 1280 by 900 viewport enlarged to 200 percent.
    for (const width of [640, 375]) {
      await page.setViewportSize({ width, height: 450 });
      for (const segment of ['review', 'review/compare']) {
        await page.goto(`/studio/${workspaceId}/${segment}?${context.toString()}`);
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toBeVisible();
        // Center the heading: a minimal scroll can round down at a fractional text edge.
        await heading.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await expect(heading).toBeInViewport({ ratio: 1 });
        const back = page.getByRole('link', { name: 'Back to the run', exact: true });
        await back.focus();
        await expect(back).toBeFocused();
        await expect(back).toBeInViewport({ ratio: 1 });
        const completeTarget = await back.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          return [rect.top + 0.5, rect.bottom - 0.5].every((y) =>
            element.contains(document.elementFromPoint(x, y)),
          );
        });
        expect(completeTarget).toBe(true);
        await expectNoHorizontalOverflow(page);
        await page.keyboard.press('Enter');
        await expect(
          page.getByRole('heading', { name: 'Review this run before spending', exact: true }),
        ).toBeVisible();
      }
      await page.goto(`/studio/${workspaceId}/quote?${context.toString()}`);
      await expect(
        page.getByRole('heading', { name: 'Review this run before spending' }),
      ).toBeVisible();
      const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#platform-main')).toBeFocused();
      await expect(
        page.getByText('Open this quote from its plan so the revision it prices is known.', {
          exact: true,
        }),
      ).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalOverflow(page);
    }
  });

  test('keeps workspace tools headings on the accepted page scale at every supported width', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const owner = await registerUser(`workspace-type-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    await page.getByLabel('Studio name').fill('Synthetic workspace tools studio');
    await page.getByRole('button', { name: 'Create studio', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Add a brand', exact: true })).toBeVisible();
    await page.getByLabel('Brand name').fill('Synthetic workspace tools');
    await page.getByRole('button', { name: 'Create brand draft', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Make Synthetic workspace tools feel like itself.' }),
    ).toBeVisible();
    const brandLocation = new URL(page.url());
    const workspaceId = brandLocation.pathname.split('/')[2];
    expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/u);
    const context = new URLSearchParams({
      studio: brandLocation.searchParams.get('studio')!,
      brand: brandLocation.pathname.split('/')[4]!,
    });
    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1024 });
      for (const [segment, title] of [
        ['access', 'API keys'],
        ['skills', 'Skills and version history'],
      ] as const) {
        await page.goto(`/studio/${workspaceId}/${segment}?${context.toString()}`);
        const heading = page.getByRole('heading', { level: 1, name: title, exact: true });
        await expect(heading).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(heading).toHaveCSS('font-size', '28px');
        await expect(heading).toHaveCSS('font-weight', '400');
        await expectPlatformLandmarks(page);
        await expectNoHorizontalOverflow(page);
      }
    }
  });

  test('keeps campaign receipt, canvas recovery and enlarged review text readable without replaying writes', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerUser(`receipt-totals-${randomUUID()}@synthetic.example.test`);
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    const project = await seedLegacyProject(
      brands.workspaceId,
      owner.id,
      'Synthetic receipt totals',
    );
    await seedProjectBrandMapping(brands.workspaceId, project.id, brands.washbodegaBrandId);
    const runId = randomUUID();
    const canvasId = randomUUID();
    const revisionId = randomUUID();
    const quoteId = randomUUID();
    const reservationId = randomUUID();
    const timestamp = '2026-10-04T01:00:00.000Z';
    const nodeKeys = [
      'copy-1',
      'copy-2',
      'copy-3',
      'master-1',
      'master-2',
      'master-3',
      'adaptation-1-1',
      'adaptation-1-2',
      'adaptation-1-3',
      'adaptation-2-1',
      'adaptation-2-2',
      'adaptation-2-3',
      'adaptation-3-1',
      'adaptation-3-2',
      'adaptation-3-3',
      'motion-1',
    ];
    const coreWrites: string[] = [];
    let reservationKnown = false;
    let receiptReads = 0;
    let reviewReadFailure: 'error' | 'denied' | null = null;
    let releaseInitialRead: (() => void) | undefined;
    let initialReadReleased = false;
    const initialRead = new Promise<void>((resolve) => {
      releaseInitialRead = resolve;
    });
    page.on('request', (request) => {
      if (request.url().includes('/api/core/') && request.method() !== 'GET')
        coreWrites.push(request.method());
    });
    await page.route(`**/api/core/v1/runs/${runId}`, async (route) => {
      await route.fulfill({
        json: {
          data: {
            run: {
              runId,
              projectId: project.id,
              canvasId,
              canvasRevisionId: revisionId,
              quoteId,
              reservationId,
              status: 'succeeded',
            },
            nodes: nodeKeys.map((nodeKey) => ({
              runNodeId: `node-${nodeKey}`,
              nodeKey,
              modelRouteId: `route-${nodeKey}`,
              status: 'succeeded',
              dispatchWave: 1,
            })),
            recovery: null,
            spend: {
              currency: 'USD',
              authorizedMicros: '0',
              capturedMicros: '0',
              releasedMicros: '0',
              refundedMicros: '0',
              netMicros: '0',
              settlementStatus: 'released',
            },
          },
          meta: { request_id: 'receipt-totals-fixture' },
        },
      });
    });
    await page.route(`**/api/core/v1/runs/${runId}/receipt`, async (route) => {
      receiptReads++;
      if (!initialReadReleased) await initialRead;
      if (reviewReadFailure !== null) {
        await route.fulfill({
          status: reviewReadFailure === 'error' ? 503 : 403,
          json: {
            error: {
              code: reviewReadFailure === 'error' ? 'UPSTREAM_UNAVAILABLE' : 'FORBIDDEN',
              message: 'Synthetic review read failure.',
              request_id: 'review-read-failure-fixture',
              retryable: reviewReadFailure === 'error',
            },
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          data: {
            receipt: {
              run: {
                id: runId,
                project_id: project.id,
                canvas_id: canvasId,
                canvas_revision_id: revisionId,
                canvas_revision_hash: 'a'.repeat(64),
                quote_id: quoteId,
                confirmed_at: timestamp,
                created_at: timestamp,
                updated_at: timestamp,
                dispatch_wave: 1,
                status: 'succeeded',
              },
              reservation: reservationKnown
                ? {
                    id: reservationId,
                    run_id: runId,
                    quote_id: quoteId,
                    amount_micros: 0,
                    captured_micros: 0,
                    refunded_micros: 0,
                    released_micros: 0,
                    status: 'released',
                    created_at: timestamp,
                    updated_at: timestamp,
                  }
                : null,
              ledger: [],
              artifacts: nodeKeys.map((nodeKey) => ({
                id: `artifact-${nodeKey}`,
                project_id: project.id,
                run_id: runId,
                run_node_id: `node-${nodeKey}`,
                canvas_revision_id: revisionId,
                artifact_kind: 'approved_output',
                status: 'available',
                mime_type: nodeKey.startsWith('copy-')
                  ? 'application/json'
                  : nodeKey === 'motion-1'
                    ? 'video/mp4'
                    : 'image/png',
                byte_size: 2048,
                content_hash: 'a'.repeat(64),
                accessibility_description: 'Synthetic receipt fixture output.',
                approved_at: timestamp,
                created_at: timestamp,
                updated_at: timestamp,
              })),
              lineage: [],
              provider_jobs: [],
            },
          },
          meta: { request_id: 'receipt-totals-fixture' },
        },
      });
    });

    await page.setViewportSize({ width: 375, height: 812 });
    const query = new URLSearchParams({
      studio: brands.studioId,
      brand: brands.washbodegaBrandId,
      run: runId,
    });
    await page.goto(`/studio/${brands.workspaceId}/receipt?${query}`);
    try {
      await expect(page.getByText('Reading immutable receipt', { exact: true })).toBeVisible();
      const loadingNotice = await page.locator('[data-result="loading"]').evaluate((notice) => {
        const flow = notice.closest('#main-content');
        if (flow === null) throw new Error('The loading receipt has no flow container.');
        const n = notice.getBoundingClientRect();
        const f = flow.getBoundingClientRect();
        return n.top >= f.top && n.bottom <= f.bottom && n.left >= f.left && n.right <= f.right;
      });
      expect.soft(loadingNotice).toBe(true);
      const loadingRail = await page.locator('.platform-rail').evaluate((rail) => {
        const style = getComputedStyle(rail);
        const head = rail.querySelector('.platform-rail__head');
        if (head === null) throw new Error('The mobile rail has no visible header.');
        return {
          height: rail.getBoundingClientRect().height,
          contentHeight:
            head.getBoundingClientRect().height +
            Number.parseFloat(style.paddingTop) +
            Number.parseFloat(style.paddingBottom) +
            Number.parseFloat(style.borderTopWidth) +
            Number.parseFloat(style.borderBottomWidth),
        };
      });
      expect.soft(loadingRail.height).toBeCloseTo(loadingRail.contentHeight);
    } finally {
      initialReadReleased = true;
      releaseInitialRead?.();
    }
    const check = page.getByRole('button', { name: 'Check receipt status' });
    await expect(check).toBeVisible();
    expect((await check.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    for (const step of await page
      .getByRole('navigation', { name: 'Campaign workflow' })
      .getByRole('link')
      .all()) {
      expect((await step.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      page.getByRole('complementary', { name: 'Receipt evidence' }).getByText('Unavailable', {
        exact: true,
      }),
    ).toHaveCount(3);
    const summary = page.locator('[class*="confirmBar"] > div > span:last-child');
    await expect(summary).toHaveText(
      'Quote unavailable, settled amount unavailable. Quote comparison unavailable.',
    );
    const checkGeometry = async (state: string) => {
      for (const width of [375, 768, 1280, 1920]) {
        await page.setViewportSize({
          width,
          height: width === 375 ? 812 : width === 768 ? 1024 : 900,
        });
        const geometry = await summary.evaluate((element) => ({
          unclipped:
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight,
          withinViewport: element.getBoundingClientRect().bottom <= window.innerHeight,
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        }));
        expect(geometry).toEqual({ unclipped: true, withinViewport: true, pageOverflow: false });
        const ledger = page.getByRole('region', { name: 'Receipt charges by attempt' });
        const containment = await ledger.evaluate((region) => {
          const section = region.closest('section');
          const evidence = section?.nextElementSibling;
          if (section === null || evidence === undefined || evidence === null)
            throw new Error('Receipt ledger or evidence column is missing.');
          const r = region.getBoundingClientRect();
          const s = section.getBoundingClientRect();
          const a = evidence.getBoundingClientRect();
          return {
            withinColumn: r.left >= s.left - 1 && r.right <= s.right + 1,
            overlapsEvidence:
              r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top,
            overflowX: getComputedStyle(region).overflowX,
          };
        });
        expect(containment).toEqual({
          withinColumn: true,
          overlapsEvidence: false,
          overflowX: 'auto',
        });
        await expect(ledger).toHaveAttribute('tabindex', '0');
        await ledger.focus();
        await ledger.evaluate((region) => {
          region.scrollLeft = 0;
        });
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => ledger.evaluate((region) => region.scrollLeft)).toBeGreaterThan(0);
        await attachAxeAndAria(page, `receipt-${state}-${width}`);
      }
    };
    await checkGeometry('unavailable-totals');
    await page.setViewportSize({ width: 375, height: 812 });
    const readsBeforeRecovery = receiptReads;
    reservationKnown = true;
    await check.focus();
    await page.keyboard.press('Enter');
    await expect(summary).toHaveText('Quoted $0.00, charged $0.00, $0.00 under quote');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await checkGeometry('known-zero-totals');
    expect(receiptReads).toBeGreaterThan(readsBeforeRecovery);

    let canvasReads = 0;
    let canvasReady = false;
    await page.route(`**/api/core/v1/canvases/${canvasId}`, async (route) => {
      canvasReads++;
      // The outer boundary must confirm campaign scope before exercising a later canvas read failure.
      // The dev harness may repeat that scope read under Strict Mode; no guard is bypassed.
      if (canvasReady || (await page.locator('[data-canvas-state]').count()) === 0) {
        await route.fulfill({
          json: {
            data: {
              canvas: {
                canvasId,
                projectId: project.id,
                headRevisionId: revisionId,
                graphSchemaVersion: 1,
                graphSnapshot: {
                  nodes: [
                    {
                      id: 'synthetic-brief',
                      kind: 'brief',
                      parameter_schema_version: 1,
                      parameters: {},
                    },
                  ],
                  edges: [],
                },
                canonicalHash: 'a'.repeat(64),
              },
            },
            meta: { request_id: 'canvas-scope-fixture' },
          },
        });
        return;
      }
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Canvas read unavailable in the local synthetic fixture.',
            request_id: 'canvas-recovery-fixture',
            retryable: true,
          },
        },
      });
    });
    query.set('canvas', canvasId);
    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({
        width,
        height: width === 375 ? 812 : width === 768 ? 1024 : 900,
      });
      await page.goto(`/studio/${brands.workspaceId}/canvas?${query}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Campaign plan' })).toBeVisible();
      const retry = page.getByRole('button', { name: 'Try loading again' });
      await expect(retry).toBeVisible();
      expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      const noticeGeometry = await page
        .locator('#main-content')
        .getByRole('alert')
        .evaluate((notice) => {
          const flow = notice.closest('#main-content');
          if (flow === null) throw new Error('The canvas notice has no flow container.');
          const n = notice.getBoundingClientRect();
          const f = flow.getBoundingClientRect();
          return {
            usesAvailableWidth: Math.abs(n.width - f.width) <= 1,
            textClipped: notice.scrollWidth > notice.clientWidth + 1,
            pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        });
      expect(noticeGeometry).toEqual({
        usesAvailableWidth: true,
        textClipped: false,
        pageOverflow: false,
      });
      const readsBeforeRetry = canvasReads;
      await retry.focus();
      await page.keyboard.press('Enter');
      await expect(retry).toBeVisible();
      await expect.poll(() => canvasReads).toBeGreaterThan(readsBeforeRetry);
      await attachAxeAndAria(page, `canvas-unavailable-recovery-${width}`);
    }
    canvasReady = true;
    await page.getByRole('button', { name: 'Try loading again' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('canvas-surface')).toBeVisible();
    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({
        width,
        height: width === 375 ? 812 : width === 768 ? 1024 : 900,
      });
      const root = page.locator('#main-content');
      await expect(root).toHaveAttribute('data-canvas-layout', width < 1280 ? 'drawer' : 'rail');
      const canvasGeometry = await root.evaluate((flow) => {
        const container = flow.getBoundingClientRect();
        const toolbar = flow.querySelector('[class*="toolbarActions"]');
        const quote = flow.querySelector('[class*="quoteBar"]');
        const surface = flow.querySelector('[data-testid="canvas-surface"]');
        const toolbarRow = toolbar?.parentElement;
        if (toolbar === null || quote === null || surface === null || !toolbarRow)
          throw new Error('Canvas controls are missing.');
        return {
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
          toolbarHeightContained:
            toolbar.getBoundingClientRect().bottom <= toolbarRow.getBoundingClientRect().bottom + 1,
          graphStartsAfterControls:
            toolbar.getBoundingClientRect().bottom <= surface.getBoundingClientRect().top + 1,
          controlsContained: [toolbar, quote].every((element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.left >= container.left - 1 &&
              bounds.right <= container.right + 1 &&
              element.scrollWidth <= element.clientWidth + 1
            );
          }),
        };
      });
      expect(canvasGeometry).toEqual({
        pageOverflow: false,
        controlsContained: true,
        toolbarHeightContained: true,
        graphStartsAfterControls: true,
      });
      if (width < 1280) {
        const trigger = page.getByRole('button', { name: 'Outline and comments' });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const close = page.getByRole('button', { name: 'Close Plan outline and comments' });
        await expect(close).toBeFocused();
        expect((await close.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await expect(page.getByRole('heading', { name: 'Graph outline' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }
      if (width === 375) {
        await expect(page.getByRole('button', { name: 'Validate graph' })).toBeDisabled();
        await expect(page.getByRole('link', { name: 'Open this plan on a desktop' })).toBeVisible();
      }
      await attachAxeAndAria(page, `canvas-ready-responsive-${width}`);
    }

    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1024 });
      for (const failure of ['error', 'denied'] as const) {
        reviewReadFailure = failure;
        await page.goto(`/studio/${brands.workspaceId}/review?${query}`);
        await expect(
          page.locator(`[data-review-state="${failure === 'denied' ? 'forbidden' : 'error'}"]`),
        ).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: 'Review outputs' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Back to the run' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Export approved' })).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: 'Add a draft comment' })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await attachAxeAndAria(page, `review-read-failure-${failure}-${width}`);
      }
    }
    reviewReadFailure = null;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/studio/${brands.workspaceId}/review?${query}`);
    await expect(page.getByRole('tablist', { name: 'Concepts' })).toBeVisible();
    await page.evaluate(() => {
      // Freeze every computed size before doubling: inherited text must not accidentally grow 4x.
      const sizes = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) =>
          [...element.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          ),
        )
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            element,
            size: Number.parseFloat(style.fontSize),
            line: style.lineHeight === 'normal' ? null : Number.parseFloat(style.lineHeight),
          };
        });
      for (const { element, size, line } of sizes) {
        element.style.fontSize = `${String(size * 2)}px`;
        if (line !== null) element.style.lineHeight = `${String(line * 2)}px`;
      }
    });
    const conceptLabels = await page.getByRole('tablist', { name: 'Concepts' }).evaluate((rail) => {
      const railBox = rail.getBoundingClientRect();
      const stageBox = rail.nextElementSibling?.getBoundingClientRect();
      return [...rail.querySelectorAll('[role="tab"]')].map((tab) => {
        const button = tab.getBoundingClientRect();
        const textFits = [...tab.querySelectorAll('span')].every((label) => {
          const range = document.createRange();
          range.selectNodeContents(label);
          return [...range.getClientRects()].every(
            (text) =>
              text.left >= button.left - 1 &&
              text.right <= button.right + 1 &&
              text.top >= button.top - 1 &&
              text.bottom <= button.bottom + 1,
          );
        });
        return {
          textFits,
          insideRail: button.left >= railBox.left - 1 && button.right <= railBox.right + 1,
          overlapsStage:
            stageBox !== undefined &&
            button.right > stageBox.left + 1 &&
            button.left < stageBox.right - 1 &&
            button.bottom > stageBox.top + 1 &&
            button.top < stageBox.bottom - 1,
        };
      });
    });
    expect(conceptLabels).toEqual(
      Array.from({ length: 3 }, () => ({
        textFits: true,
        insideRail: true,
        overlapsStage: false,
      })),
    );
    await attachAxeAndAria(page, 'review-exact-text-size-200');

    await page.reload();
    await expect(page.getByRole('tablist', { name: 'Concepts' })).toBeVisible();
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    // Available width changes before viewport media queries under CSS enlargement.
    // The existing tablet drawer must replace desktop columns and retain its Close action.
    const closeQa = page.getByRole('button', { name: 'Close QA findings', exact: true });
    await expect(closeQa).toBeVisible();
    await closeQa.focus();
    await page.keyboard.press('Enter');
    await expect(closeQa).toBeHidden();
    await expect(page.getByRole('button', { name: 'QA findings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'QA findings', exact: true })).toBeFocused();
    await expectNoHorizontalOverflow(page);
    await attachAxeAndAria(page, 'review-available-width-zoom-200');
    expect(coreWrites).toEqual([]);
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
    await page.getByRole('link', { name: 'All brands' }).click();
    await expect(page.getByLabel('What should we know?')).toHaveValue(
      'Interrupted UnPile edit must not save.',
    );
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('link', { name: 'All brands' }).click();
    await expect(page.getByRole('heading', { name: 'Brands', exact: true })).toBeVisible();
    await openBrandDraft(page, 'UnPile');
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
    // The brand link now carries its own view; the studio query is built from the studio id.
    const studioQuery = `?studio=${brands.studioId}`;
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
    await page
      .getByRole('navigation', { name: 'Brand navigation' })
      .getByRole('link', { name: 'Settings' })
      .click();
    await expect(page.getByRole('button', { name: 'Archive brand' })).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Archive brand' }).click();
    await expect(page.getByText('This brand is archived')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: 'All brands' }).click();
    await expect(page.getByRole('link', { name: 'Open WashBodega' })).toHaveCount(0);
    await page.getByLabel('Show').selectOption('all');
    await expect(page.getByRole('link', { name: 'Open WashBodega' })).toBeVisible();
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
    await expect(pendingInvite.getByText(/Editor, pending/)).toBeVisible();
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
    await expect(editorPage.getByRole('link', { name: 'Open UnPile' })).toBeVisible();
    await openBrandDraft(editorPage, 'UnPile');
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
      await editorPage
        .getByRole('navigation', { name: 'Brand navigation' })
        .getByRole('link', { name: 'Settings' })
        .click();
      await expect(editorPage.getByRole('heading', { name: 'Brand settings.' })).toBeVisible();
      await editorPage.getByRole('link', { name: 'Brand draft' }).click();
      await expect(editorPage.getByText('Loading your saved draft')).toBeVisible();
      await page.reload();
      page.once('dialog', (dialog) => void dialog.accept());
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

    await page
      .getByRole('navigation', { name: 'Brand navigation' })
      .getByRole('link', { name: 'Billing' })
      .click();
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
    await expect(page.getByRole('heading', { name: 'Choose a studio.' })).toBeVisible();
    const unrelatedName = `Unrelated studio ${randomUUID()}`;
    await page.getByLabel('Studio name').fill(unrelatedName);
    await page.getByRole('button', { name: 'Create studio' }).click();
    await expect(page.getByRole('link', { name: 'Add a brand' })).toBeVisible({
      timeout: 60_000,
    });
    const unrelatedStudioId = new URL(page.url()).searchParams.get('studio');
    if (!unrelatedStudioId) throw new Error('Unrelated studio identity was not returned.');
    await page.goto(`/studio/${brands.workspaceId}/billing?studio=${unrelatedStudioId}`);
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.getByText('$250.00', { exact: true })).toBeVisible();
    await expect(page.locator('.platform-breadcrumb')).toContainText('Your studios');
    await expect(page.getByText(unrelatedName)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);
    await page.goto(`/studio/${brands.workspaceId}/billing`);
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.locator('.platform-breadcrumb')).toContainText('Your studios');
    await expect(page.getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);

    await page.goto(brands.washbodegaUrl);
    await page
      .getByRole('navigation', { name: 'Brand navigation' })
      .getByRole('link', { name: 'Billing' })
      .click();
    await expect(page.getByRole('heading', { name: 'Workspace billing.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team', exact: true })).toBeVisible();

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
    await page
      .getByRole('navigation', { name: 'Studio navigation' })
      .getByRole('link', { name: 'Overview' })
      .click();
    await expect(page.getByRole('heading', { name: 'Studio overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open WashBodega' })).toBeVisible();
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
    await expect(page.getByRole('status').filter({ hasText: /Saved, version / })).toBeVisible();
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
      page.getByRole('status').filter({ hasText: `Saved, version ${savedVersion}` }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('What should we know?')).toHaveValue(interrupted);
    await expect(
      page.getByRole('status').filter({ hasText: `Saved, version ${savedVersion}` }),
    ).toBeVisible();
    const context = await browser.newContext();
    const reconnected = await context.newPage();
    await signIn(reconnected, owner.email);
    await reconnected.goto(brands.unpileUrl);
    await expect(reconnected.getByLabel('What should we know?')).toHaveValue(interrupted);
    await expect(
      reconnected.getByRole('status').filter({ hasText: `Saved, version ${savedVersion}` }),
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
    await page.getByRole('link', { name: 'All brands' }).click();
    await expect(page.getByRole('heading', { name: 'Brands', exact: true })).toBeVisible();
    await openBrandDraft(page, 'WashBodega');
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
    await page.getByRole('link', { name: 'All brands' }).click();
    await openBrandDraft(page, 'UnPile');
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
      await page
        .getByRole('navigation', { name: 'Brand navigation' })
        .getByRole('link', { name: 'Settings' })
        .click();
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
    // The mapped link lands on the brand overview; the draft is one tab away.
    await page
      .getByRole('navigation', { name: 'Brand navigation' })
      .getByRole('link', { name: 'Brand draft' })
      .click();
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
    await expectPlatformLandmarks(page);
    await expectNoHorizontalOverflow(page);
    await attachAxeAndAria(page, 'portfolio');

    const brands = await createStudioAndBrands(page);
    await expectPlatformLandmarks(page);
    await expect(page.getByRole('navigation', { name: 'Studio navigation' })).toBeVisible();
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
    await expect(page.getByRole('status').filter({ hasText: 'Saved, version 2' })).toBeVisible();
    await captureSignedInSurface(page, 'a11y-brand-draft.png');
    await attachAxeAndAria(page, 'brand-draft');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Team', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your studio team.' })).toBeVisible({
      timeout: 15_000,
    });
    await attachAxeAndAria(page, 'studio-team');

    await page
      .getByRole('navigation', { name: 'Studio navigation' })
      .getByRole('link', { name: 'Overview' })
      .click();
    await openBrandDraft(page, 'WashBodega');
    await expect(
      page.getByRole('heading', { name: 'Make WashBodega feel like itself.' }),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('navigation', { name: 'Brand navigation' })
      .getByRole('link', { name: 'Billing' })
      .click();
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

    await page
      .getByRole('navigation', { name: 'Studio navigation' })
      .getByRole('link', { name: 'Overview' })
      .click();
    await openBrandDraft(page, 'WashBodega');
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
    const zoomLayout = await page.locator('.platform-split').evaluate((split) => {
      const card = split.querySelector('.platform-card');
      if (!(card instanceof HTMLElement)) throw new Error('Brand draft card is missing.');
      return {
        available: split.getBoundingClientRect().width,
        card: card.getBoundingClientRect().width,
        clipped: card.scrollWidth > card.clientWidth + 1,
      };
    });
    expect(zoomLayout.clipped, 'Zoomed form must not hide overflowing controls or labels').toBe(
      false,
    );
    expect(zoomLayout.card, 'Zoomed form must retain usable width').toBeGreaterThanOrEqual(
      Math.min(320, zoomLayout.available) - 1,
    );
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
  await expect(page.getByRole('heading', { name: 'Choose a studio.' })).toBeVisible();
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
  await expect(page.getByRole('complementary', { name: 'Studio' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
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
