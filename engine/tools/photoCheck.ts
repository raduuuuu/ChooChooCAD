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
 *
 * `--location-only`: the first step alone, for every photo that isn't a top
 * view (the underside, a side or end photo when one was asked for). Those show
 * shape and markings, not sizes, so no grid or reference is looked for; the
 * drawing skill runs it on everything downloaded before anyone looks.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agreedFigure, TOLERANCE_MM, TRIAL } from '../data/photoReadings.js';
import { GRID_RESIDUAL_MAX_MM, scaleAndMeasure } from './photo.js';
import { CROP, OVERLAY } from './photoCrop.js';
import { straddlesCentre } from './photoEdges.js';
import { hasLocation, stripMetadata } from './photoExif.js';
import { pixelToPaper, WOOD_GREEN_OVER_BLUE } from './photoGrid.js';
import { loadPhoto, type RgbImage } from './photoImage.js';
import { AUTO_GRID_RMS_MAX_MM, BALANCE_ABOVE, balanced, gridAndPlanks, paperWarmth } from './photoStraights.js';

export interface ImageCheck {
  /** What to reshoot or fix, in plain words; empty when the photo is usable. */
  readonly problems: readonly string[];
  readonly gridPoints?: number;
  readonly gridRmsMm?: number;
  /** The long straight read against the medium one, mm, when both are in the photo. */
  readonly longMm?: number;
}

const WARM = 'the paper is as warm a colour as the wood, and they can\'t be told apart (cream or yellow paper, or a very warm lamp): use white, blue or pink millimetre paper, in daylight';

/** One photo's pixels: grid, reference straight, and the long straight when present. */
export function checkImage(photo: RgbImage): ImageCheck {
  // A warm paper (a warm lamp) is read balanced on itself; one as warm as wood is named only when that still fails.
  const warmth = paperWarmth(photo), warm = warmth > WOOD_GREEN_OVER_BLUE, img = warmth > BALANCE_ABOVE ? balanced(photo) : photo;
  const found = gridAndPlanks(img);
  if (warm && ('reason' in found || !found.planks.reference)) return { problems: [WARM] };
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

/**
 * Check every photo in a folder, stripping location data from JPEGs in place.
 * With `locationOnly`, nothing else: no pixels read, no trial. Prints a
 * report; returns the exit code.
 */
export function checkFolder(dir: string, print: (line: string) => void = console.log, { locationOnly = false } = {}): number {
  // A crop (photoCrop.ts) or an overlay (photoMeasure --overlay) left beside a photo is not a photo.
  const files = readdirSync(dir).filter((f) => PHOTO.test(f) && !CROP.test(f) && !OVERLAY.test(f)).sort();
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
    if (locationOnly) {
      const head = lines.some((l) => l.startsWith('FORMAT')) ? 'NEEDS WORK' : 'OK';
      print(`${f}: ${head}`);
      for (const l of lines) print(`  ${l}`);
      continue;
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
  const args = process.argv.slice(2);
  const locationOnly = args.includes('--location-only');
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: bun run photos [--location-only] <folder of photos>');
    process.exit(2);
  }
  process.exit(checkFolder(dir, console.log, { locationOnly }));
}
