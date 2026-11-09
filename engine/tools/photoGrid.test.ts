/**
 * FINDING THE GRID AND THE PLANK ENDS BY THEMSELVES (plan 2026-11-02, E2
 * revisited after the 216mm trial).
 *
 * Value: protects=from six seed points read 3px off, the grid finder lands on
 * the 10mm lines (not the 5mm ones), fits perspective and lens bowing to a
 * known model within 0.05mm, and the end finder puts a plank's end within
 * 0.05mm of where it was drawn (a grey plastic one within 0.1mm); a BMP of either row order reads back the same
 * pixels; a piece is "across the middle" only when its ends straddle the centre
 * Value: fails_when=the line signal, the sub-pixel step, the bowing term,
 * the outlier drop or the edge crossing is wrong
 * Value: why_new=hand-read points left ±1mm on a 216mm figure
 * Value: seam=a synthetic photo drawn here through a known perspective and
 * bowing stands in for the camera; colours are the ones measured on the trial
 * photo (paper red 196, 10mm line red 163)
 * Value: no_claim=real JPEG noise, real lens shapes and real wood; the 216mm
 * trial on real photos owns those
 */

import { describe, expect, it } from 'vitest';
import type { Homography, Pt } from './photo.js';
import { refineEnd, straddlesCentre } from './photoEdges.js';
import { findGrid, paperToPixel, pixelToPaper, type PaperMap } from './photoGrid.js';
import { readBmp, type RgbImage } from './photoImage.js';

const W = 1200, H = 1600;

/** The true model: about 6px per mm, a mild tilt, and some bowing. */
const TRUE: PaperMap = (() => {
  // Undistorted pixel -> paper: paper = Hm(undistorted). Built as the inverse of a paper->pixel map.
  const s = 6, tilt = 0.00004;
  // paper->pixel (undistorted): x = 80 + s·u + 0.02·s·v, y = 60 + s·v - 0.01·s·u, with a small perspective term.
  const toPixel: Homography = [s, 0.02 * s, 80, -0.01 * s, s, 60, tilt, 0.00002, 1];
  const inv = (h: Homography): Homography => {
    const [a, b, c, d, e, f, g, i, j] = h as [number, number, number, number, number, number, number, number, number];
    const A = e * j - f * i, B = -(d * j - f * g), C = d * i - e * g;
    const det = a * A + b * B + c * C;
    const m = [A / det, -(b * j - c * i) / det, (b * f - c * e) / det, B / det, (a * j - c * g) / det, -(a * f - c * d) / det, C / det, -(a * i - b * g) / det, (a * e - b * d) / det];
    return m.map((x) => x / m[8]!);
  };
  return { h: inv(toPixel), k1: -0.02, centre: [W / 2, H / 2], norm: Math.hypot(W, H) / 2 };
})();

/** The plank: paper x 60..100mm (40 wide), y 40..200mm, its ends at y = 40 and y = 200 on x = 80. */
const PLANK = { x0: 60, x1: 100, y0: 40, y1: 200 } as const;

/** Beech, as measured on the trial photo; grey, the plastic of the #204 station's track. */
const BEECH = [205, 165, 115] as const, GREY = [125, 126, 128] as const;

/** With `shadow`, a grey shadow 2.5mm deep past the plank's far end (y1): as dark again over the paper as the plank is over it. */
function drawPhoto(plank: readonly [number, number, number] = BEECH, shadow = false): RgbImage {
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Pixel x is at position x, the convention the line and edge readers sample with.
      const [u, v] = pixelToPaper(TRUE, [x, y]);
      const near = (q: number, step: number) => Math.abs(q - step * Math.round(q / step));
      let r = 196, g = 205, b = 214; // paper
      const inGrid = u >= 0 && u <= 180 && v >= 0 && v <= 250;
      if (inGrid && (near(u, 10) < 0.18 || near(v, 10) < 0.18)) [r, g, b] = [163, 179, 189];
      else if (inGrid && (near(u, 5) < 0.12 || near(v, 5) < 0.12)) [r, g, b] = [180, 192, 202];
      if (u >= PLANK.x0 && u <= PLANK.x1 && v >= PLANK.y0 && v <= PLANK.y1) [r, g, b] = plank;
      else if (shadow && u >= PLANK.x0 && u <= PLANK.x1 && v > PLANK.y1 && v <= PLANK.y1 + 2.5) [r, g, b] = [168, 169, 170];
      const i = (y * W + x) * 3;
      rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b;
    }
  }
  return { width: W, height: H, rgb };
}

const photo = drawPhoto();
const seeds = ([[10, 20], [170, 20], [10, 130], [170, 130], [10, 240], [170, 240]] as Pt[]).map((mm, i) => {
  const [x, y] = paperToPixel(TRUE, mm);
  return { px: [x + (i % 2 ? 3 : -3), y + (i % 3 ? 2 : -3)] as Pt, mm };
});
const spec = { cols: Array.from({ length: 19 }, (_, i) => i * 10), rows: Array.from({ length: 26 }, (_, i) => i * 10) };

describe('the grid finder', () => {
  const g = findGrid(photo, seeds, spec);

  /*
   * MUTATION PROOF, run: the bowing search removed (k1 fixed at 0) fails with
   * `expected 1.2251923993223022 to be less than 0.05`: perspective alone
   * cannot hold a bowed grid.
   */
  it('recovers the true map within 0.05mm everywhere in the grid', () => {
    let worst = 0;
    for (const mm of [[5, 5], [175, 5], [90, 125], [5, 245], [175, 245]] as Pt[]) {
      const [u, v] = pixelToPaper(g.map, paperToPixel(TRUE, mm));
      worst = Math.max(worst, Math.hypot(u - mm[0], v - mm[1]));
    }
    expect(worst).toBeLessThan(0.05);
  });

  it('finds most crossings and none under the plank', () => {
    expect(g.points.length).toBeGreaterThan(300);
    for (const p of g.points) {
      const [u, v] = p.mm;
      expect(u > PLANK.x0 - 2 && u < PLANK.x1 + 2 && v > PLANK.y0 - 2 && v < PLANK.y1 + 2).toBe(false);
    }
  });

  /*
   * MUTATION PROOF, run: refineEnd returning its seed unchanged fails with
   * `expected 1.000839371924151 to be less than 0.05`: the seed was placed 1mm off.
   */
  it('puts both plank ends within 0.05mm of where they were drawn', () => {
    const seedA = paperToPixel(TRUE, [80.5, PLANK.y0 + 1]);
    const seedB = paperToPixel(TRUE, [79.5, PLANK.y1 - 1]);
    const a = refineEnd(photo, g.map, seedA, seedB)!;
    const b = refineEnd(photo, g.map, seedB, seedA)!;
    const ea = pixelToPaper(g.map, a.px), eb = pixelToPaper(g.map, b.px);
    expect(Math.abs(ea[1] - PLANK.y0)).toBeLessThan(0.05);
    expect(Math.abs(eb[1] - PLANK.y1)).toBeLessThan(0.05);
  });

  /*
   * MUTATION PROOF, run: the slope returned as 0 fails with
   * `expected 0.006329113924050633 to be less than 0.002`.
   */
  it('reports the end face turned against the seed axis', () => {
    // Seeds 1mm apart across over 158mm along: the axis is turned atan(1/158) from the plank, so the square end reads that slope.
    const seedA = paperToPixel(TRUE, [80.5, PLANK.y0 + 1]);
    const seedB = paperToPixel(TRUE, [79.5, PLANK.y1 - 1]);
    const a = refineEnd(photo, g.map, seedA, seedB)!;
    expect(Math.abs(Math.abs(a.slope) - 1 / 158)).toBeLessThan(0.002);
  });
});

describe('the end finder on grey plastic', () => {
  const grey = drawPhoto(GREY);
  const g = findGrid(grey, seeds, spec);

  /*
   * MUTATION PROOF, run: the darkness fallback removed (wood samples only)
   * fails with `expected null not to be null`: grey is as colourless as the
   * paper, the #204 dry run's station track. Within 0.1mm, not beech's 0.05:
   * these ends lie on a 10mm line, whose ink reads darker than the paper the
   * halfway level is taken from, so each end reads about half a pixel long
   * (0.06 and 0.08mm measured).
   */
  it('puts both ends of a grey plank within 0.1mm of where they were drawn', () => {
    const seedA = paperToPixel(TRUE, [80.5, PLANK.y0 + 1]);
    const seedB = paperToPixel(TRUE, [79.5, PLANK.y1 - 1]);
    const a = refineEnd(grey, g.map, seedA, seedB);
    const b = refineEnd(grey, g.map, seedB, seedA);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(Math.abs(pixelToPaper(g.map, a!.px)[1] - PLANK.y0)).toBeLessThan(0.1);
    expect(Math.abs(pixelToPaper(g.map, b!.px)[1] - PLANK.y1)).toBeLessThan(0.1);
  });
});

describe('a grey end with a hard shadow past it', () => {
  // Drawn and fitted here, as the other photos in this file are, not inside the
  // spec: there the drawing counted against vitest's 5 s timeout and the spec
  // timed out under a loaded full run (2026-11-09; it reads the same every time).
  const shaded = drawPhoto(GREY, true);
  const g = findGrid(shaded, seeds, spec);

  /*
   * Read from one seed, the edge lands at the plank or at the shadow's far
   * side, depending on whether the search reaches past the shadow (the #204
   * station's socket end moved 0.5 to 2.4mm as its seed moved 9px). Of the
   * seven seeds, those reaching past the shadow read it unevenly (spread 0.58
   * and 0.72mm) and are dropped; the five left agree on the plank's end.
   * MUTATION PROOF, run (2026-11-09): no spread limit (STEADY_SPREAD =
   * Infinity), so the seven disagree by 2.3mm: `expected null not to be null`.
   */
  it('is found at the plank, not at the shadow', () => {
    const end = refineEnd(shaded, g.map, paperToPixel(TRUE, [79.5, PLANK.y1 - 1]), paperToPixel(TRUE, [80.5, PLANK.y0 + 1]));
    expect(end).not.toBeNull();
    expect(Math.abs(pixelToPaper(g.map, end!.px)[1] - PLANK.y1)).toBeLessThan(0.1);
  });
});

describe('a piece across the middle', () => {
  it('straddles when its ends lie either side of the centre row', () => {
    expect(straddlesCentre({ width: 3000, height: 4000 }, [100, 1500], [120, 2600])).toBe(true);
    expect(straddlesCentre({ width: 3000, height: 4000 }, [100, 2200], [120, 3400])).toBe(false);
  });
});

describe('reading a BMP', () => {
  /** A 2x2 BMP: red, green / blue, white, top row first in the image. */
  const bmp = (topDown: boolean) => {
    const stride = 8; // 2 px x 3 bytes = 6, padded to 8
    const bytes = new Uint8Array(54 + stride * 2);
    const v = new DataView(bytes.buffer);
    bytes[0] = 0x42; bytes[1] = 0x4d;
    v.setUint32(10, 54, true); v.setInt32(18, 2, true); v.setInt32(22, topDown ? -2 : 2, true);
    v.setUint16(28, 24, true); v.setUint32(30, 0, true);
    const rows = [[[0, 0, 255], [0, 255, 0]], [[255, 0, 0], [255, 255, 255]]]; // BGR: top row red, green; bottom blue, white
    rows.forEach((row, r) => {
      const at = 54 + (topDown ? r : 1 - r) * stride;
      row.forEach((px, c) => bytes.set(px, at + c * 3));
    });
    return bytes;
  };

  /*
   * MUTATION PROOF, run: the bottom-up row flip removed fails with
   * `expected [ +0, +0, 255, 255, 255, 255, …(6) ] to deeply equal [ 255, +0, +0, +0, 255, +0, +0, …(5) ]`.
   */
  it('reads either row order into the same top-first pixels', () => {
    const want = [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255];
    expect([...readBmp(bmp(true)).rgb]).toEqual(want);
    expect([...readBmp(bmp(false)).rgb]).toEqual(want);
  });
});
