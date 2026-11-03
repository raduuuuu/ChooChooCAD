/**
 * THE EXACT END OF A PLANK (plan 2026-11-02, E2 revisited): the hand-read end
 * is only a seed. Across the end, on the flat top face beside the peg or
 * socket, the edge is where wood (red well above blue) gives way to paper.
 *
 *   paper coords:  ── groove ── top face ──[peg/socket]── top face ── groove ──
 *   sampled:                    |c| in [SHOULDER_IN, SHOULDER_OUT] mm from the centreline
 *   along the axis, ±SEARCH mm:  wood level ─╲_ paper level → crossing of the halfway value
 *   all crossings ──least squares line──▶ its value on the centreline = the end
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

/** Red minus blue: high on beech, negative on paper and grid ink. Bilinear, NaN outside. */
function woodness(img: RgbImage, [x, y]: Pt): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= img.width || y0 + 1 >= img.height) return NaN;
  const fx = x - x0, fy = y - y0;
  const at = (xx: number, yy: number) => {
    const i = (yy * img.width + xx) * 3;
    return img.rgb[i]! - img.rgb[i + 2]!;
  };
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

export interface RefinedEnd {
  readonly px: Pt;
  /** Edge samples used, and their spread about the fitted line, mm. */
  readonly samples: number;
  readonly spreadMm: number;
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
  const found: [number, number][] = [];
  for (const side of [-1, 1]) {
    for (let c = SHOULDER_IN; c <= SHOULDER_OUT + 1e-9; c += 0.25) {
      const ts: number[] = [], vs: number[] = [];
      for (let t = -SEARCH; t <= SEARCH + 1e-9; t += 0.05) {
        ts.push(t);
        vs.push(woodness(img, at(side * c, t)));
      }
      if (vs.some(Number.isNaN)) continue;
      const wood = median(vs.slice(0, 15)), paper = median(vs.slice(-15));
      if (wood - paper < 30) continue; // no clear wood-to-paper step here
      const half = (wood + paper) / 2;
      // The last crossing from wood to paper going outward.
      for (let i = vs.length - 1; i > 0; i--) {
        if (vs[i - 1]! >= half && vs[i]! < half) {
          const f = (vs[i - 1]! - half) / (vs[i - 1]! - vs[i]!);
          found.push([side * c, ts[i - 1]! + f * (ts[i]! - ts[i - 1]!)]);
          break;
        }
      }
    }
  }
  if (found.length < 8) return null;
  // Least squares t = a + b·c; the end's centre is at c = 0.
  const n = found.length;
  const mc = found.reduce((q, [c]) => q + c, 0) / n, mt = found.reduce((q, [, t]) => q + t, 0) / n;
  const b = found.reduce((q, [c, t]) => q + (c - mc) * (t - mt), 0) / found.reduce((q, [c]) => q + (c - mc) ** 2, 0);
  const a = mt - b * mc;
  const spread = Math.sqrt(found.reduce((q, [c, t]) => q + (t - (a + b * c)) ** 2, 0) / n);
  return { px: at(0, a), samples: n, spreadMm: spread };
}

/** True when a piece's two ends lie either side of the photo's centre row or column, so both face away from the camera. */
export function straddlesCentre(img: Pick<RgbImage, 'width' | 'height'>, a: Pt, b: Pt): boolean {
  const vertical = Math.abs(a[1] - b[1]) >= Math.abs(a[0] - b[0]);
  const mid = vertical ? img.height / 2 : img.width / 2;
  const [p, q] = vertical ? [a[1], b[1]] : [a[0], b[0]];
  return (p - mid) * (q - mid) < 0;
}
