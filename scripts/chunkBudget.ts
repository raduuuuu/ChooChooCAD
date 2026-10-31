/**
 * THE EDITOR STAYS SMALL (3D plan, eng D11). Run after `bun run build`, in CI
 * and by hand: `bun scripts/chunkBudget.ts`.
 *
 * The main chunk was 124.07 kB gzipped before the 3D view (measured
 * 2026-10-31, `bun run build` at b757b9a); it may grow by at most 5 kB. And
 * Three.js must not be in it: its renderer's name in the main chunk means a
 * stray import pulled it in, which `app/src/view3dImports.test.ts` also
 * guards from the source side.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ASSETS = join(import.meta.dir, '..', 'app', 'dist', 'assets');
const BASELINE_KB = 124.07;
const ALLOWANCE_KB = 5;

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
const main = files.filter((f) => f.startsWith('index-'));
const viewer = files.filter((f) => f.startsWith('Viewer3D-'));
const fail = (msg: string): never => {
  console.error(`chunk budget: ${msg}`);
  process.exit(1);
};

if (main.length !== 1) fail(`expected one main chunk (index-*.js), found ${main.length}`);
if (viewer.length !== 1) fail(`expected one lazy viewer chunk (Viewer3D-*.js), found ${viewer.length}`);
const code = readFileSync(join(ASSETS, main[0]!));
// zlib's default level, in thousands of bytes: the figure Vite's build prints, which the baseline is.
const kb = gzipSync(code).length / 1000;
const limit = BASELINE_KB + ALLOWANCE_KB;
if (code.includes('WebGLRenderer')) fail(`${main[0]} contains WebGLRenderer: Three.js is in the main chunk`);
if (kb > limit) fail(`${main[0]} is ${kb.toFixed(2)} kB gzipped, over the ${limit.toFixed(2)} kB budget`);
console.log(`chunk budget: ${main[0]} ${kb.toFixed(2)} kB gzipped (budget ${limit.toFixed(2)} kB); Three.js only in ${viewer[0]}`);
