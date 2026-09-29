import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // Test-only placeholder so the fail-closed ticket check can be exercised. Deployed Workers
        // receive the real value through `wrangler secret put`, never through configuration.
        bindings: {
          COLLABORATION_TICKET_SECRET: 'test-only-collaboration-ticket-secret-000000',
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
