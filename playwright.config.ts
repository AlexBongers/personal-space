import { defineConfig } from "@playwright/test";

const PORT = 8150;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `rm -rf e2e/.tmp && node start.mjs --port ${PORT} --db e2e/.tmp/e2e.db`,
    url: `http://localhost:${PORT}/api/tree`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
