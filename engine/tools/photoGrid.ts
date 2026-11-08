/**
 * FINDING THE GRID BY ITSELF (plan 2026-11-02, E2 revisited after the 216mm
 * trial: six hand-read points left about ±1mm in a 216mm figure).
 *
 *   six hand points ──fit──▶ first map (perspective only)
 *        │
 *        ▼  predict every 10mm crossing, then for each one:
 *   lineness = darkness in the darkest channel (any ink: blue ink absorbs red,
 *              red or brown ink green and blue; paper reflects all three)
 *   wood = green well above blue (beech is yellow-orange; paper and ink of
 *          either colour are not); a crossing near wood is skipped
 *   strongest line within ±WINDOW px across each direction, sub-pixel
 *        │
 *        ▼  fit perspective + lens bowing (k1), drop outliers, predict again
 *   PASSES rounds ──▶ hundreds of crossings and a map from photo to paper
 *
 * Lens bowing is one radial term about the photo's centre:
 *   undistorted = c + (p − c) · (1 + k1 · |p − c|² / n²),  n = half the diagonal
 * The perspective is then a homography from undistorted pixels to paper mm.
 */

import { homography, toPaper, type GridPoint, type Homography, type Pt } from './photo.js';
import type { RgbImage } from './photoImage.js';

export interface PaperMap {
  readonly h: Homography;
  readonly k1: number;
  readonly centre: Pt;
  readonly norm: number;
}

export const undistort = (m: Pick<PaperMap, 'k1' | 'centre' | 'norm'>, [x, y]: Pt): Pt => {
  const dx = x - m.centre[0], dy = y - m.centre[1];
  const f = 1 + (m.k1 * (dx * dx + dy * dy)) / (m.norm * m.norm);
  return [m.centre[0] + dx * f, m.centre[1] + dy * f];
};

/** A photo pixel on the paper, in millimetres. */
export const pixelToPaper = (m: PaperMap, p: Pt): Pt => toPaper(m.h, undistort(m, p));

function invert3(h: Homography): Homography {
  const [a, b, c, d, e, f, g, i, j] = h as [number, number, number, number, number, number, number, number, number];
  const A = e * j - f * i, B = -(d * j - f * g), C = d * i - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * j - c * i) / det, (b * f - c * e) / det, B / det, (a * j - c * g) / det, -(a * f - c * d) / det, C / det, -(a * i - b * g) / det, (a * e - b * d) / det];
}

/** Where a paper point appears in the photo (inverse of pixelToPaper). */
export function paperToPixel(m: PaperMap, mm: Pt): Pt {
  const u = toPaper(invert3(m.h), mm); // undistorted pixel
  let p: Pt = u;
  for (let n = 0; n < 8; n++) {
    const dx = p[0] - m.centre[0], dy = p[1] - m.centre[1];
    const f = 1 + (m.k1 * (dx * dx + dy * dy)) / (m.norm * m.norm);
    p = [m.centre[0] + (u[0] - m.centre[0]) / f, m.centre[1] + (u[1] - m.centre[1]) / f];
  }
  return p;
}

const dist = ([ax, ay]: Pt, [bx, by]: Pt) => Math.hypot(bx - ax, by - ay);

function fitWithK1(points: readonly GridPoint[], centre: Pt, norm: number, k1: number): { map: PaperMap; rms: number } {
  const und = points.map((p) => ({ px: undistort({ k1, centre, norm }, p.px), mm: p.mm }));
  const h = homography(und);
  const map = { h, k1, centre, norm };
  const sq = points.reduce((s, p) => s + dist(pixelToPaper(map, p.px), p.mm) ** 2, 0);
  return { map, rms: Math.sqrt(sq / points.length) };
}

/** The best map for these points: lens bowing searched over K1_RANGE when there are enough points to carry it. */
export const K1_RANGE = 0.15;
export const MIN_POINTS_FOR_BOWING = 20;

export function fitMap(points: readonly GridPoint[], size: { width: number; height: number }): { map: PaperMap; rms: number } {
  const centre: Pt = [size.width / 2, size.height / 2];
  const norm = Math.hypot(size.width, size.height) / 2;
  if (points.length < MIN_POINTS_FOR_BOWING) return fitWithK1(points, centre, norm, 0);
  // Golden-section search on k1: the residual is smooth and single-dipped over this range.
  let lo = -K1_RANGE, hi = K1_RANGE;
  const g = (Math.sqrt(5) - 1) / 2;
  let a = hi - g * (hi - lo), b = lo + g * (hi - lo);
  let fa = fitWithK1(points, centre, norm, a).rms, fb = fitWithK1(points, centre, norm, b).rms;
  for (let n = 0; n < 60; n++) {
    if (fa < fb) { hi = b; b = a; fb = fa; a = hi - g * (hi - lo); fa = fitWithK1(points, centre, norm, a).rms; }
    else { lo = a; a = b; fa = fb; b = lo + g * (hi - lo); fb = fitWithK1(points, centre, norm, b).rms; }
  }
  return fitWithK1(points, centre, norm, (lo + hi) / 2);
}

/**
 * Darkness at a sub-pixel position, bilinear: 255 less the darkest channel, so
 * any ink colour reads (measured: blue paper 196 and its 10mm line 163, both in
 * red; pink paper 184 and its brown-red line 108, both in blue). NaN outside
 * the photo or on wood.
 */
function lineness(img: RgbImage, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= img.width || y0 + 1 >= img.height) return NaN;
  const fx = x - x0, fy = y - y0;
  let wood = false;
  const at = (xx: number, yy: number) => {
    const i = (yy * img.width + xx) * 3;
    const [r, g, b] = [img.rgb[i]!, img.rgb[i + 1]!, img.rgb[i + 2]!];
    if (g - b > WOOD_GREEN_OVER_BLUE) wood = true;
    return 255 - Math.min(r, g, b);
  };
  const v = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  return wood ? NaN : v;
}

/** How far a crossing may be from its prediction, px. Well under half of 5mm at any phone distance this guide allows. */
export const WINDOW = 12;
/** How far along each line to average, px, skipping the crossing itself. */
const ARM = 30, GAP = 5;
/** A line must stand this far above its surroundings, in darkness units (a 10mm line measured 33). */
const MIN_CONTRAST = 10;
/**
 * Green this far above blue is wood, and the crossing is skipped. Measured
 * (2026-11-08): beech 22 to 30 on both papers; blue paper -2, pink paper +1,
 * brown-red ink +3, grey track plastic -3 to +5.
 */
export const WOOD_GREEN_OVER_BLUE = 14;

/**
 * The exact crossing near `guess`: the strongest line across `along` and the
 * strongest across `across` (unit directions of the grid's rows and columns
 * there), each to a fraction of a pixel. Null when wood or a shadow covers it,
 * or no line stands out.
 */
export function refineCrossing(img: RgbImage, guess: Pt, rowDir: Pt, colDir: Pt): Pt | null {
  const offsetTo = (lineDir: Pt, normal: Pt): number | null => {
    const profile: number[] = [];
    for (let s = -WINDOW; s <= WINDOW; s++) {
      let sum = 0, n = 0;
      for (let t = -ARM; t <= ARM; t++) {
        if (Math.abs(t) < GAP) continue;
        const v = lineness(img, guess[0] + normal[0] * s + lineDir[0] * t, guess[1] + normal[1] * s + lineDir[1] * t);
        if (Number.isNaN(v)) return null;
        sum += v;
        n++;
      }
      profile.push(sum / n);
    }
    let best = 1;
    for (let i = 1; i < profile.length - 1; i++) if (profile[i]! > profile[best]!) best = i;
    const sorted = [...profile].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (best === 0 || best === profile.length - 1 || profile[best]! - median < MIN_CONTRAST) return null;
    const [l, c, r] = [profile[best - 1]!, profile[best]!, profile[best + 1]!];
    const denom = l - 2 * c + r;
    return best - WINDOW + (denom === 0 ? 0 : (0.5 * (l - r)) / denom);
  };
  const normalOf = ([dx, dy]: Pt): Pt => [-dy, dx];
  const sRow = offsetTo(rowDir, normalOf(rowDir)); // shift across the row line
  const sCol = offsetTo(colDir, normalOf(colDir)); // shift across the column line
  if (sRow === null || sCol === null) return null;
  // Solve guess + a·rowDir + b·colDir lying on both shifted lines (they are not quite square in the photo).
  const nr = normalOf(rowDir), nc = normalOf(colDir);
  // Point p satisfies (p − guess)·nr = sRow and (p − guess)·nc = sCol.
  const det = nr[0] * nc[1] - nr[1] * nc[0];
  if (Math.abs(det) < 1e-9) return null;
  const dx = (sRow * nc[1] - sCol * nr[1]) / det;
  const dy = (nr[0] * sCol - nc[0] * sRow) / det;
  return [guess[0] + dx, guess[1] + dy];
}

const unit = ([x, y]: Pt): Pt => {
  const l = Math.hypot(x, y);
  return [x / l, y / l];
};

export interface GridSpec {
  /** Paper millimetres of every 10mm column and row line to look for. */
  readonly cols: readonly number[];
  readonly rows: readonly number[];
}

export interface FoundGrid {
  readonly map: PaperMap;
  readonly points: readonly GridPoint[];
  readonly rmsMm: number;
  readonly maxMm: number;
  readonly tried: number;
}

export const PASSES = 3;

/** Every grid crossing that can be found, starting from a few hand-read seed points. */
export function findGrid(img: RgbImage, seeds: readonly GridPoint[], spec: GridSpec): FoundGrid {
  let map = fitMap(seeds, img).map;
  let points: GridPoint[] = [];
  let tried = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    const found: GridPoint[] = [];
    tried = 0;
    for (const u of spec.cols) {
      for (const v of spec.rows) {
        tried++;
        const p = paperToPixel(map, [u, v]);
        const rowDir = unit([paperToPixel(map, [u + 1, v])[0] - p[0], paperToPixel(map, [u + 1, v])[1] - p[1]]);
        const colDir = unit([paperToPixel(map, [u, v + 1])[0] - p[0], paperToPixel(map, [u, v + 1])[1] - p[1]]);
        const exact = refineCrossing(img, p, rowDir, colDir);
        if (exact) found.push({ px: exact, mm: [u, v] });
      }
    }
    if (found.length < 8) throw new Error(`only ${found.length} grid crossings found; is the grid in the photo?`);
    // Fit, then drop crossings far off the fit (a misread line), and fit again.
    let kept = found;
    for (let round = 0; round < 3; round++) {
      const { map: m } = fitMap(kept, img);
      const res = kept.map((p) => dist(pixelToPaper(m, p.px), p.mm));
      const sorted = [...res].sort((a, b) => a - b);
      const limit = Math.max(3 * sorted[Math.floor(sorted.length / 2)]!, 0.1);
      const next = kept.filter((_, i) => res[i]! <= limit);
      map = m;
      if (next.length === kept.length) break;
      kept = next;
    }
    map = fitMap(kept, img).map;
    points = kept;
  }
  const res = points.map((p) => dist(pixelToPaper(map, p.px), p.mm));
  const rmsMm = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length);
  return { map, points, rmsMm, maxMm: Math.max(...res), tried };
}
