/**
 * MEASURING A PIECE FROM A PHOTO ON MILLIMETRE PAPER (plan
 * docs/plan/2026-11-02-photo-parts-and-stations.md: P1 B, OV3, E2, EO7).
 *
 *   photo ──▶ grid points (pixel ↔ paper mm) ──▶ homography H (perspective)
 *         ──▶ reference straight's two ends through H: its length on the paper
 *         ──▶ k = 144 / that length       (the top faces sit 12mm nearer the
 *                                          lens than the paper; k undoes it)
 *         ──▶ each figure = k × its length on the paper
 *
 * The paper only fixes perspective. The SCALE comes from the published 144mm
 * straight lying beside the piece with its top face in the same plane, so any
 * standard millimetre paper works, and a grid printed a little off size does
 * not matter (design decision 8).
 *
 * The reference reads 144 by construction, so it cannot check itself. What it
 * can check is that `k` is a believable parallax: a top face 12mm above the
 * paper, seen from 20 to 60cm, reads 2 to 6% long. A `k` outside
 * K_PLAUSIBLE means the reference was not lying flat, or the paper is far
 * off size, and the photo is refused. Whether the whole chain measures right
 * is the 216mm trial's job (EO7), not this file's.
 *
 * A real medium straight is not exactly 144: the owner's is 143.6 (2026-11-10),
 * and every figure read against it came out 0.3% long. So when the photo
 * carries its 35mm-equivalent focal length, the scale comes from the camera
 * instead (chooseScale): the grid's homography and the focal length give the
 * camera's height above the paper, and that height and the top faces' height
 * (TOP_FACE_MM) give k. The medium straight is then read like any figure, and
 * a reading more than REFERENCE_OFF_MM off 144 refuses the photo (a cropped
 * photo, a sheet printed far off size, a piece not lying flat). The scale now
 * leans on the paper being printed true: the owner's two sheets differ by
 * about 0.2%.
 *
 * No image library: the pixel coordinates come in as numbers, read off
 * enlarged crops (`photoCrop.ts`, E2).
 */

export type Pt = readonly [number, number];

/** One grid point: where it is in the photo, and where it is on the paper. */
export interface GridPoint {
  readonly px: Pt;
  readonly mm: Pt;
}

/** The published medium straight used as the scale (OV3). */
export const REFERENCE_MM = 144;

/** The parallax a top face 12mm off the paper can show: from 0.9 to 1.0 of the paper reading, with room for an off-size print. */
export const K_PLAUSIBLE = { min: 0.9, max: 1.02 } as const;

/** A 3x3 homography, row-major, with h[8] = 1. */
export type Homography = readonly number[];

/**
 * The homography taking photo pixels to paper millimetres, from four or more
 * grid points, by least squares on the eight unknowns (h33 fixed at 1).
 * Throws on fewer than four points or a degenerate set (three in a line).
 */
export function homography(points: readonly GridPoint[]): Homography {
  if (points.length < 4) throw new Error(`a perspective fix needs 4 grid points, got ${points.length}`);
  // Normal equations AᵀA h = Aᵀb for the 2N x 8 system.
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const add = (row: readonly number[], b: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i]! += row[i]! * b;
      for (let j = 0; j < 8; j++) ata[i]![j]! += row[i]! * row[j]!;
    }
  };
  for (const { px: [x, y], mm: [u, v] } of points) {
    add([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = solve(ata, atb);
  if (h === null) throw new Error('the grid points are degenerate (three or more in a line?)');
  return [...h, 1];
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    const scale = Math.max(...m[c]!.slice(0, n).map(Math.abs), 1);
    if (Math.abs(m[p]![c]!) < 1e-12 * scale) return null;
    [m[c], m[p]] = [m[p]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** The inverse homography: paper millimetres to photo pixels. */
export function invert3(h: Homography): Homography {
  const [a, b, c, d, e, f, g, i, j] = h as [number, number, number, number, number, number, number, number, number];
  const A = e * j - f * i, B = -(d * j - f * g), C = d * i - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * j - c * i) / det, (b * f - c * e) / det, B / det, (a * j - c * g) / det, -(a * f - c * d) / det, C / det, -(a * i - b * g) / det, (a * e - b * d) / det];
}

/** A photo pixel on the paper, in millimetres. */
export function toPaper(h: Homography, [x, y]: Pt): Pt {
  const w = h[6]! * x + h[7]! * y + h[8]!;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
}

const dist = ([ax, ay]: Pt, [bx, by]: Pt) => Math.hypot(bx - ax, by - ay);

/** The largest distance, in paper mm, between a grid point and where H puts it: how well the grid points agree. */
export function gridResidualMm(h: Homography, points: readonly GridPoint[]): number {
  return Math.max(...points.map((p) => dist(toPaper(h, p.px), p.mm)));
}

export interface PhotoInput {
  readonly grid: readonly GridPoint[];
  /** The reference straight's two end centres, on its top face. */
  readonly reference: readonly [Pt, Pt];
  /** Each figure to read: a name and its two end points, on the same top-face plane. */
  readonly figures: Readonly<Record<string, readonly [Pt, Pt]>>;
}

export type PhotoResult =
  | { readonly kind: 'measured'; readonly k: number; readonly gridResidualMm: number; readonly figures: Readonly<Record<string, number>> }
  | { readonly kind: 'refused'; readonly reason: string };

/** Above this, the grid points disagree with each other: a misread point or a bent sheet. */
export const GRID_RESIDUAL_MAX_MM = 0.5;

/**
 * Where `p` sits against the line through `a` and `b`, all on the paper (mm):
 * how far out from it (never negative) and how far along it from `a` towards
 * `b` its foot lies (negative when the foot falls before `a`). Times the
 * scale, as any length: a top face 12mm up is the paper scaled about the
 * camera's nadir, so across and along scale alike.
 */
export function offsetAlong(p: Pt, a: Pt, b: Pt): { offset: number; along: number } {
  const len = dist(a, b);
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, dx = p[0] - a[0], dy = p[1] - a[1];
  return { offset: Math.abs(dx * uy - dy * ux), along: dx * ux + dy * uy };
}

/** Every figure in one photo, or why the photo is refused. */
export function measurePhoto(input: PhotoInput): PhotoResult {
  let h: Homography;
  try {
    h = homography(input.grid);
  } catch (e) {
    return { kind: 'refused', reason: (e as Error).message };
  }
  const residual = gridResidualMm(h, input.grid);
  if (residual > GRID_RESIDUAL_MAX_MM) {
    return { kind: 'refused', reason: `the grid points disagree by ${residual.toFixed(2)}mm (limit ${GRID_RESIDUAL_MAX_MM}mm): a misread point or a sheet that is not flat` };
  }
  return scaleAndMeasure((p) => toPaper(h, p), residual, input);
}

/**
 * The scale from the reference and every figure, given any map from photo
 * pixels to paper millimetres (a plain homography here, or one with lens
 * bowing from photoGrid.ts).
 */
export function scaleAndMeasure(
  onPaper: (p: Pt) => Pt,
  gridResidualMm: number,
  input: Pick<PhotoInput, 'reference' | 'figures'>,
): PhotoResult {
  const refOnPaper = dist(onPaper(input.reference[0]), onPaper(input.reference[1]));
  const k = REFERENCE_MM / refOnPaper;
  if (k < K_PLAUSIBLE.min || k > K_PLAUSIBLE.max) {
    return { kind: 'refused', reason: `the reference reads ${refOnPaper.toFixed(1)}mm on the paper (scale ${k.toFixed(3)}, expected ${K_PLAUSIBLE.min} to ${K_PLAUSIBLE.max}): is it lying flat, top face up?` };
  }
  const figures: Record<string, number> = {};
  for (const [name, [a, b]] of Object.entries(input.figures)) figures[name] = k * dist(onPaper(a), onPaper(b));
  return { kind: 'measured', k, gridResidualMm, figures };
}

// ── The scale from the camera ────────────────────────────────────────────────

/** How high the top faces stand above the paper: a wooden track's thickness, mm. Half a millimetre either way moves a 144mm reading about 0.12mm. */
export const TOP_FACE_MM = 12;
/** How far off 144 a medium straight may read when the camera sets the scale: its own variance and the method's together, mm. */
export const REFERENCE_OFF_MM = 1;

/** What the photo says about its camera: the focal length as a 35mm camera's (EXIF FocalLengthIn35mmFilm). */
export interface Camera {
  readonly focal35mm: number;
}

/** Where the camera was, from the grid: its height above the paper, its tilt from straight down, and the scale k it gives the top faces. */
export interface CameraPose {
  readonly heightMm: number;
  readonly tiltDeg: number;
  readonly k: number;
}

type V3 = readonly [number, number, number];
const norm3 = (v: V3) => Math.hypot(v[0], v[1], v[2]);
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A focal length that doesn't fit the grid (a cropped photo) bends the two paper axes apart: past this, the pose isn't used. */
const POSE_FIT = 0.03;

/**
 * The camera's pose from the homography `h` (photo pixels, lens bowing removed,
 * to paper mm) and the focal length, the principal point at the photo's
 * centre. The paper's two axes, seen through the lens, must come out square
 * and equally long (to POSE_FIT); null when they don't, or the camera isn't
 * above the top faces.
 *
 *   paper (u, v, 1) ──h⁻¹──▶ pixel ──K⁻¹──▶ λ [r1 r2 t]    camera centre C = −Rᵀt
 *   k = (height − TOP_FACE_MM) / height       a top face is the paper scaled about the nadir
 */
export function cameraScale(h: Homography, size: { readonly width: number; readonly height: number }, focal35mm: number, topMm = TOP_FACE_MM): CameraPose | null {
  const f = (focal35mm / Math.hypot(36, 24)) * Math.hypot(size.width, size.height);
  const cx = size.width / 2, cy = size.height / 2;
  const g = invert3(h);
  const ray = (k: number): V3 => [(g[k]! - cx * g[6 + k]!) / f, (g[3 + k]! - cy * g[6 + k]!) / f, g[6 + k]!];
  const a1 = ray(0), a2 = ray(1), a3 = ray(2);
  const l1 = norm3(a1), l2 = norm3(a2);
  if (!(f > 0) || !(l1 > 0) || !(l2 > 0)) return null;
  const r1: V3 = [a1[0] / l1, a1[1] / l1, a1[2] / l1], r2: V3 = [a2[0] / l2, a2[1] / l2, a2[2] / l2];
  if (Math.abs(l1 / l2 - 1) > POSE_FIT || Math.abs(dot3(r1, r2)) > POSE_FIT) return null;
  const lam = (l1 + l2) / 2, t: V3 = [a3[0] / lam, a3[1] / lam, a3[2] / lam];
  const r3: V3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  const heightMm = Math.abs(dot3(r3, t));
  if (!Number.isFinite(heightMm) || heightMm <= 2 * topMm) return null;
  return { heightMm, tiltDeg: (Math.acos(Math.min(1, Math.abs(r3[2]))) * 180) / Math.PI, k: (heightMm - topMm) / heightMm };
}

export type Scale =
  | { readonly kind: 'camera'; readonly k: number; readonly pose: CameraPose; readonly focal35mm: number; readonly referenceMm: number }
  | { readonly kind: 'medium'; readonly k: number; readonly why: string };

/**
 * The scale for one photo, given the medium straight's length on the paper:
 * from the camera when the photo carries a focal length that fits the grid,
 * the medium straight then read and held to 144 ± REFERENCE_OFF_MM; else from
 * the medium straight taken as 144, as before, held to K_PLAUSIBLE.
 */
export function chooseScale(referenceOnPaperMm: number, h: Homography, size: { readonly width: number; readonly height: number }, camera?: Camera): Scale | { readonly refused: 'reference-off-size' | 'k-implausible'; readonly reason: string } {
  const pose = camera ? cameraScale(h, size, camera.focal35mm) : null;
  if (pose) {
    const referenceMm = pose.k * referenceOnPaperMm;
    if (!(Math.abs(referenceMm - REFERENCE_MM) <= REFERENCE_OFF_MM)) {
      return { refused: 'reference-off-size', reason: `with the camera ${pose.heightMm.toFixed(0)}mm above the paper (${camera!.focal35mm}mm equivalent), the medium straight reads ${referenceMm.toFixed(2)}mm, over ${REFERENCE_OFF_MM}mm off ${REFERENCE_MM}` };
    }
    return { kind: 'camera', k: pose.k, pose, focal35mm: camera!.focal35mm, referenceMm };
  }
  const k = REFERENCE_MM / referenceOnPaperMm;
  if (!(k >= K_PLAUSIBLE.min && k <= K_PLAUSIBLE.max)) {
    return { refused: 'k-implausible', reason: `the reference reads ${referenceOnPaperMm.toFixed(1)}mm on the paper (k ${Number.isFinite(k) ? k.toFixed(3) : 'not finite'}; a medium straight lying flat reads ${K_PLAUSIBLE.min} to ${K_PLAUSIBLE.max})` };
  }
  return { kind: 'medium', k, why: camera ? 'the camera\'s focal length doesn\'t fit the grid (a cropped photo?)' : 'the photo carries no 35mm focal length' };
}
