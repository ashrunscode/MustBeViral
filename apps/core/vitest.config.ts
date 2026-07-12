import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        hyperdrives: {
          HYPERDRIVE: 'postgres://postgres:postgres@127.0.0.1:54322/postgres',
        },
      },
    }),
  ],
  test: {
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
    maxWorkers: 1,
    passWithNoTests: false,
    restoreMocks: true,
    testTimeout: 15_000,
  },
});
