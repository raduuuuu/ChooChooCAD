/**
 * `bun engine/tools/photoCrop.ts <photo> <x> <y> [half]`: a 4x enlargement of
 * the square around one point of a photo, so the point can be read to a
 * fraction of a pixel (plan 2026-11-02, eng E2). Runs anywhere a photo can be
 * read (measuring-tools plan 2026-11-09, item 1): no `sips`, no image library.
 *
 *   photo ──loadUpright──▶ pixels as a phone shows them ──window (x0, y0, side)──▶
 *         ──x4 nearest neighbour──▶ writePng ──▶ crop.png
 *   a point read at (cx, cy) in crop.png sits at (x0 + cx/4, y0 + cy/4) in the photo
 *
 * Nearest neighbour keeps each photo pixel a 4x4 square, so the eye can split
 * it. A rotated phone photo is turned upright first, so the crop shows what
 * the phone shows and its coordinates are upright ones.
 *
 * Photos stay on the owner's machine (SEC1): the crop is written next to the
 * photo, in the ignored photos/ folder, never into the repo.
 */

import { writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { loadUpright, PhotoError, writePng, type RgbImage } from './photoImage.js';

export const ZOOM = 4;

/** A crop's file name, so the photo check can leave crops out of a folder of photos. */
export const CROP = /\.crop-\d+-\d+-\d+\.png$/;

/** An overlay's file name (photoMeasure --overlay), left out of a folder of photos too. */
export const OVERLAY = /\.overlay\.png$/;

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

/** The window's pixels, each one a zoom x zoom square. */
export function enlarge(img: RgbImage, w: Window, zoom = ZOOM): RgbImage {
  const side = w.side * zoom;
  const rgb = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const s = ((w.y0 + Math.floor(y / zoom)) * img.width + w.x0 + Math.floor(x / zoom)) * 3, d = (y * side + x) * 3;
      rgb[d] = img.rgb[s]!;
      rgb[d + 1] = img.rgb[s + 1]!;
      rgb[d + 2] = img.rgb[s + 2]!;
    }
  }
  return { width: side, height: side, rgb };
}

/** Where a point read in the enlarged crop sits in the original photo. */
export function fromCrop(w: Window, cx: number, cy: number): readonly [number, number] {
  return [w.x0 + cx / ZOOM, w.y0 + cy / ZOOM];
}

export type CropArgs = { readonly photo: string; readonly x: number; readonly y: number; readonly half: number };

export const HELP = `usage: bun engine/tools/photoCrop.ts <photo> <x> <y> [half=60]

A 4x enlargement of the square round (x, y), written beside the photo as
<photo>.crop-x0-y0-side.png, so a point can be read to a quarter pixel. x and
y are the photo's full pixels as a phone shows it (a portrait photo is turned
upright first). half is the square's half side, a whole number of pixels: 60
for a corner or a peg; about 200 to see a 40mm road's full width. stdout is one
JSON line { crop, x0, y0, side, zoom, width, height }; stderr says how a crop
point maps back. In a points file give a crop point as
{ "crop": "<crop file>", "at": [cx, cy] } and photoMeasure maps it back.

exit: 0 written · 1 the photo refused · 2 bad usage
codes: ${(['photo-missing', 'no-converter', 'photo-unreadable', 'heic', 'orientation', 'usage'] as const).join(', ')}
(each with its fix: bun engine/tools/photoMeasure.ts --help, or the drawing skill's "Measure codes")`;

/**
 * The command line, or why it is refused. A coordinate must be one plain
 * number: "63 17" passed as one argument (a shell that does not split) is
 * refused here, not cropped at NaN.
 */
export function parseArgs(argv: readonly string[]): CropArgs | { readonly error: string } | { readonly help: true } {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const [photo, xs, ys, halfs, ...rest] = argv;
  if (!photo || xs === undefined || ys === undefined || rest.length > 0) {
    return { error: 'usage: bun engine/tools/photoCrop.ts <photo> <x> <y> [half=60]' };
  }
  const num = (s: string) => (/^\s*-?\d+(\.\d+)?\s*$/.test(s) ? Number(s) : NaN);
  const x = num(xs), y = num(ys), half = halfs === undefined ? 60 : num(halfs);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: `x and y must each be one number, got "${xs}" and "${ys}"` };
  // A whole half keeps the window whole pixels, so its name matches CROP (eng G8).
  if (!Number.isInteger(half) || half <= 0) return { error: `half must be a whole positive number of pixels, got "${halfs}"` };
  return { photo, x, y, half };
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  if ('help' in args) {
    console.log(HELP);
    process.exit(0);
  }
  if ('error' in args) {
    console.error(`USAGE usage: ${args.error}\nrun with --help for the usage`);
    process.exit(2);
  }
  const { photo, x, y, half } = args;
  let img: RgbImage;
  try {
    img = loadUpright(photo);
  } catch (e) {
    if (!(e instanceof PhotoError)) throw e;
    console.error(`REFUSED ${e.code}: ${e.message}\n${e.fix}`);
    process.exit(1);
  }
  const w = windowAround(img.width, img.height, x, y, half);
  const out = cropPath(photo, w);
  writeFileSync(out, writePng(enlarge(img, w)));
  console.log(JSON.stringify({ crop: out, ...w, zoom: ZOOM, width: img.width, height: img.height }));
  console.error(`a point at (cx, cy) in this crop is (${w.x0} + cx/${ZOOM}, ${w.y0} + cy/${ZOOM}) in the photo, which is ${img.width}x${img.height} upright`);
}
