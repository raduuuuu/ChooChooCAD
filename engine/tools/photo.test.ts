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
import { chooseScale, homography, measurePhoto, REFERENCE_MM, toPaper, type GridPoint, type Pt } from './photo.js';

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

describe('the scale from the camera, for a medium straight that is not 144', () => {
  // camera() puts the principal point at (2000, 1500): a 4000 × 3000 photo. Its focal length as a 35mm camera's:
  const SIZE = { width: 4000, height: 3000 }, F = 3000, FOCAL_35 = (F / Math.hypot(4000, 3000)) * Math.hypot(36, 24);
  /** The owner's medium straight, 143.6mm (2026-11-10), at y = 20; a 216mm piece at y = 80; top faces 12mm up. */
  const owner = (shot: (p: P3) => Pt) => {
    const g = grid(shot);
    const h = homography(g);
    const onPaper = (a: P3, b: P3) => { const [pa, pb] = [toPaper(h, shot(a)), toPaper(h, shot(b))]; return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); };
    return { h, medium: onPaper([20, 20, PLANK], [163.6, 20, PLANK]), long: onPaper([10, 80, PLANK], [226, 80, PLANK]) };
  };

  /*
   * MUTATION PROOF, run (2026-11-10): cameraScale's k as 1 (the top faces' height
   * dropped) fails with `{"refused":"reference-off-size","reason":"with the camera
   * 300mm above the paper (25.959969183340725mm equivalent), the medium straight
   * reads 149.58mm, over 1mm off 144"}`.
   */
  it('reads the piece true and the medium straight as it is; taken as 144, the medium straight reads the piece 0.6mm long', () => {
    const { h, medium, long } = owner(camera([100, 60, 300], F, 3));
    const s = chooseScale(medium, h, SIZE, { focal35mm: FOCAL_35 });
    if ('refused' in s || s.kind !== 'camera') throw new Error(JSON.stringify(s));
    expect(s.k * long).toBeCloseTo(216, 1);
    expect(s.referenceMm).toBeCloseTo(143.6, 1);
    expect(s.pose.heightMm).toBeCloseTo(300, 0);
    const old = chooseScale(medium, h, SIZE);
    if ('refused' in old) throw new Error(old.reason);
    expect(old).toMatchObject({ kind: 'medium', why: 'the photo carries no 35mm focal length' });
    expect(old.k * long).toBeCloseTo(216.6, 1);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): the REFERENCE_OFF_MM check removed fails
   * with `expected { kind: 'camera', k: 0.98, …(3) } to have property "refused"`.
   */
  it('a focal length that does not fit the photo (cropped to half) reads the medium straight far off 144: refused', () => {
    const { h, medium } = owner(camera([100, 60, 300], F));
    expect(chooseScale(medium, h, SIZE, { focal35mm: FOCAL_35 * 2 })).toHaveProperty('refused', 'reference-off-size');
  });
});
