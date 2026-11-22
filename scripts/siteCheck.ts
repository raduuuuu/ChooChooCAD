/**
 * THE BUILT SITE HOLDS EVERY ADDRESS IT PROMISES (owner, 2026-11-22).
 * Run after `bun run build`:
 *
 *   bun scripts/siteCheck.ts
 *
 * The tests run before the build and read the pages as strings, so nothing
 * they say proves a file is where its address points. This reads the
 * sitemap the build shipped and looks for each address in `app/dist`.
 * Exit 1, naming each one, when any is missing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addressesIn, fileOf } from '../app/src/pages/site.js';

const dist = join(import.meta.dir, '..', 'app', 'dist');

const mapFile = join(dist, 'sitemap.xml');
if (!existsSync(mapFile)) {
  console.error('site check: app/dist/sitemap.xml is missing; run `bun run build` first');
  process.exit(1);
}
const addresses = addressesIn(readFileSync(mapFile, 'utf8'));
const missing = addresses.filter((a) => !existsSync(join(dist, fileOf(a))));
if (addresses.length === 0 || missing.length > 0) {
  console.error(addresses.length === 0 ? 'site check: the sitemap lists no address' : `site check: in the sitemap, not in app/dist: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`site check: all ${addresses.length} sitemap addresses are in app/dist`);
