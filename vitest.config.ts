import { defineConfig } from 'vitest/config';

/*
 * Separate from vite.config.ts on purpose: that one roots at app/ to serve the
 * UI, while the tests live at the repo root.
 *
 * `app/**` is included for PURE LOGIC modules only, and the environment stays
 * unset (node) deliberately. A `.test.ts` under app/ may import plain functions
 * and nothing that touches the DOM. Rendering a component needs jsdom plus
 * testing-library, which is task E11 and is not this; widening the include
 * pattern is not a substitute for it, and anything that needs a document must
 * wait for it rather than quietly pulling an environment in here.
 */
export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts', 'app/**/*.test.ts'],
    globals: true,
  },
});
