import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8101,
    proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 8100}` },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/main.tsx", "src/test/**", "src/**/*.test.*"],
      thresholds: { statements: 80 },
    },
  },
});
