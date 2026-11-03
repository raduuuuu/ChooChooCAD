/**
 * MEASURING FROM A PHOTO (plan 2026-11-02: P1 B, OV3, E2, design 8).
 *
 * Value: protects=a figure read through grid + 144mm reference matches the
 * true length of a top face 12mm off the paper, for a square camera, a
 * slightly tilted one and a grid printed off size; a degenerate grid, a
 * misread grid point and an implausible reference are refused
 * Value: fails_when=the parallax scale is dropped, the homography is wrong,
 * or a refusal check is removed
 * Value: why_new=no photo measuring existed
 * Value: seam=a pinhole camera in this file stands in for the phone: points
 * in millimetres, projected to pixels, nothing read from an image
 * Value: no_claim=real lens distortion and the accuracy of reading points off
 * crops; the 216mm trial on real photos (EO7) owns that
 */

import { describe, expect, it } from 'vitest';
import { homography, measurePhoto, REFERENCE_MM, toPaper, type GridPoint, type Pt } from './photo.js';

type P3 = readonly [number, number, number];

/** A pinhole camera at `at`, focal length `f` pixels, turned `tiltDeg` about the paper's x axis, looking down. */
function camera(at: P3, f: number, tiltDeg = 0) {
  const t = (tiltDeg * Math.PI) / 180;
  return ([x, y, z]: P3): Pt => {
    const dx = x - at[0], dy = y - at[1], dz = z - at[2];
    // Looking along -z; tilt rotates the view about x.
    const cy = dy * Math.cos(t) - dz * Math.sin(t);
    const cz = dy * Math.sin(t) + dz * Math.cos(t);
    return [2000 + (f * dx) / -cz, 1500 + (f * cy) / -cz];
  };
}

const PLANK = 12;

/** A 10mm grid across 0..200 x 0..120, labelled with `label` mm per printed 10mm (an off-size print reads `label` != 10). */
function grid(project: (p: P3) => Pt, label = 10): GridPoint[] {
  const out: GridPoint[] = [];
  for (let i = 0; i <= 20; i += 5) for (let j = 0; j <= 12; j += 4) out.push({ px: project([i * 10, j * 10, 0]), mm: [i * label, j * label] });
  return out;
}

/** The reference straight at y = 20 and a piece of `length` at y = 80, both top faces 12mm up. */
function scene(project: (p: P3) => Pt, length: number, label = 10) {
  return {
    grid: grid(project, label),
    reference: [project([20, 20, PLANK]), project([20 + REFERENCE_MM, 20, PLANK])] as const,
    figures: { length: [project([10, 80, PLANK]), project([10 + length, 80, PLANK])] as const },
  };
}

const read = (r: ReturnType<typeof measurePhoto>) => {
  if (r.kind !== 'measured') throw new Error(r.reason);
  return r.figures.length!;
};

describe('a figure read from a photo', () => {
  /*
   * MUTATION PROOF, run: `k` forced to 1 (the parallax scale dropped) fails
   * with `expected 224.99999999999926 to be close to 216`: the top face, 12mm
   * nearer a lens 300mm up, read 300/288 long.
   */
  it('square camera 300mm up: a 216mm top face reads 216', () => {
    const shot = camera([100, 60, 300], 3000);
    expect(read(measurePhoto(scene(shot, 216)))).toBeCloseTo(216, 1);
  });

  it('a camera tilted 3 degrees still reads within 0.5mm', () => {
    const shot = camera([100, 60, 350], 3000, 3);
    expect(Math.abs(read(measurePhoto(scene(shot, 216))) - 216)).toBeLessThan(0.5);
  });

  it('any millimetre paper: a grid printed 2% off size changes nothing', () => {
    const shot = camera([100, 60, 300], 3000);
    expect(read(measurePhoto(scene(shot, 54, 10.2)))).toBeCloseTo(54, 1);
  });
});

describe('a photo is refused', () => {
  it('when the grid points are degenerate', () => {
    const shot = camera([100, 60, 300], 3000);
    const line: GridPoint[] = [0, 50, 100, 150].map((x) => ({ px: shot([x, 0, 0]), mm: [x, 0] }));
    expect(measurePhoto({ ...scene(shot, 216), grid: line }).kind).toBe('refused');
  });

  /*
   * MUTATION PROOF, run: the GRID_RESIDUAL_MAX_MM check removed fails with
   * `expected 'measured' to be 'refused'`.
   */
  it('when one grid point is misread by 10 pixels', () => {
    const shot = camera([100, 60, 300], 3000);
    const s = scene(shot, 216);
    const bad = s.grid.map((g, i) => (i === 7 ? { ...g, px: [g.px[0] + 10, g.px[1]] as Pt } : g));
    expect(measurePhoto({ ...s, grid: bad }).kind).toBe('refused');
  });

  /*
   * MUTATION PROOF, run: the K_PLAUSIBLE check removed fails with
   * `expected 'measured' to be 'refused'`.
   */
  it('when the reference reads far off 144 on the paper (not lying flat)', () => {
    const shot = camera([100, 60, 300], 3000);
    const s = scene(shot, 216);
    expect(measurePhoto({ ...s, reference: [shot([20, 20, PLANK]), shot([150, 20, PLANK])] }).kind).toBe('refused');
  });
});

it('the homography maps the grid points onto their millimetres', () => {
  const shot = camera([100, 60, 300], 3000, 2);
  const g = grid(shot);
  const h = homography(g);
  for (const p of g) {
    const [u, v] = toPaper(h, p.px);
    expect(u).toBeCloseTo(p.mm[0], 6);
    expect(v).toBeCloseTo(p.mm[1], 6);
  }
});
