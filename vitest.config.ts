import { defineConfig } from 'vitest/config';

/** Runs colocated tests for the waits feature and gateway code. */
export default defineConfig({
  test: {
    include: ['apps/web/app/**/*.test.ts', 'workers/gateway/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/web/app/features/waits/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
