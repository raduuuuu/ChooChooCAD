/**
 * A PICTURE OF THE POINTS USED (measuring-tools plan 2026-11-09, item 11,
 * CEO E2): the photo shrunk to 1,600 px on its longest side, every grid
 * crossing used as a small dot, the reference's ends as squares, each figure
 * end as a ring in its own colour. No text is drawn; the key (colour, figure,
 * end) is printed with the results and goes into --json, so a bad pick shows
 * as a ring off the end it was meant for.
 *
 *   photo px ──× s (s = 1600 / longest side, never above 1)──▶ overlay px
 *   ring i: COLOURS[i mod 12], the key lists every ring
 *
 * Drawn from the measuring result alone (its `seed` and `at` points), for a
 * refused run too, with whatever it found.
 */

import type { Pt } from './photo.js';
import type { RgbImage } from './photoImage.js';
import type { End, MeasureResult, Points } from './photoMeasure.js';

export const OVERLAY_SIDE = 1600;

/** Twelve colours far from the paper's blue-grey and from beech; past twelve rings they repeat. */
export const COLOURS: readonly (readonly [number, number, number])[] = [
  [230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200], [245, 130, 48], [145, 30, 180],
  [70, 240, 240], [240, 50, 230], [210, 245, 60], [250, 190, 190], [0, 128, 128], [128, 0, 0],
];
const DOT: readonly [number, number, number] = [255, 0, 0];
const SQUARE: readonly [number, number, number] = [0, 0, 0];

export interface KeyRow {
  /** `#rrggbb` */
  readonly colour: string;
  readonly figure: string;
  readonly end: string;
}

const hex = (c: readonly [number, number, number]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** The photo shrunk (nearest neighbour), and the scale used. */
function shrink(img: RgbImage): { out: RgbImage; s: number } {
  const s = Math.min(1, OVERLAY_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * s)), height = Math.max(1, Math.round(img.height * s));
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / s));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / s));
      const from = (sy * img.width + sx) * 3, to = (y * width + x) * 3;
      rgb[to] = img.rgb[from]!;
      rgb[to + 1] = img.rgb[from + 1]!;
      rgb[to + 2] = img.rgb[from + 2]!;
    }
  }
  return { out: { width, height, rgb }, s };
}

/** The overlay and its key. `points` supplies the figures' names and, for a refused run, the points as given. */
export function drawOverlay(img: RgbImage, points: Points, result: MeasureResult): { image: RgbImage; key: KeyRow[] } {
  const { out, s } = shrink(img);
  const put = (x: number, y: number, c: readonly [number, number, number]) => {
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
    out.rgb.set(c, (y * out.width + x) * 3);
  };
  const at = ([x, y]: Pt): Pt => [Math.round(x * s), Math.round(y * s)];
  const dot = (p: Pt) => {
    const [cx, cy] = at(p);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(cx + dx, cy + dy, DOT);
  };
  const square = (p: Pt) => {
    const [cx, cy] = at(p);
    for (let d = -6; d <= 6; d++) for (const t of [-6, -5, 5, 6]) {
      put(cx + d, cy + t, SQUARE);
      put(cx + t, cy + d, SQUARE);
    }
  };
  const ring = (p: Pt, c: readonly [number, number, number]) => {
    const [cx, cy] = at(p);
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
      const r = Math.hypot(dx, dy);
      if (r >= 7.5 && r <= 10.5) put(cx + dx, cy + dy, c);
    }
  };

  const grid = result.grid;
  for (const p of grid?.crossings ?? []) dot(p);
  const refEnds: readonly Pt[] =
    result.kind === 'measured' ? result.reference.ends.map((e) => e.at)
      : result.referenceEnds ? result.referenceEnds.map((e) => e.at)
        : points.reference ?? [];
  for (const p of refEnds) square(p);

  const key: KeyRow[] = [];
  const labels = (kind: string) => (kind === 'distance' ? ['first end', 'second end'] : ['line a', 'line b', 'point']);
  for (const [name, f] of Object.entries(points.figures)) {
    const done = result.kind === 'measured' ? result.figures[name] : undefined;
    const ends: readonly Pt[] = done
      ? done.ends.map((e: End) => e.at)
      : f.kind === 'distance' ? f.ends : [f.line[0], f.line[1], f.point];
    ends.forEach((p, i) => {
      const c = COLOURS[key.length % COLOURS.length]!;
      ring(p, c);
      key.push({ colour: hex(c), figure: name, end: labels(f.kind)[i]! });
    });
  }
  return { image: out, key };
}
