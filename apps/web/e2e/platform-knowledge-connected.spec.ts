import { expect, test, type Locator, type Page, type Request, type Route } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  requireConnectedPlatformServers,
  requireMustBeViralDatabase,
} from '../../../packages/db/scripts/platform-journey-fixtures';
import {
  cleanupSyntheticUsers,
  createStudioAndBrands,
  findingsUrl,
  FORGED_ID,
  NOT_FOUND_COPY,
  registerSyntheticUser,
  revalidateOnFocus,
  signIn,
  switchToBrand,
} from './platform-journey-helpers';

const connected =
  process.env['MBV_PLATFORM_CONNECTED'] === '1' && process.env['MBV_PLAYWRIGHT_EXTERNAL'] === '1';
const createdUsers: Array<{ id: string; email: string }> = [];
const LARGE_DOCUMENT = `UNPILE_DOC_LARGE\n${'unpile-laundry-notes '.repeat(2000)}`;

test.use({
  screenshot: 'off',
  trace: 'off',
  video: 'off',
  actionTimeout: 30_000,
  navigationTimeout: 30_000,
});

test.describe('connected brand knowledge journeys', () => {
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
      'Requires start-platform-knowledge-local.mjs on 127.0.0.1:3111/8789 with MBV_PLATFORM_CONNECTED=1 and MBV_PLAYWRIGHT_EXTERNAL=1',
    );
  });

  test('captures website and document sources for both brands and keeps them after reload', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerSyntheticUser(
      `w2-knowledge-${randomUUID()}@synthetic.example.test`,
      createdUsers,
    );
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await page.goto(findingsUrl(brands.washbodegaUrl));
    await expect(
      page.getByRole('heading', { name: 'Review the source. Keep the meaning.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0);
    await captureWebsite(page, 'https://washbodega.mbv-source.test/');
    await expectJobStatus(page, 'captured');
    await page.getByTestId('candidate-page_title').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('WashBodega Laundromat Hours');
    await expect(page.getByTestId('candidate-provenance')).toContainText('html_title');
    await expect(page.getByTestId('candidate-provenance')).toHaveText(
      /Source [0-9a-f-]{36} · html_title · captured .+/iu,
    );
    await page.getByTestId('candidate-heading').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('24-hour machine access');
    await page.getByTestId('candidate-visible_excerpt').click();
    await expect(page.getByTestId('candidate-value')).toContainText('WASHBODEGA_SITE_EXCERPT');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'washbodega-notes.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('WASHBODEGA_DOC_NOTES pickup windows stay unconfirmed.', 'utf8'),
    });
    await expect(page.getByTestId('candidate-document_filename')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('candidate-document_filename').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('washbodega-notes.md');
    await page.getByTestId('candidate-visible_excerpt').last().click();
    await expect(page.getByTestId('candidate-value')).toContainText('WASHBODEGA_DOC_NOTES');
    await expect(page.getByTestId('source-document-document_upload')).toBeVisible();
    await page.reload();
    await expectJobStatus(page, 'captured');
    await page.getByTestId('candidate-page_title').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('WashBodega Laundromat Hours');
    await expect(page.getByTestId('candidate-value')).not.toHaveText('UnPile Wash And Fold Hours');

    await page.goto(findingsUrl(brands.unpileUrl));
    await expect(page.getByTestId('candidate-value')).toHaveCount(0);
    await expect(page.getByText('WashBodega Laundromat Hours')).toHaveCount(0);
    await captureWebsite(page, 'https://unpile.mbv-source.test/');
    await expectJobStatus(page, 'captured');
    await page.getByTestId('candidate-page_title').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('UnPile Wash And Fold Hours');
    await expect(page.getByTestId('candidate-value')).not.toHaveText('WashBodega Laundromat Hours');
    expect(LARGE_DOCUMENT.length).toBeGreaterThan(32_768);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'unpile-large.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(LARGE_DOCUMENT, 'utf8'),
    });
    await expect(page.getByTestId('candidate-document_filename')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('candidate-document_filename').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('unpile-large.txt');
    await page.getByTestId('candidate-visible_excerpt').last().click();
    await expect(page.getByTestId('candidate-value')).toContainText('UNPILE_DOC_LARGE');
    await page.reload();
    await page.getByTestId('candidate-page_title').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('UnPile Wash And Fold Hours');
    await switchToBrand(page, 'WashBodega');
    await page.getByRole('link', { name: 'Findings' }).click();
    await page.getByTestId('candidate-page_title').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('WashBodega Laundromat Hours');
    await expect(page.getByText('UNPILE_DOC_LARGE')).toHaveCount(0);
    await attachAxeAndAria(page, 'findings-washbodega');
  });

  test('records manual corrections, unsafe destinations, stalled timeouts, and duplicate captures', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerSyntheticUser(
      `w2-manual-${randomUUID()}@synthetic.example.test`,
      createdUsers,
    );
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await page.goto(findingsUrl(brands.washbodegaUrl));
    await page.getByRole('button', { name: 'Continue without a website' }).click();
    await expect(page.getByTestId('candidate-unknown_gap')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('candidate-unknown_gap').click();
    await expect(page.getByTestId('candidate-value')).toHaveText('Unknown — not supplied.');
    await page
      .getByLabel('Correct this finding')
      .fill('Customer access is 24/7 for machines only.');
    await page.getByLabel('Why this correction').fill('Operator hours correction.');
    await page.getByRole('button', { name: 'Save correction' }).click();
    await expect(page.getByTestId('candidate-value')).toHaveText(
      'Customer access is 24/7 for machines only.',
    );
    await expect(page.getByTestId('draft-version')).toHaveText('Draft version 2');
    await expect(page.getByTestId('candidate-provenance')).toContainText('manual');
    await page.reload();
    await page.getByTestId('candidate-unknown_gap').click();
    await expect(page.getByTestId('candidate-value')).toHaveText(
      'Customer access is 24/7 for machines only.',
    );

    await page.getByLabel('Website', { exact: true }).fill('https://127.0.0.1/');
    await page.getByRole('button', { name: 'Capture website' }).click();
    await expect(findingsAlert(page)).toContainText('not a permitted public website');
    await captureWebsite(page, 'https://redirect-private.mbv-source.test/');
    await expect(findingsAlert(page)).toContainText('not a permitted public website');
    await captureWebsite(page, 'https://malformed.mbv-source.test/');
    await expect(findingsAlert(page)).toContainText('could not be read');
    await captureWebsite(page, 'https://oversized.mbv-source.test/');
    await expect(findingsAlert(page)).toContainText('larger than the capture limit');
    await captureWebsite(page, 'https://stall.mbv-source.test/');
    await expect(page.getByTestId('source-job-status')).toHaveAttribute(
      'data-status',
      /capturing|queued|failed/,
      { timeout: 15_000 },
    );
    await expect(findingsAlert(page)).toContainText('did not respond in time', {
      timeout: 30_000,
    });

    await captureWebsite(page, 'https://washbodega.mbv-source.test/');
    await expectJobStatus(page, 'captured');
    await captureWebsite(page, 'https://washbodega.mbv-source.test/');
    await expectJobStatus(page, 'duplicate');
    await page.goto(`/studio/${FORGED_ID}/brands/${FORGED_ID}?studio=${FORGED_ID}&view=findings`);
    await expect(page.getByText(NOT_FOUND_COPY)).toBeVisible();
    await expect(page.getByText('WashBodega Laundromat Hours')).toHaveCount(0);
    await expect(page.getByText(/\$|outreach|approved knowledge/i)).toHaveCount(0);
  });

  test('hides delayed WashBodega findings and revoked editor access', async ({ page, browser }) => {
    test.setTimeout(240_000);
    const owner = await registerSyntheticUser(
      `w2-revoke-${randomUUID()}@synthetic.example.test`,
      createdUsers,
    );
    const editor = await registerSyntheticUser(
      `w2-editor-${randomUUID()}@synthetic.example.test`,
      createdUsers,
    );
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await page.goto(findingsUrl(brands.washbodegaUrl));
    await captureWebsite(page, 'https://washbodega.mbv-source.test/');
    await expectJobStatus(page, 'captured');
    await expectSelectedCandidate(page, 'candidate-page_title', 'WashBodega Laundromat Hours');
    await page.goto(findingsUrl(brands.unpileUrl));
    await captureWebsite(page, 'https://unpile.mbv-source.test/');
    await expectJobStatus(page, 'captured');
    await expectSelectedCandidate(page, 'candidate-page_title', 'UnPile Wash And Fold Hours');

    const held = holdAuthorizedKnowledgeDraft(page, brands.washbodegaBrandId);
    try {
      await held.install();
      await page.goto(findingsUrl(brands.washbodegaUrl));
      await expect(page.getByText('Loading brand findings')).toBeVisible();
      await held.waitForAuthorizedCapture();
      await switchToBrand(page, 'UnPile');
      await page.getByRole('link', { name: 'Findings' }).click();
      await expectSelectedCandidate(page, 'candidate-page_title', 'UnPile Wash And Fold Hours');
      await held.release();
      await expectSelectedCandidate(page, 'candidate-page_title', 'UnPile Wash And Fold Hours');
      await expect(page.getByText('WashBodega Laundromat Hours')).toHaveCount(0);
    } finally {
      await held.finish();
    }

    await page.goto(`/studio?studio=${brands.studioId}&view=team`);
    await expect(page.getByText('No email is sent')).toBeVisible();
    await page.getByLabel('Verified email').fill(editor.email);
    await page.getByLabel('Studio role').selectOption('editor');
    await page.getByRole('button', { name: 'Save invitation' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Invitation saved' })).toBeVisible();
    await expect(page.getByRole('article').filter({ hasText: editor.email })).toBeVisible();
    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    const heldEditor = holdAuthorizedKnowledgeDraft(editorPage, brands.unpileBrandId);
    try {
      await signIn(editorPage, editor.email);
      await editorPage.getByRole('button', { name: 'Accept invitation' }).click();
      await editorPage.getByRole('link', { name: 'Open UnPile →' }).click();
      await editorPage.getByRole('link', { name: 'Findings' }).click();
      await expectSelectedCandidate(
        editorPage,
        'candidate-page_title',
        'UnPile Wash And Fold Hours',
      );
      await heldEditor.install();
      await editorPage.reload();
      await expect(editorPage.getByText('Loading brand findings')).toBeVisible();
      await heldEditor.waitForAuthorizedCapture();
      await page.bringToFront();
      await revalidateOnFocus(page);
      await page.reload();
      const editorMember = page.getByRole('article').filter({ hasText: editor.email });
      await expect(editorMember.getByText('Studio teammate')).toBeVisible();
      await expect(editorMember.getByRole('button', { name: 'Revoke access' })).toBeVisible();
      await editorMember.getByRole('button', { name: 'Revoke access' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Studio access revoked' }),
      ).toBeVisible();
      await heldEditor.release();
      await heldEditor.finish();
      await revalidateOnFocus(editorPage);
      await expect(editorPage.getByText(NOT_FOUND_COPY)).toBeVisible({ timeout: 15_000 });
      await expect(editorPage.getByText('UnPile Wash And Fold Hours')).toHaveCount(0);
      await expect(editorPage.getByLabel('Correct this finding')).toHaveCount(0);
      await expect(editorPage.getByRole('button', { name: 'Save correction' })).toHaveCount(0);
    } finally {
      await heldEditor.finish();
      await editorContext.close();
    }
  });

  test('keeps findings usable at 200% zoom with keyboard and reduced motion', async ({ page }) => {
    test.setTimeout(180_000);
    const owner = await registerSyntheticUser(
      `w2-a11y-${randomUUID()}@synthetic.example.test`,
      createdUsers,
    );
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await page.goto(findingsUrl(brands.washbodegaUrl));
    await page.getByRole('button', { name: 'Continue without a website' }).focus();
    await expect(page.getByRole('button', { name: 'Continue without a website' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('candidate-unknown_gap')).toBeVisible();
    await page.getByTestId('candidate-unknown_gap').click();
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await expectScrolledIntoViewport(
      page.getByRole('heading', { name: 'Review the source. Keep the meaning.' }),
    );
    const capture = page.getByRole('button', { name: 'Capture website' });
    await expectScrolledIntoViewport(capture);
    await expect(capture).toBeEnabled();
    await capture.focus();
    await expect(capture).toBeFocused();
    const correction = page.getByLabel('Correct this finding');
    await expectScrolledIntoViewport(correction);
    await expect(correction).toBeEnabled();
    await correction.focus();
    await expect(correction).toBeFocused();
    await correction.pressSequentially('Keyboard hours stay 24/7 at 200 percent.');
    const save = page.getByRole('button', { name: 'Save correction' });
    await expectScrolledIntoViewport(save);
    await expect(save).toBeEnabled();
    await save.focus();
    await expect(save).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('candidate-value')).toHaveText(
      'Keyboard hours stay 24/7 at 200 percent.',
    );
    await page.reload();
    await page.getByTestId('candidate-unknown_gap').click();
    await expect(page.getByTestId('candidate-value')).toHaveText(
      'Keyboard hours stay 24/7 at 200 percent.',
    );
    await page.evaluate(() => {
      document.documentElement.style.removeProperty('zoom');
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ forcedColors: 'active' });
    await page.screenshot({
      path: test.info().outputPath('findings-forced-colors.png'),
      fullPage: true,
    });
    await attachAxeAndAria(page, 'findings-a11y');
  });

  test('extracts, proposes, questions and approves WashBodega and UnPile without mixing brands', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await registerSyntheticUser(
      `w2-approve-${randomUUID()}@synthetic.example.test`,
      createdUsers,
    );
    await signIn(page, owner.email);
    const brands = await createStudioAndBrands(page);
    await page.goto(findingsUrl(brands.washbodegaUrl));
    await captureWebsite(page, 'https://washbodega.mbv-source.test/');
    await expectJobStatus(page, 'captured');
    await page.getByTestId('extract-knowledge').click();
    await expect(page.getByTestId('assertion-offering')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('assertion-offering').click();
    await expect(page.getByTestId('assertion-value')).toContainText('WashBodega');
    await expect(page.getByTestId('assertion-value')).not.toHaveText(/UnPile/i);
    await page.getByRole('button', { name: 'Propose voice, audience and positioning' }).click();
    await expect(page.getByTestId('proposal-audience')).toContainText('unknown');
    await expect(page.getByTestId('proposal-audience')).not.toContainText(/millennial|urban/i);
    await page.getByRole('button', { name: 'Ask targeted questions' }).click();
    await expect(page.getByTestId('question-audience')).toBeVisible();
    await page.getByTestId('approve-brand-version').click();
    await expect(page.getByTestId('approved-version')).toContainText('Approved version');
    await page.getByLabel('Campaign pin').fill('campaign-washbodega');
    await page.getByTestId('pin-brand-version').click();
    await expect(page.getByTestId('pinned-version')).toContainText('Pinned version');
    await expect(page.getByTestId('pinned-version')).toContainText('WashBodega');
    await page.getByTestId('assertion-offer').click();
    await page.getByLabel('Correct this assertion').fill('Free drying ended for WashBodega.');
    await page.getByLabel('Why this assertion correction').fill('Operator ended the Sunday offer.');
    await page.getByRole('button', { name: 'Save assertion' }).click();
    await expect(page.getByTestId('assertion-value')).toHaveText('Free drying ended for WashBodega.');
    await expect(page.getByTestId('pinned-version')).not.toContainText('Free drying ended');
    await expect(page.getByText(/\$|outreach|approved knowledge/i)).toHaveCount(0);

    await page.goto(findingsUrl(brands.unpileUrl));
    await expect(page.getByText('WashBodega storefront')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue without a website' }).click();
    await expect(page.getByTestId('candidate-unknown_gap')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('extract-knowledge').click();
    await expect(page.getByTestId('assertion-offering')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('assertion-offering').click();
    await expect(page.getByTestId('assertion-value')).toHaveText('Unknown — not supplied.');
    await page.getByLabel('Correct this assertion').fill('UnPile wash-and-fold pickup.');
    await page.getByLabel('Why this assertion correction').fill('Operator UnPile offering.');
    await page.getByRole('button', { name: 'Save assertion' }).click();
    await expect(page.getByTestId('assertion-value')).toHaveText('UnPile wash-and-fold pickup.');
    await page.getByRole('button', { name: 'Propose voice, audience and positioning' }).click();
    await expect(page.getByTestId('proposal-positioning')).toContainText('inferred');
    await page.getByRole('button', { name: 'Ask targeted questions' }).click();
    await page.getByTestId('approve-brand-version').click();
    await expect(page.getByTestId('approved-version')).toContainText('Approved version');
    await expect(page.getByText('WashBodega')).toHaveCount(0);
  });
});

const AUTHORIZED_CAPTURE_MS = 15_000;

function createHoldGate() {
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

function draftMatchesExpectedBrand(body: string, expectedBrandId: string): boolean {
  try {
    const parsed = JSON.parse(body) as {
      data?: { record?: { brand_id?: unknown } };
      error?: unknown;
    };
    if (parsed.error !== undefined) return false;
    return parsed.data?.record?.brand_id === expectedBrandId;
  } catch {
    return false;
  }
}

function holdAuthorizedKnowledgeDraft(page: Page, expectedBrandId: string) {
  const held: Array<{ release: () => void; completed: Promise<void>; request: Request }> = [];
  let capturedSettled = false;
  let capturedResolve: (proof: { statusOk: boolean; expectedBrand: boolean }) => void = () =>
    undefined;
  let capturedReject: (error: Error) => void = () => undefined;
  const captured = new Promise<{ statusOk: boolean; expectedBrand: boolean }>((resolve, reject) => {
    capturedResolve = resolve;
    capturedReject = reject;
  });
  void captured.catch(() => undefined);
  const failCapture = (message: string) => {
    if (capturedSettled) return;
    capturedSettled = true;
    capturedReject(new Error(message));
  };
  const match = (url: URL) => url.pathname.includes(`/brands/${expectedBrandId}/knowledge-draft`);
  const handler = async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const request = route.request();
    const gate = createHoldGate();
    const completed = (async () => {
      try {
        const response = await route.fetch();
        const body = await response.text();
        const statusOk = response.ok() && response.status() === 200;
        const expectedBrand = draftMatchesExpectedBrand(body, expectedBrandId);
        if (!statusOk || !expectedBrand) {
          failCapture(
            'Held knowledge-draft capture was not a successful authorized draft for the expected brand.',
          );
          await route.fulfill({
            status: response.status(),
            contentType: response.headers()['content-type'] ?? 'application/json',
            body,
          });
          return;
        }
        if (!capturedSettled) {
          capturedSettled = true;
          capturedResolve({ statusOk, expectedBrand });
        }
        await gate.opened;
        await route.fulfill({
          status: response.status(),
          contentType: response.headers()['content-type'] ?? 'application/json',
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
      if (installed) return;
      installed = true;
      await page.route(match, handler);
    },
    async waitForAuthorizedCapture() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          failCapture('Timed out waiting for an authorized knowledge-draft capture.');
          reject(new Error('Timed out waiting for an authorized knowledge-draft capture.'));
        }, AUTHORIZED_CAPTURE_MS);
      });
      try {
        const proof = await Promise.race([captured, timeout]);
        await test.info().attach('knowledge-draft-hold', {
          body: JSON.stringify({
            status_ok: proof.statusOk,
            expected_brand: proof.expectedBrand,
          }),
          contentType: 'application/json',
        });
        expect(proof.statusOk).toBe(true);
        expect(proof.expectedBrand).toBe(true);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    },
    async release() {
      expect(held.length).toBeGreaterThan(0);
      for (const item of held) item.release();
      await Promise.all(held.map((item) => item.completed));
      await waitForRenderTurn(page);
    },
    async finish() {
      failCapture('Knowledge-draft hold finished without an authorized capture.');
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

function findingsAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

async function expectSelectedCandidate(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId('candidate-value')).toHaveText(value);
}

async function expectScrolledIntoViewport(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
}

async function captureWebsite(page: Page, url: string) {
  await page.getByLabel('Website', { exact: true }).fill(url);
  await page.getByRole('button', { name: 'Capture website' }).click();
}

async function expectJobStatus(page: Page, status: string) {
  await expect(page.getByTestId('source-job-status')).toHaveAttribute('data-status', status, {
    timeout: 30_000,
  });
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

async function attachAxeAndAria(page: Page, label: string) {
  const info = test.info();
  await info.attach(`${label}-aria`, {
    body: await page.locator('.platform-app').ariaSnapshot(),
    contentType: 'text/plain',
  });
  const fromProject = createRequire(pathToFileURL(join(findRepoRoot(), 'package.json')).href);
  const fromEslintConfigNext = createRequire(fromProject.resolve('eslint-config-next'));
  const fromJsxA11y = createRequire(fromEslintConfigNext.resolve('eslint-plugin-jsx-a11y'));
  const axePath = fromJsxA11y.resolve('axe-core/axe.min.js');
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: axePath });
  const compact = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: { runOnly: { type: string; values: string[] } },
          ) => Promise<{ violations: Array<{ id: string }>; passes: unknown[] }>;
        };
      }
    ).axe;
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return { violations: results.violations.map((item) => item.id), passes: results.passes.length };
  });
  await info.attach(`${label}-axe`, {
    body: JSON.stringify(compact),
    contentType: 'application/json',
  });
  expect(compact.violations).toEqual([]);
}
