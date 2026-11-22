/**
 * WRITE THE PAGES A SEARCH ENGINE CAN READ (plan 2026-11-14, E1). Runs before `vite build` and `vite` (package.json), so the
 * pages always come from the ready layouts in the tree:
 *
 *   bun scripts/layoutPages.ts
 *
 * Writes every page `app/src/pages/site.ts` lists with a file (today
 * `app/layouts/index.html` and one page per ready layout that closes, which
 * vite.config.ts picks up as extra pages), each layout's picture file into
 * `app/public/layouts/` (in `public` so it keeps its address through the
 * build) and `app/public/sitemap.xml`. All of it is generated and
 * git-ignored; `app/src/pages/` is the source and
 * `app/src/pages/pages.test.ts` holds what the pages must say.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { site, sitemap } from '../app/src/pages/site.js';

const app = join(import.meta.dir, '..', 'app');
const dir = join(app, 'layouts');

const pictures = join(app, 'public', 'layouts');

mkdirSync(dir, { recursive: true });
mkdirSync(pictures, { recursive: true });
// A layout that stopped closing must lose its page and its picture, so last build's files go first.
for (const f of readdirSync(dir)) if (f.endsWith('.html')) rmSync(join(dir, f));
// Only the pictures the build draws: the PNGs beside them are committed (scripts/ogImage.ts).
for (const f of readdirSync(pictures)) if (f.endsWith('.svg')) rmSync(join(pictures, f));

const { pages, files } = await site(readFileSync(join(app, 'src', 'tokens.css'), 'utf8'));
for (const f of files) writeFileSync(join(app, f.file), f.content);
const written = pages.flatMap((p) => (p.file !== null && p.html !== null ? [{ file: p.file, html: p.html }] : []));
for (const p of written) {
  mkdirSync(dirname(join(app, p.file)), { recursive: true });
  writeFileSync(join(app, p.file), p.html);
}
writeFileSync(join(app, 'public', 'sitemap.xml'), sitemap(pages));
console.log(`pages written: ${written.length} (${written.map((p) => p.file).join(', ')}); pictures: ${files.length}; sitemap: ${pages.length} addresses`);
