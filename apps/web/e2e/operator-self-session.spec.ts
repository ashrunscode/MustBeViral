import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CREDENTIALS_PATH = resolve(process.cwd(), '.scratch', 'self-session-kit-credentials.md');

function requiredMatch(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  if (value === undefined || value.length === 0) throw new TypeError(`${label} is unavailable.`);
  return value;
}

test('operator signs in and reads the seeded GB-02 canvas from deployed staging', async ({
  page,
}, testInfo) => {
  test.skip(process.env['MBV_SELF_SESSION_E2E'] !== '1', 'Explicit operator staging lane only');
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One operator staging flow only');
  test.setTimeout(120_000);

  const credentials = await readFile(CREDENTIALS_PATH, 'utf8');
  const email = requiredMatch(credentials, /^- Email: (.+)$/mu, 'operator email');
  const password = requiredMatch(credentials, /^- Password: (.+)$/mu, 'operator password');
  const workspaceId = requiredMatch(
    credentials,
    /^- Staging workspace ID: ([0-9a-f-]+)$/mu,
    'operator workspace',
  );
  const canvasId = requiredMatch(
    credentials,
    /^- GB-02 .+canvas\?canvas=([0-9a-f-]+)$/mu,
    'GB-02 canvas',
  );
  const canvasPath = `/studio/${workspaceId}/canvas?canvas=${canvasId}`;

  await page.goto(`/login?next=${encodeURIComponent(canvasPath)}`);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const canvasRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === `/api/core/v1/canvases/${canvasId}`,
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas\\?canvas=${canvasId}$`, 'u'));
  await expect((await canvasRead).status()).toBe(200);
  await expect(page.locator('[data-node-id="master-1"]')).toBeVisible();
  await expect(page.locator('[data-node-id="motion-1"]')).toBeVisible();
  await expect(page.locator('[data-run-state]')).toHaveCount(0);

  const proof = {
    observed_at: new Date().toISOString(),
    workspace_id: workspaceId,
    canvas_id: canvasId,
    sign_in_loaded: true,
    canvas_http_status: 200,
    run_submitted: false,
  };
  await testInfo.attach('operator-staging-read-proof', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(proof)),
  });
  console.log(`OPERATOR_STAGING_READ ${JSON.stringify(proof)}`);
});
