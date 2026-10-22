import { defineConfig } from 'vitest/config';

/*
 * Separate from vite.config.ts on purpose: that one roots at app/ to serve the
 * UI, while the tests live at the repo root.
 *
 * TWO PROJECTS, and the split is the point (task E11).
 *
 *   node  `engine/**` and `app/**` files named `*.test.ts`. No DOM, as before:
 *         pure logic, plus markup through `renderToStaticMarkup`, which needs
 *         no document. This glob is NOT widened to pick up anything else.
 *
 *   dom   `app/**` files named `*.dom.test.tsx`, under jsdom with
 *         testing-library. For what static markup cannot reach: clicks,
 *         keypresses, focus, and state after an event. The double extension
 *         keeps the two sets disjoint, so a DOM test cannot land in the node
 *         project and pass by never touching a document, and a node test
 *         cannot quietly start depending on one.
 *
 * Before this, `.tsx` tests were never collected, and the docblock here forbade
 * widening the node glob as a substitute for a real DOM. That rule stands: the
 * DOM has its own project rather than a wider glob.
 */
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'node',
          include: ['engine/**/*.test.ts', 'app/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        // No React plugin: vitest's transform reads `jsx: react-jsx` from
        // tsconfig.json, and @vitejs/plugin-react targets the root vite 8,
        // whose plugin type does not match the vite vitest 3 carries.
        test: {
          name: 'dom',
          include: ['app/**/*.dom.test.tsx'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['app/test/domSetup.ts'],
        },
      },
    ],
  },
});
