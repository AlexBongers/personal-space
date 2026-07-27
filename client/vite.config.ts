import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8200';

/** Domain types live once, in the server, and are aliased in here. */
const SHARED_TYPES = resolve(here, '../server/src/types.ts');

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': SHARED_TYPES } },
  server: {
    port: 8201,
    strictPort: true,
    fs: { allow: [resolve(here, '..')] },
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/types.ts', 'src/test/**'],
    },
  },
});
