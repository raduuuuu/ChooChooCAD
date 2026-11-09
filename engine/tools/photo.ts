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
