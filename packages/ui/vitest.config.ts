import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    include: /\.[jt]sx?$/,
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.{ts,tsx}'],
    maxWorkers: 1,
    passWithNoTests: false,
    pool: 'threads',
    restoreMocks: true,
  },
});
