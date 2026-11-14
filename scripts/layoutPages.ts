/**
 * WRITE THE PAGES A SEARCH ENGINE CAN READ (plan 2026-11-14, E1). Runs before
 * `vite build` and `vite` (package.json), so the pages always come from the
 * ready layouts in the tree:
 *
 *   bun scripts/layoutPages.ts
 *
 * Writes `app/layouts/index.html` and one page per ready layout that closes,
 * which vite.config.ts picks up as extra pages, and `app/public/sitemap.xml`.
 * All of it is generated and git-ignored; `app/src/layoutPages.ts` is the
 * source and `app/src/layoutPages.test.ts` holds what the pages must say.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { layoutPages, sitemap } from '../app/src/layoutPages.js';

const app = join(import.meta.dir, '..', 'app');
const dir = join(app, 'layouts');

mkdirSync(dir, { recursive: true });
// A layout that stopped closing must lose its page, so last build's files go first.
for (const f of readdirSync(dir)) if (f.endsWith('.html')) rmSync(join(dir, f));

const { index, pages } = await layoutPages();
writeFileSync(join(dir, 'index.html'), index);
for (const p of pages) writeFileSync(join(dir, `${p.slug}.html`), p.html);
writeFileSync(join(app, 'public', 'sitemap.xml'), sitemap(pages));
console.log(`layout pages: ${pages.map((p) => p.slug).join(', ')}, and the list`);
