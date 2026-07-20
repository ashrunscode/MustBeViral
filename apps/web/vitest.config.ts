import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@mustbeviral/graph': fileURLToPath(
        new URL('../../packages/graph/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: false,
    restoreMocks: true,
  },
});
