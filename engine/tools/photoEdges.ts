/**
 * THE EXACT END OF A PLANK (plan 2026-11-02, E2 revisited): the hand-read end
 * is only a seed. Across the end, on the flat top face beside the peg or
 * socket, the edge is where wood (green well above blue) gives way to paper.
 *
 *   paper coords:  ── groove ── top face ──[peg/socket]── top face ── groove ──
 *   sampled:                    |c| in [SHOULDER_IN, SHOULDER_OUT] mm from the centreline
 *   along the axis, ±SEARCH mm:  wood level ─╲_ paper level → crossing of the halfway value
 *   all crossings ──least squares line──▶ its value on the centreline = the end
 *
 * A grey plastic piece is as colourless as the paper, so where wood finds too
 * few samples the step is looked for in darkness instead (the #204 dry run).
 *
 * Only ends that face away from the camera show their top-face edge as the
 * outline; an end facing the camera shows a sliver of its end face. The
 * caller keeps every piece across the middle of the photo (straddlesCentre).
 */

import type { Pt } from './photo.js';
import { paperToPixel, pixelToPaper, type PaperMap } from './photoGrid.js';
import type { RgbImage } from './photoImage.js';

/** The flat top face either side of the peg neck or socket mouth, mm from the plank's centreline. */
export const SHOULDER_IN = 6.5, SHOULDER_OUT = 9.5;
/** How far along the axis to look for the edge, mm either side of the seed. */
export const SEARCH = 3;
/**
 * The least woodness step from top face to what lies past the end for a line
 * to count. Measured (2026-11-08): beech onto blue paper about 50, onto pink
 * paper 33, onto the plank's own shadow on pink paper 22 (top face 52, shadow 30).
 */
const MIN_STEP = 15;
/**
 * The same for darkness, onto grey plastic. On the synthetic photo grey reads
 * 130 and paper 41; grid ink, being coloured, keeps a bright channel and reads
 * little darker than its paper.
 */
const MIN_DARK_STEP = 40;
/**
 * Grey plastic's edge can follow the seed (its shadow is as grey as it is): on
 * the #204 station one end moved 0.5 to 2.4mm as the seed moved 9px. So it is
 * read from seeds this far apart along the axis, mm; readings spread past
 * STEADY_SPREAD are dropped, and at least STEADY_MIN left must agree within
 * STEADY_AGREE, or the end is not found and the hand reading stays.
 */
const STEADY_SEEDS = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], STEADY_SPREAD = 0.5, STEADY_MIN = 3, STEADY_AGREE = 0.3;

/**
 * The red–green average minus blue: high on beech (70 on the synthetic one,
 * about 38 on real beech), near zero on paper and grid ink of either colour
 * (blue paper -13, pink paper +5, brown-red ink +10). A larger step than green
 * minus blue alone, so the edge lands as sharply as red minus blue did on blue
 * paper. Bilinear, NaN outside.
 */
function woodness(img: RgbImage, [x, y]: Pt): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= img.width || y0 + 1 >= img.height) return NaN;
  const fx = x - x0, fy = y - y0;
  const at = (xx: number, yy: number) => {
    const i = (yy * img.width + xx) * 3;
    return (img.rgb[i]! + img.rgb[i + 1]!) / 2 - img.rgb[i + 2]!;
  };
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}

/**
 * 255 less the brightest channel: high on grey plastic, low on paper of any
 * colour and on its coloured grid lines (one channel of red or blue ink stays
 * bright), so a grid line past the end doesn't read as the edge. Bilinear, NaN
 * outside.
 */
function darkness(img: RgbImage, [x, y]: Pt): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= img.width || y0 + 1 >= img.height) return NaN;
  const fx = x - x0, fy = y - y0;
  const at = (xx: number, yy: number) => {
    const i = (yy * img.width + xx) * 3;
    return 255 - Math.max(img.rgb[i]!, img.rgb[i + 1]!, img.rgb[i + 2]!);
  };
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

export interface RefinedEnd {
  readonly px: Pt;
  /** Edge samples used, and their spread about the fitted line, mm. */
  readonly samples: number;
  readonly spreadMm: number;
  /**
   * How far the end face turns from square to the seed-to-other axis: the
   * fitted line's slope (mm along the axis per mm across). A square end on a
   * correctly aimed axis reads 0; a switch's side end reads its angle error.
   */
  readonly slope: number;
}

/**
 * The centre of the end at `seed` (photo pixels), the plank running towards
 * `other` (its far end). Null when too few clean edge samples are found.
 */
export function refineEnd(img: RgbImage, map: PaperMap, seed: Pt, other: Pt): RefinedEnd | null {
  const s = pixelToPaper(map, seed), o = pixelToPaper(map, other);
  const len = Math.hypot(s[0] - o[0], s[1] - o[1]);
  const axis: Pt = [(s[0] - o[0]) / len, (s[1] - o[1]) / len]; // outward, along the plank
  const across: Pt = [-axis[1], axis[0]];
  const at = (c: number, t: number): Pt => paperToPixel(map, [s[0] + across[0] * c + axis[0] * t, s[1] + across[1] * c + axis[1] * t]);
  // Edge samples: where `level` steps down by at least `minStep` from the piece to the paper, searched round `from` mm along the axis.
  const edges = (level: (img: RgbImage, p: Pt) => number, minStep: number, from = 0): [number, number][] => {
    const found: [number, number][] = [];
    for (const side of [-1, 1]) {
      for (let c = SHOULDER_IN; c <= SHOULDER_OUT + 1e-9; c += 0.25) {
        const ts: number[] = [], vs: number[] = [];
        for (let t = from - SEARCH; t <= from + SEARCH + 1e-9; t += 0.05) {
          ts.push(t);
          vs.push(level(img, at(side * c, t)));
        }
        if (vs.some(Number.isNaN)) continue;
        const piece = median(vs.slice(0, 15)), paper = median(vs.slice(-15));
        if (piece - paper < minStep) continue; // no clear piece-to-paper step here
        const half = (piece + paper) / 2;
        // The last crossing from piece to paper going outward.
        for (let i = vs.length - 1; i > 0; i--) {
          if (vs[i - 1]! >= half && vs[i]! < half) {
            const f = (vs[i - 1]! - half) / (vs[i - 1]! - vs[i]!);
            found.push([side * c, ts[i - 1]! + f * (ts[i]! - ts[i - 1]!)]);
            break;
          }
        }
      }
    }
    return found;
  };
  const wood = fit(edges(woodness, MIN_STEP));
  if (wood) return { px: at(0, wood.a), samples: wood.n, spreadMm: wood.spread, slope: wood.b };
  const steady = STEADY_SEEDS.map((from) => fit(edges(darkness, MIN_DARK_STEP, from))).filter((f) => f !== null && f.spread <= STEADY_SPREAD) as Fit[];
  if (steady.length < STEADY_MIN) return null;
  const ends = steady.map((f) => f.a).sort((x, y) => x - y);
  if (ends.at(-1)! - ends[0]! > STEADY_AGREE) return null;
  const mid = steady.find((f) => f.a === ends[Math.floor(ends.length / 2)])!;
  return { px: at(0, mid.a), samples: mid.n, spreadMm: mid.spread, slope: mid.b };
}

interface Fit { readonly a: number; readonly b: number; readonly n: number; readonly spread: number }

/** Least squares t = a + b·c through the edge samples (the end's centre is at c = 0), or null under eight samples. */
function fit(found: readonly [number, number][]): Fit | null {
  if (found.length < 8) return null;
  const n = found.length;
  const mc = found.reduce((q, [c]) => q + c, 0) / n, mt = found.reduce((q, [, t]) => q + t, 0) / n;
  const b = found.reduce((q, [c, t]) => q + (c - mc) * (t - mt), 0) / found.reduce((q, [c]) => q + (c - mc) ** 2, 0);
  const a = mt - b * mc;
  const spread = Math.sqrt(found.reduce((q, [c, t]) => q + (t - (a + b * c)) ** 2, 0) / n);
  return { a, b, n, spread };
}

/** True when a piece's two ends lie either side of the photo's centre row or column, so both face away from the camera. */
export function straddlesCentre(img: Pick<RgbImage, 'width' | 'height'>, a: Pt, b: Pt): boolean {
  const vertical = Math.abs(a[1] - b[1]) >= Math.abs(a[0] - b[0]);
  const mid = vertical ? img.height / 2 : img.width / 2;
  const [p, q] = vertical ? [a[1], b[1]] : [a[0], b[0]];
  return (p - mid) * (q - mid) < 0;
}
