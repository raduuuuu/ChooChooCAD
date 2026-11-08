/**
 * `bun run photos <folder>`: are these photos ready to send, and safe to post?
 * (community-pieces plan, CEO X1 and eng D5; the V3 check found GitHub keeps
 * a photo's location).
 *
 *   each photo ──JPEG?──▶ location in it? report, then strip it in place
 *        │                (Orientation kept; image data untouched)
 *        ▼
 *   pixels ──findGridAuto──▶ the grid ──findPlanks──▶ medium and long straights
 *        │
 *        ▼
 *   per photo: what to reshoot, if anything; the long straight read against
 *   the medium one (the first session's 216mm trial, agreedFigure)
 *
 * Exit: 2 when any photo carried location data (the drawing skill reports it
 * privately: a copy already posted keeps it), else 1 when any photo needs a
 * reshoot or the trial fails, else 0.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agreedFigure, TOLERANCE_MM, TRIAL } from '../data/photoReadings.js';
import { GRID_RESIDUAL_MAX_MM, scaleAndMeasure } from './photo.js';
import { straddlesCentre } from './photoEdges.js';
import { hasLocation, stripMetadata } from './photoExif.js';
import { pixelToPaper, WOOD_GREEN_OVER_BLUE, type FoundGrid } from './photoGrid.js';
import { findGridAuto } from './photoGridSeed.js';
import { loadPhoto, type RgbImage } from './photoImage.js';
import { findWood, namePlanks } from './photoStraights.js';

export interface ImageCheck {
  /** What to reshoot or fix, in plain words; empty when the photo is usable. */
  readonly problems: readonly string[];
  readonly gridPoints?: number;
  readonly gridRmsMm?: number;
  /** The long straight read against the medium one, mm, when both are in the photo. */
  readonly longMm?: number;
}

/**
 * The most the automatic grid's crossings may disagree, rms mm. Stricter than
 * GRID_RESIDUAL_MAX_MM (a dozen hand-read points): hundreds of crossings on one
 * flat sheet measured 0.09 to 0.16 (2026-11-08, nine photos), two sheets side
 * by side 0.41; a measurement across two sheets is out by their misalignment.
 */
export const AUTO_GRID_RMS_MAX_MM = 0.3;

/**
 * The grid read at the scale that makes a plank the 144mm reference: the grid
 * finder can take 5mm lines for 10mm ones (or the reverse) on paper without
 * clear 1mm lines, which halves or doubles every length; the reference's known
 * length decides. Scale 1 first, then 2, then 0.5.
 */
type Found = { grid: FoundGrid; planks: ReturnType<typeof namePlanks>; tooWide: number };
function gridAndPlanks(img: RgbImage): Found | { reason: string } {
  let first: Found | { reason: string } | null = null;
  for (const scale of [1, 2, 0.5]) {
    const found = findGridAuto(img, scale);
    const wood = 'reason' in found ? null : findWood(img, found.grid);
    const attempt = 'reason' in found ? found : { grid: found.grid, planks: namePlanks(wood!.planks), tooWide: wood!.tooWide };
    first ??= attempt;
    if (!('reason' in attempt) && attempt.planks.reference) return attempt;
  }
  return first!;
}

/**
 * True when the paper is as warm as wood: green over blue past wood's bar on
 * the paper. The paper is read as the brightest half of the photo's central
 * half, at its 25th percentile (a bright orange piece can fill the rest).
 * Measured (2026-11-08): white, blue and pink papers 1 or less; cream paper
 * with orange lines 25, where wood and paper can't be told apart.
 */
export function paperTooWarm(img: RgbImage): boolean {
  const px: [number, number][] = [];
  for (let y = img.height >> 2; y < (3 * img.height) >> 2; y += 4) {
    for (let x = img.width >> 2; x < (3 * img.width) >> 2; x += 4) {
      const i = (y * img.width + x) * 3;
      px.push([img.rgb[i]! + img.rgb[i + 1]! + img.rgb[i + 2]!, img.rgb[i + 1]! - img.rgb[i + 2]!]);
    }
  }
  const bright = px.sort((a, b) => a[0] - b[0]).slice(px.length >> 1).map((p) => p[1]).sort((a, b) => a - b);
  return bright.length > 0 && bright[bright.length >> 2]! > WOOD_GREEN_OVER_BLUE;
}

/** One photo's pixels: grid, reference straight, and the long straight when present. */
export function checkImage(img: RgbImage): ImageCheck {
  if (paperTooWarm(img)) return { problems: ['the paper is as warm a colour as the wood (cream or yellow paper, or a warm lamp): use white, blue or pink millimetre paper, in daylight'] };
  const found = gridAndPlanks(img);
  if ('reason' in found) return { problems: [`no usable grid: ${found.reason}`] };
  const { grid } = found;
  const base = { gridPoints: grid.points.length, gridRmsMm: grid.rmsMm };
  if (grid.rmsMm > Math.min(AUTO_GRID_RMS_MAX_MM, GRID_RESIDUAL_MAX_MM)) return { ...base, problems: [`the grid lines disagree by ${grid.rmsMm.toFixed(2)}mm: use one sheet, lying flat`] };
  const { reference, long } = found.planks;
  const problems: string[] = [];
  if (!reference) {
    return { ...base, problems: [found.tooWide > 0
      ? 'two pieces seem to touch, or something lies against the medium straight: keep every piece about 2cm apart'
      : 'no medium straight (144mm) found: lay it flat, top face up, fully on the grid'] };
  }
  for (const [name, plank] of [['medium straight', reference], ['long straight', long]] as const) {
    if (!plank) continue;
    if (!plank.refined[0] || !plank.refined[1]) problems.push(`an end of the ${name} couldn't be read: no shadow across it, nothing touching it, and keep it inside the frame`);
    if (!straddlesCentre(img, plank.ends[0], plank.ends[1])) problems.push(`the ${name} doesn't cross the middle of the photo: one end shows its end face and reads long`);
  }
  if (!long) return { ...base, problems };
  const r = scaleAndMeasure((p) => pixelToPaper(grid.map, p), grid.rmsMm, { reference: reference.ends, figures: { long: long.ends } });
  if (r.kind === 'refused') return { ...base, problems: [...problems, r.reason] };
  return { ...base, problems, longMm: r.figures.long };
}

/** The first session's trial over a folder's long-straight readings: null when none were taken. */
export function trialVerdict(readings: readonly { photo: string; valueMm: number }[]): { pass: boolean; say: string } | null {
  if (readings.length === 0) return null;
  const agreed = agreedFigure(readings.map((r) => ({ partId: 'trial', figure: 'lengthMm', valueMm: r.valueMm, photo: r.photo, on: TRIAL.on })));
  if (agreed === null) return { pass: false, say: `the long straight read ${readings.map((r) => r.valueMm.toFixed(2)).join(', ')}mm: take two photos that agree within 0.5mm` };
  const off = agreed - TRIAL.knownMm;
  return Math.abs(off) <= TOLERANCE_MM
    ? { pass: true, say: `the long straight reads ${agreed.toFixed(2)}mm: the method works with this camera` }
    : { pass: false, say: `the long straight reads ${agreed.toFixed(2)}mm, ${Math.abs(off).toFixed(2)}mm off 216: check the photo guide's rejected-photo list` };
}

const PHOTO = /\.(jpe?g|png|heic|heif|bmp)$/i;

/** Check every photo in a folder, stripping location data from JPEGs in place. Prints a report; returns the exit code. */
export function checkFolder(dir: string, print: (line: string) => void = console.log): number {
  const files = readdirSync(dir).filter((f) => PHOTO.test(f)).sort();
  if (files.length === 0) {
    print(`No photos in ${dir}.`);
    return 1;
  }
  let located = false, reshoot = false;
  const longReadings: { photo: string; valueMm: number }[] = [];
  for (const f of files) {
    const path = join(dir, f);
    const lines: string[] = [];
    if (/\.jpe?g$/i.test(f)) {
      const bytes = new Uint8Array(readFileSync(path));
      if (hasLocation(bytes)) {
        located = true;
        writeFileSync(path, stripMetadata(bytes));
        lines.push('LOCATION: this photo said where it was taken; removed from this copy. A copy already posted still has it.');
      }
    } else if (/\.(heic|heif)$/i.test(f)) {
      reshoot = true;
      lines.push('FORMAT: HEIC photos can\'t have their location removed here. Set the camera to "Most Compatible" (JPEG), or export as JPEG, and check again.');
    }
    let check: ImageCheck;
    try {
      check = checkImage(loadPhoto(path));
    } catch (e) {
      check = { problems: [(e as Error).message] };
    }
    if (check.problems.length > 0) reshoot = true;
    for (const p of check.problems) lines.push(`RESHOOT: ${p}`);
    if (check.longMm !== undefined) {
      longReadings.push({ photo: f, valueMm: check.longMm });
      lines.push(`long straight: ${check.longMm.toFixed(2)}mm`);
    }
    const head = check.problems.length === 0 && !lines.some((l) => l.startsWith('FORMAT')) ? 'OK' : 'NEEDS WORK';
    print(`${f}: ${head}${check.gridPoints !== undefined ? ` (grid ${check.gridPoints} crossings, ${check.gridRmsMm!.toFixed(2)}mm)` : ''}`);
    for (const l of lines) print(`  ${l}`);
  }
  const trial = trialVerdict(longReadings);
  if (trial) {
    print(`TRIAL: ${trial.say}`);
    if (!trial.pass) reshoot = true;
  }
  return located ? 2 : reshoot ? 1 : 0;
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: bun run photos <folder of photos>');
    process.exit(2);
  }
  process.exit(checkFolder(dir));
}
