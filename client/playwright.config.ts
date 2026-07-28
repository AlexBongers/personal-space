import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/__e2e__",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  reporter: "list",
  use: {
    baseURL: "http://localhost:8301",
    browserName: "chromium",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8301",
    reuseExistingServer: true,
    cwd: "..",
    timeout: 30000,
  },
});