/**
 * `bun run photos:score`: the photo check against real photos, each with the
 * verdict it should give. The unit tests' synthetic photos are clean; the
 * fixes for real ones (shadows on warm paper, wood across the middle, red ink,
 * two sheets, perspective) are guarded only here. The photos are the owner's
 * and are never committed (photos/ is ignored); a missing one is skipped.
 *
 *   photo ──checkImage──▶ OK (and the long straight's reading) or what to reshoot
 *        │
 *        ▼
 *   PASS when it matches the expected verdict; exit 1 when any photo fails
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkImage } from './photoCheck.js';
import { loadPhoto } from './photoImage.js';

/** 'ok': grid and medium straight, no problem; 'ok-long': also the long straight within 1mm of 216; else a pattern the reshoot reason must match. */
type Want = 'ok' | 'ok-long' | RegExp;

const EXPECT: readonly [string, Want, string][] = [
  ['84401', 'ok-long', 'blue paper, the 216mm trial'],
  ['84402', 'ok-long', 'blue paper, the 216mm trial again (socket end in shadow)'],
  ['84426', 'ok', 'blue paper, a wide piece beside the reference'],
  ['84405', 'ok', 'blue paper, wood across the middle'],
  ['84397', /cross the middle/, 'the reference off to one side: its end face shows'],
  ['84398', 'ok', 'pale blue paper, a plank on its side, a patterned cloth past the sheet'],
  ['84403', /use one sheet/, 'two sheets side by side'],
  ['84404', /touch/, 'two pieces touching'],
  ['85363', /white, blue or pink/, 'cream paper with orange lines'],
  ['85582', 'ok', 'pink paper, red ink, an orange and grey piece; the reference\'s shadow on the paper'],
  ['85784', /touch/, 'pink paper, the orange roof over the whole middle, 1cm from the straight (read as warm paper, then as no grid, before 2026-11-09)'],
  ['85785', 'ok', 'pink paper, the same piece from further back'],
  ['85844', 'ok-long', 'white paper under a warm evening lamp, paper 19 green over blue: the trial (refused as warm paper before 2026-11-09)'],
  ['85845', 'ok-long', 'the same lamp, paper 13: under wood\'s bar, but its grid read as wood unbalanced (no grid before 2026-11-09)'],
  ['85846', 'ok', 'the same lamp, a bridge beside the reference'],
];

export function score(dir: string, print: (line: string) => void = console.log): number {
  let pass = 0, ran = 0;
  for (const [name, want, what] of EXPECT) {
    const path = join(dir, `${name}.jpg`);
    if (!existsSync(path)) continue;
    ran++;
    const c = checkImage(loadPhoto(path));
    const ok = c.problems.length === 0;
    const good = want === 'ok' ? ok
      : want === 'ok-long' ? ok && c.longMm !== undefined && Math.abs(c.longMm - 216) <= 1
      : !ok && want.test(c.problems.join(' '));
    if (good) pass++;
    const got = ok ? `OK${c.longMm !== undefined ? ` long ${c.longMm.toFixed(2)}mm` : ''}` : `reshoot: ${c.problems[0]}`;
    print(`${good ? 'PASS' : 'FAIL'} ${name} (${what}): ${got}${c.gridPoints !== undefined ? ` [grid ${c.gridPoints}, ${c.gridRmsMm!.toFixed(2)}mm]` : ''}`);
  }
  print(`${pass}/${ran} pass${ran < EXPECT.length ? ` (${EXPECT.length - ran} photos not in ${dir})` : ''}`);
  return ran > 0 && pass === ran ? 0 : 1;
}

if (import.meta.main) process.exit(score(process.argv[2] ?? 'photos'));
