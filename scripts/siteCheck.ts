/**
 * THE BUILT SITE HOLDS EVERY ADDRESS IT PROMISES (owner, 2026-11-22).
 * Run after `bun run build`:
 *
 *   bun scripts/siteCheck.ts
 *
 * The tests run before the build and read the pages as strings, so nothing
 * they say proves a file is where its address points. This reads the
 * sitemap the build shipped and looks in `app/dist` for each address, for
 * each picture the sitemap lists, and for each picture a built page shows
 * or gives as its link preview. Exit 1, naming each one, when any is missing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addressesIn, fileOf, picturesIn, picturesOf } from '../app/src/pages/site.js';

const dist = join(import.meta.dir, '..', 'app', 'dist');

const mapFile = join(dist, 'sitemap.xml');
if (!existsSync(mapFile)) {
  console.error('site check: app/dist/sitemap.xml is missing; run `bun run build` first');
  process.exit(1);
}
const map = readFileSync(mapFile, 'utf8');
const addresses = addressesIn(map);
const there = (path: string) => existsSync(join(dist, fileOf(path)));
const missingPages = addresses.filter((a) => !there(a));
const pictures = new Set(picturesIn(map));
for (const a of addresses.filter(there)) for (const pic of picturesOf(readFileSync(join(dist, fileOf(a)), 'utf8'))) pictures.add(pic);
const missingPictures = [...pictures].filter((pic) => !there(pic));
if (addresses.length === 0) {
  console.error('site check: the sitemap lists no address');
  process.exit(1);
}
if (missingPages.length > 0 || missingPictures.length > 0) {
  if (missingPages.length > 0) console.error(`site check: in the sitemap, not in app/dist: ${missingPages.join(', ')}`);
  if (missingPictures.length > 0) console.error(`site check: a picture a page or the sitemap names is not in app/dist: ${missingPictures.join(', ')}`);
  process.exit(1);
}
console.log(`site check: all ${addresses.length} sitemap addresses and ${pictures.size} pictures are in app/dist`);
