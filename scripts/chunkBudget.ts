/**
 * THE EDITOR STAYS SMALL (3D plan, eng D11). Run after `bun run build`, in CI
 * and by hand: `bun scripts/chunkBudget.ts`.
 *
 * The main chunk was 124.07 kB gzipped before the 3D view (measured
 * 2026-10-31, `bun run build` at b757b9a), with 5 kB allowed on top. The 3D
 * view and build mode spent that allowance on purpose, each reviewed, so the
 * baseline was re-measured once they shipped: 129.02 kB (2026-10-31, at
 * b3210c1, the owner's call). Sharing, the look, the first-visit example and
 * the editing fixes of plan 2026-11-01 spent that allowance in turn, so it
 * was re-measured again: 134.27 kB (2026-11-01, the stacked-ends PR, the
 * owner's call). The new parts of 2026-11-03 (bridges, crossings, the
 * track support, the decorated-piece model and the level crossing) spent
 * that allowance on part data, so it was re-measured again: 139.67 kB
 * (2026-11-03, the level-crossing PR, the owner's call). The decorated
 * pieces' detail, the station, tunnel and crossing, and the selection in 3D
 * spent it in turn, so it was re-measured again: 144.10 kB (2026-11-06, main
 * at 11c79e9, before the raised-track supports check; the owner's call). The
 * supports check, the 3D paint, the elevated station's detail and then the
 * metro tunnel and station with the version list they called for spent
 * that, so it was re-measured again: 149.20 kB (2026-11-07, the metro PR,
 * the owner's call). The pieces and plans since (the cargo crane and the
 * other structures, the contributor link, the piece checker) and then the
 * five ready layouts with their box-can-build words spent that in turn, so
 * it was re-measured again: 154.53 kB (2026-11-14, the ready-layouts PR, the
 * owner's call: plan 2026-11-14-additions-eng.md, choice C7).
 *
 * WHAT IS MEASURED CHANGED ON 2026-11-14 (the finish-the-loop PR), and the
 * figure above is restated, not raised. Until then this counted the one file
 * `index-*.js`. The first lazy import of code the editor also uses (the fill
 * search shares the solver) made the bundler move that shared code out of
 * `index-*.js` into a second file the page still loads at once: `index-*.js`
 * alone fell from 154.52 to 131.02 kB while the page's first load GREW. A
 * budget on one file would have passed that, and any later growth hidden the
 * same way. So this now adds up everything the page loads before it can
 * draw: the entry script and every script `index.html` preloads.
 *
 * On that measure main at 535b400 (the very build whose `index-*.js` was the
 * 154.52 above) is 162.06 kB: 154.52 plus the 7.54 kB `render-*.js` it always
 * preloaded and this never counted. That was the baseline. Finish the loop's
 * offer, the train run on the plan and in 3D, and the piece shelves cut out
 * of App.tsx spent that allowance, so it was re-measured again: 166.90 kB
 * (2026-11-14, the end-marks PR, the first step of the phone editor; the
 * owner's call: plan 2026-11-14-additions-eng.md, choice C7 and ED8, "yes
 * re-measure at the first step"). The phone editor's own screen loads as a
 * separate file and is not in this figure; what it must add to the editor
 * itself is. It may grow by at most 5 kB from there. And Three.js must not
 * be in any of it: its
 * renderer's name in a first-load file means a stray import pulled it in,
 * which `app/src/view3dImports.test.ts` also guards from the source side.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(import.meta.dir, '..', 'app', 'dist');
const ASSETS = join(DIST, 'assets');
const BASELINE_KB = 166.9;
const ALLOWANCE_KB = 5;

const fail = (msg: string): never => {
  console.error(`chunk budget: ${msg}`);
  process.exit(1);
};

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
const viewer = files.filter((f) => f.startsWith('Viewer3D-'));
if (viewer.length !== 1) fail(`expected one lazy viewer chunk (Viewer3D-*.js), found ${viewer.length}`);

// The first load: the entry script and every script the page preloads, as index.html names them.
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const first = [...new Set([...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]!))];
if (!first.some((f) => f.startsWith('index-'))) fail('index.html names no entry script (index-*.js)');
if (first.includes(viewer[0]!)) fail(`${viewer[0]} is loaded with the page: the 3D view is no longer lazy`);

let kb = 0;
for (const f of first) {
  const code = readFileSync(join(ASSETS, f));
  if (code.includes('WebGLRenderer')) fail(`${f} contains WebGLRenderer: Three.js is in the first load`);
  // zlib's default level, in thousands of bytes: the figure Vite's build prints, which the baseline is.
  kb += gzipSync(code).length / 1000;
}
const limit = BASELINE_KB + ALLOWANCE_KB;
if (kb > limit) fail(`the first load (${first.join(', ')}) is ${kb.toFixed(2)} kB gzipped, over the ${limit.toFixed(2)} kB budget`);
console.log(
  `chunk budget: first load ${kb.toFixed(2)} kB gzipped in ${first.length} files (budget ${limit.toFixed(2)} kB); Three.js only in ${viewer[0]}`,
);
