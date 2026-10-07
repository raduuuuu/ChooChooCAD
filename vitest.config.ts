import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: that one roots at app/ to serve the
// UI, while the tests live under engine/ at the repo root.
export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts'],
    globals: true,
  },
});
