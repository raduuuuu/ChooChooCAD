/**
 * `bun engine/tools/photoCrop.ts <photo> <x> <y> [half]`: a 4x enlargement of
 * the square around one point of a photo, so the point can be read to a
 * fraction of a pixel (plan 2026-11-02, eng E2). Uses macOS `sips`; no image
 * library.
 *
 *   photo ──sips crop (x0, y0, side)──▶ window ──sips resample x4──▶ crop.png
 *   a point read at (cx, cy) in crop.png sits at (x0 + cx/4, y0 + cy/4) in the photo
 *
 * Photos stay on the owner's machine (SEC1): the crop is written next to the
 * photo, in the ignored photos/ folder, never into the repo.
 */

import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';

export const ZOOM = 4;

/** A crop's file name, so the photo check can leave crops out of a folder of photos. */
export const CROP = /\.crop-\d+-\d+-\d+\.png$/;

/** Where the crop of `photo` through window `w` is written: beside the photo. */
export function cropPath(photo: string, w: Window): string {
  return join(dirname(photo), `${basename(photo).replace(/\.[^.]+$/, '')}.crop-${w.x0}-${w.y0}-${w.side}.png`);
}

export interface Window {
  readonly x0: number;
  readonly y0: number;
  readonly side: number;
}

/** The square around (x, y), kept inside a width x height photo. */
export function windowAround(width: number, height: number, x: number, y: number, half: number): Window {
  const side = Math.min(2 * half, width, height);
  const x0 = Math.round(Math.min(Math.max(x - side / 2, 0), width - side));
  const y0 = Math.round(Math.min(Math.max(y - side / 2, 0), height - side));
  return { x0, y0, side };
}

/** Where a point read in the enlarged crop sits in the original photo. */
export function fromCrop(w: Window, cx: number, cy: number): readonly [number, number] {
  return [w.x0 + cx / ZOOM, w.y0 + cy / ZOOM];
}

export type CropArgs = { readonly photo: string; readonly x: number; readonly y: number; readonly half: number };

/**
 * The command line, or why it is refused. A coordinate must be one plain
 * number: "63 17" passed as one argument (a shell that does not split) is
 * refused here, not cropped at NaN.
 */
export function parseArgs(argv: readonly string[]): CropArgs | { readonly error: string } {
  const [photo, xs, ys, halfs, ...rest] = argv;
  if (!photo || xs === undefined || ys === undefined || rest.length > 0) {
    return { error: 'usage: bun engine/tools/photoCrop.ts <photo> <x> <y> [half=60]' };
  }
  const num = (s: string) => (/^\s*-?\d+(\.\d+)?\s*$/.test(s) ? Number(s) : NaN);
  const x = num(xs), y = num(ys), half = halfs === undefined ? 60 : num(halfs);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: `x and y must each be one number, got "${xs}" and "${ys}"` };
  if (!Number.isFinite(half) || half <= 0) return { error: `half must be a positive number, got "${halfs}"` };
  return { photo, x, y, half };
}

function sipsGet(photo: string, key: string): string {
  const out = execFileSync('sips', ['-g', key, photo], { encoding: 'utf8' });
  const m = out.match(new RegExp(`${key}:\\s*(\\S+)`));
  if (!m) throw new Error(`sips did not report ${key} for ${photo}`);
  return m[1]!;
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  if ('error' in args) {
    console.error(args.error);
    process.exit(2);
  }
  const { photo, x, y, half } = args;
  // A rotated phone photo stores its pixels sideways; crop coordinates would not match what is seen.
  const orientation = sipsGet(photo, 'orientation');
  if (orientation !== '1' && orientation !== '<nil>') {
    console.error(`${photo} has EXIF orientation ${orientation}; save it upright first (e.g. open and re-export), then crop.`);
    process.exit(1);
  }
  const width = Number(sipsGet(photo, 'pixelWidth'));
  const height = Number(sipsGet(photo, 'pixelHeight'));
  const w = windowAround(width, height, x, y, half);
  const out = cropPath(photo, w);
  execFileSync('sips', ['-s', 'format', 'png', '-c', String(w.side), String(w.side), '--cropOffset', String(w.y0), String(w.x0), photo, '--out', out], { stdio: 'ignore' });
  execFileSync('sips', ['-z', String(w.side * ZOOM), String(w.side * ZOOM), out], { stdio: 'ignore' });
  console.log(JSON.stringify({ crop: out, ...w, zoom: ZOOM }));
}
