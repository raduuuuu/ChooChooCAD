/**
 * THE MEASURING SCOREBOARD (measuring-tools plan 2026-11-09, item 12, CEO E3
 * and decision 10): `bun run photos:measure-score [folder]` measures known
 * pieces on the owner's photos with photoMeasure's core, and says which still
 * read what they should. Run it after any change to the photo tools.
 *
 * Each entry holds its points (photo pixels, upright; the photos stay in the
 * ignored photos/ folder, SEC1) and each figure's expected value, tolerance
 * and the basis for both. Two kinds, kept apart:
 *
 *   repeatability  a photo's own recorded reading (photoReadings.ts), within
 *                  AGREE_MM: the new code reads as the old did
 *   accuracy       a piece of known length, within TOLERANCE_MM: it reads right
 *
 * A missing photo is skipped and counted. Exit 1 on any miss, or when none ran.
 * The T switch's points were picked off crops by eye, as a contributor's
 * agent would (2026-11-09); the long straight's are the photo check's own.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AGREE_MM, TOLERANCE_MM } from '../data/photoReadings.js';
import { loadUpright, PhotoError, type RgbImage } from './photoImage.js';
import { measure, resolvePoints, type PointsFile } from './photoMeasure.js';

export interface Expected {
  readonly mm: number;
  readonly tolMm: number;
}

export interface Entry {
  readonly photo: string;
  readonly what: string;
  /** Where the expected values and the tolerance come from. */
  readonly basis: string;
  readonly points: PointsFile;
  readonly expect: Readonly<Record<string, Expected>>;
}

/** The T switch's three figures on one photo: S (socket end), P (peg end), C (curved end's centre) and C's toward. */
const tSwitch = (s: [number, number], p: [number, number], c: [number, number], toward: [number, number], reference?: PointsFile['reference']): PointsFile => ({
  ...(reference ? { reference } : {}),
  figures: {
    through: [s, p],
    along: { point: c, toward, line: [s, p], read: 'along' },
    out: { point: c, toward, line: [s, p], read: 'offset' },
  },
});
const own = (through: number, along: number, out: number) => ({
  through: { mm: through, tolMm: AGREE_MM },
  along: { mm: along, tolMm: AGREE_MM },
  out: { mm: out, tolMm: AGREE_MM },
});

export const ENTRIES: readonly Entry[] = [
  {
    photo: '84405.jpg',
    what: 'T switch, through road vertical, curved end to the left',
    basis: "84405's own recorded readings (photoReadings.ts), within AGREE_MM: repeatability",
    points: tSwitch([2334, 530], [2327, 3538], [857.5, 2056], [1135, 2056]),
    expect: own(216.49, 108.49, 105.34),
  },
  {
    photo: '84404.jpg',
    what: 'T switch mirrored; its curved end touches the medium straight',
    basis: "84404's own recorded readings, within AGREE_MM; the reference given, since photos:score expects the automatic one refused (two pieces touch)",
    points: tSwitch([899, 3570], [887, 923], [2195, 2240], [1951, 2240], [[2478, 1568], [2487, 3320]]),
    expect: own(216.43, 108.5, 105.71),
  },
  {
    photo: '84401.jpg',
    what: 'the long straight of the 216mm trial',
    basis: 'its known 216mm, within TOLERANCE_MM (the trial\'s bound); these photos read about 0.7mm long, not yet explained',
    points: { figures: { long: [[703, 1802], [782, 3756]] } },
    expect: { long: { mm: 216, tolMm: TOLERANCE_MM } },
  },
  {
    photo: '84402.jpg',
    what: 'the long straight of the 216mm trial, second photo',
    basis: 'its known 216mm, within TOLERANCE_MM (the trial\'s bound)',
    points: { figures: { long: [[905, 3675], [908, 1270]] } },
    expect: { long: { mm: 216, tolMm: TOLERANCE_MM } },
  },
];

/** Measures every entry whose photo is in `dir`; prints a line each and the tally. The exit code. */
export function scoreMeasure(dir: string, entries: readonly Entry[] = ENTRIES, load: (path: string) => RgbImage = loadUpright, print: (line: string) => void = console.log): number {
  let pass = 0, ran = 0;
  for (const e of entries) {
    const path = join(dir, e.photo);
    if (!existsSync(path)) continue;
    ran++;
    const points = resolvePoints(e.points, dir, path);
    let line: string, good = false;
    if ('code' in points) line = `points: ${points.code}: ${points.reason}`;
    else {
      try {
        const r = measure(points, load(path));
        if (r.kind === 'refused') line = `refused: ${r.refused.code}: ${r.refused.reason}`;
        else {
          const parts = Object.entries(e.expect).map(([name, want]) => {
            const f = r.figures[name];
            if (!f || 'refused' in f) return { ok: false, text: `${name} ${f ? `refused (${f.refused.code})` : 'missing'}` };
            const off = f.valueMm - want.mm;
            return { ok: Math.abs(off) <= want.tolMm, text: `${name} ${f.valueMm.toFixed(2)} (${off >= 0 ? '+' : ''}${off.toFixed(2)}, within ${want.tolMm})` };
          });
          good = parts.every((p) => p.ok);
          line = parts.map((p) => p.text).join(', ');
        }
      } catch (err) {
        if (!(err instanceof PhotoError)) throw err;
        line = `refused: ${err.code}: ${err.message}`;
      }
    }
    if (good) pass++;
    print(`${good ? 'PASS' : 'FAIL'} ${e.photo} (${e.what}): ${line}`);
  }
  const missing = entries.length - ran;
  print(`${pass}/${ran} pass${missing > 0 ? ` (${missing} photos not in ${dir})` : ''}`);
  return ran > 0 && pass === ran ? 0 : 1;
}

if (import.meta.main) process.exit(scoreMeasure(process.argv[2] ?? 'photos'));
