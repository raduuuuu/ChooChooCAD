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
 * The bridge's four (2026-11-10) are the warm-lamp ones: with measure() reading
 * the photo unbalanced, all four fail (no grid found) and the first four pass.
 *
 * Since 2026-11-10 the camera sets the scale (photo.ts, chooseScale), not the
 * owner's medium straight taken as 144 (it is 143.6). The four repeatability
 * entries were re-read then: the old figures (photoReadings.ts, the chat's)
 * were on the medium straight's scale, about 0.15% to 0.3% long. Two entries
 * read the medium straight itself against the owner's ruler, 143.6; with the
 * medium straight taken as 144 again, both fail (144.02 and 144.04).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AGREE_MM, TOLERANCE_MM } from '../data/photoReadings.js';
import { cameraOf, loadUpright, PhotoError, type RgbImage } from './photoImage.js';
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
/** The owner's medium straight by ruler (2026-11-10), and how close the camera's scale must read it: the two sheets read 143.58 and 143.88, the sheets printed about 0.2% apart. */
const MEDIUM_MM = 143.6, MEDIUM_TOL_MM = 0.35;

const own = (through: number, along: number, out: number) => ({
  through: { mm: through, tolMm: AGREE_MM },
  along: { mm: along, tolMm: AGREE_MM },
  out: { mm: out, tolMm: AGREE_MM },
});

export const ENTRIES: readonly Entry[] = [
  {
    photo: '84405.jpg',
    what: 'T switch, through road vertical, curved end to the left',
    basis: "84405 re-read with the camera's scale (2026-11-10; recorded 216.49, 108.49, 105.34 on the medium straight's, photoReadings.ts), within AGREE_MM: repeatability",
    points: tSwitch([2334, 530], [2327, 3538], [857.5, 2056], [1135, 2056]),
    expect: own(216.24, 107.88, 105.11),
  },
  {
    photo: '84404.jpg',
    what: 'T switch mirrored; its curved end touches the medium straight',
    basis: "84404 re-read with the camera's scale (2026-11-10; recorded 216.43, 108.5, 105.71), within AGREE_MM; the reference given, since photos:score expects the automatic one refused (two pieces touch)",
    points: tSwitch([899, 3570], [887, 923], [2195, 2240], [1951, 2240], [[2478, 1568], [2487, 3320]]),
    expect: own(216.33, 108.4, 105.73),
  },
  {
    photo: '84401.jpg',
    what: 'the long straight of the 216mm trial',
    basis: 'its known 216mm, within TOLERANCE_MM (the trial\'s bound); with the medium straight as the scale these photos read about 0.7mm long: the owner\'s medium straight is 143.6mm',
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
  {
    photo: '84402.jpg',
    what: 'the medium straight itself, blue paper',
    basis: "the owner's ruler, 143.6mm, within 0.35mm: the camera's scale (the medium straight taken as 144 reads 144.02)",
    points: { figures: { medium: [[1973, 1575], [1983, 3154]] } },
    expect: { medium: { mm: MEDIUM_MM, tolMm: MEDIUM_TOL_MM } },
  },
  {
    photo: '85844.jpg',
    what: 'the medium straight itself, white paper under the warm lamp',
    basis: "the owner's ruler, 143.6mm, within 0.35mm, on the other sheet (taken as 144 it reads 144.04)",
    points: { figures: { medium: [[2176, 1306], [2151, 3096]] } },
    expect: { medium: { mm: MEDIUM_MM, tolMm: MEDIUM_TOL_MM } },
  },
  {
    photo: '85841 (1).jpg',
    what: 'the double-arch bridge (issue #231) under a warm lamp, its length',
    basis: "re-read with the camera's scale (2026-11-10); the contributor's chat read 240.01 off this photo shrunk to 1,932 × 2,576 on the medium straight's (the picks here are its picks, scaled by 3072/1932), within AGREE_MM: repeatability at full size",
    points: { figures: { length: [[1008, 869], [1054, 3714]] } },
    expect: { length: { mm: 239.82, tolMm: AGREE_MM } },
  },
  {
    photo: '85846.jpg',
    what: 'the double-arch bridge, second top view',
    basis: "re-read with the camera's scale (2026-11-10; the chat's 240.22 on the medium straight's), its picks scaled the same way, within AGREE_MM",
    points: { figures: { length: [[2003, 516], [1958, 3514]] } },
    expect: { length: { mm: 240.03, tolMm: AGREE_MM } },
  },
  {
    photo: '85844.jpg',
    what: 'the long straight of the bridge\'s 216mm trial, the paper 19 green over blue (balanced before reading)',
    basis: "its known 216mm, within TOLERANCE_MM; the ends are the photo check's own",
    points: { figures: { long: [[1060, 3591], [1078, 898]] } },
    expect: { long: { mm: 216, tolMm: TOLERANCE_MM } },
  },
  {
    photo: '85845.jpg',
    what: 'the long straight of the bridge\'s 216mm trial, second photo',
    basis: 'its known 216mm, within TOLERANCE_MM',
    points: { figures: { long: [[1095, 931], [1155, 3556]] } },
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
        const r = measure(points, load(path), cameraOf(path));
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
