import { defineConfig, devices } from '@playwright/test';

/** Exercises the local wait board on desktop and mobile Chromium. */
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4175' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  workers: 2,
  webServer: [
    {
      command: 'pnpm data:local && pnpm --dir apps/web preview:test',
      env: { ORLANDOTRACKR_PREVIEW_BUILD: 'true' },
      url: 'http://127.0.0.1:4175/health',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command:
        'pnpm --dir apps/web exec vite --host 127.0.0.1 --port 4176 --strictPort',
      url: 'http://127.0.0.1:4176/health',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
