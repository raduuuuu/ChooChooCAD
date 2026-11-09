/**
 * SYNTHETIC PHOTOS OF STRAIGHTS ON GRID PAPER, for the photo tools' tests
 * (photoCheck.test.ts, photoMeasure.test.ts): drawn through a known
 * perspective and lens bowing, in the colours measured on the trial photo.
 * Test support only; no tool imports it.
 */

import type { Homography } from './photo.js';
import { pixelToPaper, type PaperMap } from './photoGrid.js';
import type { RgbImage } from './photoImage.js';

export const W = 1200, H = 1600, S = 5; // 5px per mm
/** Paper is 0..180 by 0..260mm; the medium straight at u 40..80, v 60..204; the long at u 100..140, v 30..246. */
export const MEDIUM = { u0: 40, u1: 80, v0: 60, v1: 204 }, LONG = { u0: 100, u1: 140, v0: 30, v1: 246 };

/** The paper's middle at the photo's middle, turned `deg`, with a little perspective and bowing. */
export function mapFor(deg: number): PaperMap {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  const [uc, vc] = [90, 138];
  const toPixel: Homography = [S * c, -S * s, W / 2 - S * (c * uc - s * vc), S * s, S * c, H / 2 - S * (s * uc + c * vc), 0.00003, 0.00002, 1];
  const [a, b, cc, d, e, f, g, i, j] = toPixel as [number, number, number, number, number, number, number, number, number];
  const A = e * j - f * i, B = -(d * j - f * g), C = d * i - e * g, det = a * A + b * B + cc * C;
  const m = [A / det, -(b * j - cc * i) / det, (b * f - cc * e) / det, B / det, (a * j - cc * g) / det, -(a * f - cc * d) / det, C / det, -(a * i - b * g) / det, (a * e - b * d) / det];
  return { h: m.map((x) => x / m[8]!), k1: -0.02, centre: [W / 2, H / 2], norm: Math.hypot(W, H) / 2 };
}

/**
 * A photo of the two straights on grid paper. `paper`: 'plain' has 10mm lines
 * darker than 5mm ones; 'mm' adds faint 1mm lines and prints 5mm lines as dark
 * as 10mm ones (the owner's real paper); 'flat' prints 5mm as dark as 10mm with
 * no 1mm lines (only the reference's length can settle the scale); 'cream'
 * is the plain grid on a yellow-cream sheet that, balanced on itself, is
 * within wood's bar of the beech (they can't be told apart); 'lamp' is the
 * plain photo under a warm evening lamp, every colour tinted as the owner's
 * white paper was (2026-11-09: green 0.89, blue 0.77 of red); 'two' is the plain
 * grid on two sheets side by side, the second (u past 90mm) 0.6mm out each way;
 * 'roof' is the plain grid with an orange roof over the photo's whole central
 * half (the #204 station's, as a large piece is photographed), hiding the straights;
 * 'wavy' is the plain grid printed on a sheet that isn't flat, its lines
 * waving 0.7mm either way (no single map fits it).
 */
export function drawPhoto(deg: number, paper: 'plain' | 'mm' | 'flat' | 'cream' | 'lamp' | 'two' | 'roof' | 'wavy' = 'plain'): RgbImage {
  const map = mapFor(deg);
  const rgb = new Uint8Array(W * H * 3);
  const near = (q: number, step: number) => Math.abs(q - step * Math.round(q / step));
  const inside = (r: { u0: number; u1: number; v0: number; v1: number }, u: number, v: number) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [u, v] = pixelToPaper(map, [x, y]);
      const [gu, gv] = paper === 'two' && u > 90 ? [u + 0.6, v + 0.6]
        : paper === 'wavy' ? [u + 0.7 * Math.sin(v / 9), v + 0.7 * Math.sin(u / 9)] : [u, v];
      let rgbv: [number, number, number] = paper === 'cream' ? [215, 185, 140] : [196, 205, 214]; // paper
      if (u >= 0 && u <= 180 && v >= 0 && v <= 260) {
        const ten = near(gu, 10) < 0.18 || near(gv, 10) < 0.18, five = near(gu, 5) < 0.14 || near(gv, 5) < 0.14;
        if (ten || (five && paper !== 'plain')) rgbv = [163, 179, 189];
        else if (five) rgbv = [180, 192, 202];
        else if (paper === 'mm' && (near(gu, 1) < 0.1 || near(gv, 1) < 0.1)) rgbv = [184, 195, 205];
      } else rgbv = [120, 160, 90]; // a green table past the sheet
      if (inside(MEDIUM, u, v) || inside(LONG, u, v)) rgbv = [205, 165, 115]; // beech
      if (paper === 'roof' && x > W / 4 - 20 && x < (3 * W) / 4 + 20 && y > H / 4 - 20 && y < (3 * H) / 4 + 20) rgbv = [235, 120, 40];
      if (paper === 'lamp') rgbv = [rgbv[0], Math.round(rgbv[1] * 0.89), Math.round(rgbv[2] * 0.77)];
      const k = (y * W + x) * 3;
      rgb[k] = rgbv[0]; rgb[k + 1] = rgbv[1]; rgb[k + 2] = rgbv[2];
    }
  }
  return { width: W, height: H, rgb };
}
