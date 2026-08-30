import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CREDENTIALS_PATH = resolve(process.cwd(), '.scratch', 'self-session-kit-credentials.md');

test.use({
  screenshot: 'off',
  serviceWorkers: 'block',
  trace: 'off',
  video: 'off',
});

function requiredMatch(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  if (value === undefined || value.length === 0) throw new TypeError(`${label} is unavailable.`);
  return value;
}

async function openBriefSection(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${name}`, 'u') }).click();
}

async function fillGb04Brief(page: Page): Promise<void> {
  await openBriefSection(page, 'Product truth');
  await page.getByLabel('Product name *').fill('Stillroom Countertop Compost Caddy.');
  await page.getByLabel('Category *').fill('Home; 1.2-gallon kitchen scrap container.');
  await page
    .getByLabel('Features *')
    .fill(
      'Stainless outer shell, dishwasher-safe inner bucket, replaceable charcoal filter, carry handle, and nonslip base.',
    );
  await page
    .getByLabel('Supported benefits *')
    .fill('Keeps daily food-scrap collection contained and easy to carry.');
  await page
    .getByLabel('Evidence *')
    .fill(
      'Dimensional drawing, material declaration, filter-life bench test, care guide, and odor-panel methodology.',
    );
  await page
    .getByLabel('Approved facts *')
    .fill(
      '1.2-gallon capacity; inner bucket is dishwasher safe; one filter included; plastic-free outer shell.',
    );

  await openBriefSection(page, 'Brand kit');
  await page.getByLabel('Colors *').fill('Warm white, sand, black.');
  await page.getByLabel('Typography *').fill('Restrained sans type.');
  await page.getByLabel('Tone *').fill('Minimalist and precise.');
  await page.getByLabel('Visual rules *').fill('Architectural shadows and quiet negative space.');
  await page.getByLabel('Examples *').fill('Approved Stillroom product and scene photography.');
  await page.getByLabel('Prohibited treatments *').fill('No rustic-farm props.');

  await openBriefSection(page, 'Audience');
  await page
    .getByLabel('Target audience *')
    .fill('Apartment households 28–50 already comparing countertop compost systems.');
  await page.getByLabel('Awareness stage *').fill('Solution-aware.');
  await page
    .getByLabel('Pain points *')
    .fill('Odor concerns, limited counter space, and awkward cleaning.');
  await page.getByLabel('Desires *').fill('A calm kitchen and easy cleaning.');
  await page.getByLabel('Objections *').fill('Counter footprint, liner fit, and filter upkeep.');

  await openBriefSection(page, 'Offer');
  await page
    .getByLabel('Price presentation *')
    .fill('$129 bundle; component total $151; approved savings is $22.');
  await page
    .getByLabel('Urgency constraints *')
    .fill(
      'Bundle price runs through the supplied end date; no inventory or odor-elimination urgency.',
    );
  await page
    .getByLabel('Destination URL metadata *')
    .fill('https://stillroom-home.example/products/compost-bundle');

  await openBriefSection(page, 'Claims & legal');
  await page
    .getByLabel('Approved factual claims *')
    .fill(
      'State exact dimensions and “designed to help contain everyday odors with the lid closed.”',
    );
  await page
    .getByLabel('Evidence source *')
    .fill(
      'Supplied dimensions, material declaration, filter-life bench test, and odor-panel method.',
    );
  await page
    .getByLabel('Required legal copy *')
    .fill('Use only supplied product facts and approved component-value arithmetic.');
  await page
    .getByLabel('Prohibited claims *')
    .fill('Odor-free\nZero-waste\nCarbon-neutral\nLeakproof\nMunicipal-compostability');
  await page
    .getByLabel('Creative constraints *')
    .fill(
      'Keep dimensions visible in comparison concepts; do not show unapproved food brands; brand owns product and scene photography.',
    );
  await page
    .getByLabel(/I attest that this workspace owns or is licensed to use all uploaded packshots/u)
    .check();

  await openBriefSection(page, 'Assets');
  await page
    .getByLabel(/One square product packshot is uploaded and ready for adaptation/u)
    .check();
}

test('operator proves the GB-04 buyer entry and quote path on deployed staging without spend', async ({
  page,
}, testInfo) => {
  test.skip(process.env['MBV_SELF_SESSION_E2E'] !== '1', 'Explicit operator staging lane only');
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One operator staging flow only');
  test.setTimeout(180_000);

  const credentials = await readFile(CREDENTIALS_PATH, 'utf8');
  const email = requiredMatch(credentials, /^- Email: (.+)$/mu, 'operator email');
  const password = requiredMatch(credentials, /^- Password: (.+)$/mu, 'operator password');
  let blockedRunRequests = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/runs')) {
      blockedRunRequests += 1;
      await route.abort('blockedbyclient');
      return;
    }

    await route.continue();
  });

  await page.goto('/login');
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/studio\/campaign\/brief$/u);
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();

  await fillGb04Brief(page);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('button', { name: 'Saved for this session' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Product name *')).toHaveValue(
    'Stillroom Countertop Compost Caddy.',
  );

  await openBriefSection(page, 'Assets');
  const sentinelWorkspace = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === 'POST' && new URL(response.url()).pathname === '/api/core/v1/workspaces'
    );
  });
  await page.getByLabel('Attach a JPEG, PNG, or WebP packshot').setInputFiles({
    name: 'gb04-synthetic-packshot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const firstWorkspaceResponse = await sentinelWorkspace;
  expect(firstWorkspaceResponse.ok()).toBe(true);
  const firstWorkspace = (await firstWorkspaceResponse.json()) as Readonly<{
    data?: Readonly<{ workspace_id?: string }>;
  }>;
  await expect(page.getByText('Uploaded packshot', { exact: true })).toBeVisible();

  const replayedSentinelWorkspace = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === 'POST' && new URL(response.url()).pathname === '/api/core/v1/workspaces'
    );
  });
  await page.getByRole('button', { name: 'Validate brief' }).click();
  const replayedWorkspaceResponse = await replayedSentinelWorkspace;
  const replayedWorkspace = (await replayedWorkspaceResponse.json()) as Readonly<{
    data?: Readonly<{ workspace_id?: string }>;
  }>;
  expect(replayedWorkspaceResponse.ok()).toBe(true);
  const sentinelReplayedToSameWorkspace =
    typeof firstWorkspace.data?.workspace_id === 'string' &&
    replayedWorkspace.data?.workspace_id === firstWorkspace.data.workspace_id;
  expect(sentinelReplayedToSameWorkspace).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const url = new URL(window.location.href);
        return (
          /^\/studio\/[0-9a-f-]+\/canvas$/u.test(url.pathname) &&
          /^[0-9a-f-]+$/u.test(url.searchParams.get('canvas') ?? '')
        );
      }),
    )
    .toBe(true);
  await expect(page.locator('[data-node-id="master-1"]')).toBeVisible();
  await expect(page.locator('[data-node-id="motion-1"]')).toBeVisible();
  const quoteResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === 'POST' &&
      /\/api\/core\/v1\/canvases\/[0-9a-f-]+\/quotes$/u.test(new URL(response.url()).pathname)
    );
  });
  await page.getByRole('link', { name: 'Review named quote' }).click();
  const capturedQuoteResponse = await quoteResponse;
  expect(capturedQuoteResponse.ok()).toBe(true);
  const capturedQuoteEnvelope = (await capturedQuoteResponse.json()) as Readonly<{
    data?: Readonly<{
      quote?: Readonly<{
        maximumChargeMicros?: unknown;
        nodeLines?: unknown;
      }>;
    }>;
  }>;
  const capturedMaximumChargeMicros =
    typeof capturedQuoteEnvelope.data?.quote?.maximumChargeMicros === 'string'
      ? capturedQuoteEnvelope.data.quote.maximumChargeMicros
      : 'invalid';
  const capturedNodeLineCount = Array.isArray(capturedQuoteEnvelope.data?.quote?.nodeLines)
    ? capturedQuoteEnvelope.data.quote.nodeLines.length
    : -1;
  expect(capturedMaximumChargeMicros).toBe('4550000');
  expect(capturedNodeLineCount).toBe(16);
  await expect(
    page.getByRole('heading', { name: 'Review this run before spending' }),
  ).toBeVisible();
  await expect(page.getByTestId('quote-total')).toHaveText('$4.55');
  await expect(page.getByRole('button', { name: 'Confirm $4.55 run' })).toBeDisabled();
  const quoteTableRowCount = await page.locator('tbody tr').count();
  expect(quoteTableRowCount).toBe(17);
  expect(blockedRunRequests).toBe(0);

  const proof = {
    login_without_next: true,
    campaign_sentinel_bootstrapped: true,
    draft_restored: true,
    synthetic_packshot_attached: true,
    gb04_quote_micros: capturedMaximumChargeMicros,
    priced_line_count: capturedNodeLineCount,
    run_submitted: false,
  };
  await testInfo.attach('operator-staging-no-spend-proof', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(proof)),
  });
  console.log(`OPERATOR_STAGING_NO_SPEND ${JSON.stringify(proof)}`);
});
