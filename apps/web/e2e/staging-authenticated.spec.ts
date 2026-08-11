import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import {
  authenticateDisposableStagingUser,
  createConfirmedDisposableStagingUser,
  createDisposableIdentity,
  loadStagingAdminConfiguration,
} from '../../core/tools/staging-auth';

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';

function requireData<
  Response extends Readonly<{ data: unknown }> | Readonly<{ error: { code: string } }>,
>(response: Response): Extract<Response, { data: unknown }>['data'] {
  if ('error' in response) throw new Error(`Staging setup failed with ${response.error.code}.`);
  return response.data as Extract<Response, { data: unknown }>['data'];
}

test('signs in and reads a disposable staging canvas without starting a run', async ({
  page,
}, testInfo) => {
  test.skip(process.env['MBV_STAGING_E2E'] !== '1', 'Explicit staging E2E lane only');
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One disposable staging flow only');
  test.setTimeout(120_000);

  const configuration = await loadStagingAdminConfiguration();
  const identity = createDisposableIdentity();
  await createConfirmedDisposableStagingUser({ configuration, identity });
  const authentication = await authenticateDisposableStagingUser({
    configuration,
    identity,
    log: () => undefined,
  });
  const keyPrefix = `web-e2e-${randomUUID()}`;
  const client = createMustBeViralRestClient({
    baseUrl: STAGING_CORE_URL,
    getAccessToken: async () => authentication.accessToken,
    createRequestId: () => `web-e2e-${randomUUID()}`,
  });

  const workspace = requireData(
    await client.request('create_workspace', {
      idempotencyKey: `${keyPrefix}-workspace`,
      body: { name: `Web E2E ${keyPrefix.slice(-8)}` },
    }),
  );
  const project = requireData(
    await client.request('create_project', {
      id: workspace.workspace_id,
      idempotencyKey: `${keyPrefix}-project`,
      body: { name: 'Authenticated read-path proof' },
    }),
  );
  const canvas = requireData(
    await client.request('create_canvas', {
      id: project.project.id,
      idempotencyKey: `${keyPrefix}-canvas`,
      body: { name: 'Staging read and quote boundary' },
    }),
  );
  const patched = requireData(
    await client.request('apply_canvas_patch', {
      id: canvas.canvasId,
      idempotencyKey: `${keyPrefix}-patch`,
      body: {
        expected_revision_id: canvas.revisionId,
        reason: 'Staging authenticated read-path fixture',
        patch: {
          upsert_nodes: [
            {
              id: 'brand-context',
              kind: 'brand_context',
              parameter_schema_version: 1,
              parameters: { approved_facts: 'Synthetic staging proof only.' },
            },
            {
              id: 'master-static',
              kind: 'image_generation',
              parameter_schema_version: 1,
              parameters: {
                asset_role: 'master_static',
                prompt: 'A blank cobalt bottle on a pale gray background.',
                aspect_ratio: '1:1',
              },
            },
          ],
          remove_node_ids: [],
          upsert_edges: [
            {
              id: 'edge-brief-brand',
              kind: 'dependency',
              source_node_id: 'brief',
              target_node_id: 'brand-context',
            },
            {
              id: 'edge-brand-static',
              kind: 'dependency',
              source_node_id: 'brand-context',
              target_node_id: 'master-static',
            },
          ],
          remove_edge_ids: [],
        },
      },
    }),
  );
  await testInfo.attach('staging-disposable-setup', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        observed_at: new Date().toISOString(),
        workspace_id: workspace.workspace_id,
        project_id: project.project.id,
        canvas_id: canvas.canvasId,
        revision_id: patched.revisionId,
      }),
    ),
  });

  const canvasPath = `/studio/${encodeURIComponent(workspace.workspace_id)}/canvas?canvas=${encodeURIComponent(canvas.canvasId)}`;
  await page.goto(`/login?next=${encodeURIComponent(canvasPath)}`);
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill(identity.password);
  const canvasRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === `/api/core/v1/canvases/${canvas.canvasId}`,
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas\\?canvas=${canvas.canvasId}$`, 'u'));
  await expect((await canvasRead).status()).toBe(200);
  await expect(page.locator('[data-node-id="master-static"]')).toBeVisible();
  await expect(page.getByText(patched.revisionId, { exact: true }).first()).toBeVisible();

  await expect(page.locator('[data-run-state]')).toHaveCount(0);
  const proof = {
    observed_at: new Date().toISOString(),
    workspace_id: workspace.workspace_id,
    project_id: project.project.id,
    canvas_id: canvas.canvasId,
    revision_id: patched.revisionId,
    run_submitted: false,
  };
  await testInfo.attach('staging-read-boundary-proof', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(proof)),
  });
  console.log(`STAGING_READ_BOUNDARY ${JSON.stringify(proof)}`);
});
