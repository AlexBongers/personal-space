import { defineConfig, devices } from '@playwright/test';

const PORT = 8210;

/**
 * Drives the real production build against a throwaway SQLite file, so every
 * run starts from the seeded workspace.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `rm -rf data/e2e && PORT=${PORT} DB_PATH=data/e2e/space.sqlite ALLOW_TEST_RESET=1 node server/dist/index.js`,
    url: `http://127.0.0.1:${PORT}/api/tree`,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000,
  },
});
