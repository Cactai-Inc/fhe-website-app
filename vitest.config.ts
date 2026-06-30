import { defineConfig } from 'vitest/config';

// Dedicated Vitest config (kept separate from vite.config.ts for the SPA build).
// DB/integration tests run in the node environment; PGlite needs no Docker.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
});
