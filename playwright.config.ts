import { defineConfig, devices } from '@playwright/test';

const stagingE2e = process.env.MBV_STAGING_E2E === '1';
const externalE2e = process.env.MBV_PLAYWRIGHT_EXTERNAL === '1';
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '3000';
const localBaseUrl = `http://127.0.0.1:${playwrightPort}`;
const corepackExecutable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: externalE2e
    ? undefined
    : {
        command: stagingE2e
          ? `${corepackExecutable} pnpm --filter @mustbeviral/web build && ${corepackExecutable} pnpm --filter @mustbeviral/web exec next start --port ${playwrightPort}`
          : `${corepackExecutable} pnpm --filter @mustbeviral/web exec next dev --port ${playwrightPort}`,
        reuseExistingServer: stagingE2e ? false : !process.env.CI,
        url: stagingE2e ? localBaseUrl : `${localBaseUrl}/studio/lumen-skin/canvas?fixture=100`,
        ...(stagingE2e
          ? {}
          : {
              env: {
                ...inheritedEnvironment,
                MBV_LOCAL_GOLDEN_PREVIEW: '1',
                MBV_PLAYWRIGHT_DIST_DIR: '.next/playwright',
              },
            }),
      },
});
