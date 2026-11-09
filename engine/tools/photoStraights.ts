/**
 * THE PLANKS ON THE PAPER, FOUND WITHOUT A HAND (community-pieces plan, eng D5):
 * the reference straight and, on a first session, the long straight.
 *
 *   paper plane, 1mm cells inside the found grid's outline ──▶ a plank's top face
 *   (the red–green average well above blue: lit beech, not its dimmer side face)
 *        │  4-connected pieces of wood, each kept to its cells near its median warmth
 *        │  (a shadow on warm paper joins the piece but is cooler)
 *        ▼
 *   each piece's main axis (its moments), its width slice by slice; the body
 *   is the run of slices spanning nearly the full width (a peg's are narrow;
 *   a socket's still span it, wood either side of the hole)
 *        │  a plank is 32 to 50mm wide (40mm, tops read a few percent long)
 *        ▼
 *   its two end centres on the centreline, as far as its side walls reach
 *   ──refineEnd──▶ exact ends, px
 *
 * Which straight is which comes from its length on the paper: a plank whose
 * top reads REFERENCE_MM at a plausible scale (K_PLAUSIBLE) is a medium
 * straight, one that reads 216mm a long straight.
 */

import { K_PLAUSIBLE, REFERENCE_MM, type Pt } from './photo.js';
import { PLANK_WIDTH_MM, refineEnd, type RefinedEnd } from './photoEdges.js';

export { PLANK_WIDTH_MM };
import { paperToPixel, pixelToPaper, WOOD_GREEN_OVER_BLUE, type FoundGrid } from './photoGrid.js';
import { findGridAuto } from './photoGridSeed.js';
import type { RgbImage } from './photoImage.js';

/**
 * A slice spanning at least this share of the plank's width is body. A peg's
 * slices span under 45% (its neck and head); a socket's still span nearly all
 * of it, but a shadow across one side can cut that to two thirds.
 */
const BODY = 0.6;
/** Pieces of wood smaller than this, mm², are noise. */
const MIN_AREA = 400;
/**
 * How far past the found grid's outline to look for wood, mm. The guide puts
 * every piece fully on the grid; past the sheet, a table or a patterned cloth
 * can be as orange as beech, and would join a plank lying near the edge.
 */
const MARGIN = 3;

/** The convex hull of points, anticlockwise (Andrew's monotone chain). */
function hull(points: readonly Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** True when q lies inside the hull or within `margin` of it. */
function nearHull(h: readonly Pt[], q: Pt, margin: number): boolean {
  let inside = true, nearest = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i]!, b = h[(i + 1) % h.length]!;
    const ex = b[0] - a[0], ey = b[1] - a[1];
    if (ex * (q[1] - a[1]) - ey * (q[0] - a[0]) < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / (ex * ex + ey * ey)));
    nearest = Math.min(nearest, Math.hypot(q[0] - a[0] - t * ex, q[1] - a[1] - t * ey));
  }
  return inside || nearest <= margin;
}

export interface Plank {
  /** The two end centres, photo px, refined where the edge could be read. */
  readonly ends: readonly [Pt, Pt];
  /** Whether each end was refined (false: the coarse end was kept). */
  readonly refined: readonly [boolean, boolean];
  /** Each end's refinement evidence, null where the coarse end was kept (eng G4b). */
  readonly evidence: readonly [RefinedEnd | null, RefinedEnd | null];
  /** Body length and width on the paper plane, mm (tops read a few percent long). */
  readonly paperLengthMm: number;
  readonly widthMm: number;
}

/**
 * A plank's top face: the red–green average this far above blue. Measured
 * (2026-11-08): the top face 39 to 42 on real beech (70 on the synthetic one);
 * its side face, seen when the camera isn't straight overhead, 22; pink paper
 * 9, brown-red ink about 10. The side face must not count: the method reads
 * the top face's width and ends.
 */
const TOP_FACE = 30;

/**
 * Within one piece of wood, a cell this share of the piece's median warmth or
 * less is not top face. Measured (2026-11-08): on pink paper a plank's shadow
 * reads 30 (36 at the 90th percentile) against its top face's 52; on beech
 * photos the top face reads about 40, so the bar stays near TOP_FACE there.
 */
const OF_MEDIAN = 0.75;

/** The red–green average over blue at paper (u, v), or -Infinity outside the photo. */
function warmthAt(img: RgbImage, grid: FoundGrid, u: number, v: number): number {
  const [x, y] = paperToPixel(grid.map, [u, v]);
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return -Infinity;
  const i = (yi * img.width + xi) * 3;
  return (img.rgb[i]! + img.rgb[i + 1]!) / 2 - img.rgb[i + 2]!;
}

/** Every plank on the paper, longest first. */
export function findPlanks(img: RgbImage, grid: FoundGrid): Plank[] {
  return findWood(img, grid).planks;
}

/** Every plank on the paper, longest first, and how many pieces of wood were wider than any plank (pieces touching). */
export function findWood(img: RgbImage, grid: FoundGrid): { planks: Plank[]; tooWide: number } {
  const us = grid.points.map((p) => p.mm[0]), vs = grid.points.map((p) => p.mm[1]);
  const u0 = Math.min(...us) - MARGIN, v0 = Math.min(...vs) - MARGIN;
  const nu = Math.ceil(Math.max(...us) + MARGIN - u0) + 1, nv = Math.ceil(Math.max(...vs) + MARGIN - v0) + 1;
  const outline = hull(grid.points.map((p) => p.mm));
  const warmth = new Float32Array(nu * nv), wood = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const q: Pt = [u0 + i, v0 + j];
      if (!nearHull(outline, q, MARGIN)) continue;
      warmth[j * nu + i] = warmthAt(img, grid, q[0], q[1]);
      wood[j * nu + i] = warmth[j * nu + i]! > TOP_FACE ? 1 : 0;
    }
  }

  const seen = new Uint8Array(nu * nv);
  const planks: Plank[] = [];
  let tooWide = 0;
  for (let start = 0; start < nu * nv; start++) {
    if (!wood[start] || seen[start]) continue;
    // One piece of wood, by flood fill.
    const cells: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const c = stack.pop()!;
      cells.push(c);
      const i = c % nu, j = (c - i) / nu;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue;
        const n = jj * nu + ii;
        if (wood[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (cells.length < MIN_AREA) continue;
    // The piece's top face: its cells nearly as warm as its median (a shadow
    // joined to it, on paper warm enough to pass TOP_FACE, is not).
    const bar = OF_MEDIAN * [...cells].map((c) => warmth[c]!).sort((a, b) => a - b)[cells.length >> 1]!;
    const top = cells.filter((c) => warmth[c]! >= bar);
    const plank = asPlank(img, grid, top.map((c) => [u0 + (c % nu), v0 + Math.floor(c / nu)] as Pt));
    if (plank === 'too wide') tooWide++;
    else if (plank) planks.push(plank);
  }
  return { planks: planks.sort((a, b) => b.paperLengthMm - a.paperLengthMm), tooWide };
}

/** One piece of wood as a plank; 'too wide' when wider than any plank (pieces touching); null when otherwise not plank-shaped. */
function asPlank(img: RgbImage, grid: FoundGrid, cells: readonly Pt[]): Plank | 'too wide' | null {
  const n = cells.length;
  const cu = cells.reduce((s, p) => s + p[0], 0) / n, cv = cells.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0;
  for (const [u, v] of cells) { suu += (u - cu) ** 2; svv += (v - cv) ** 2; suv += (u - cu) * (v - cv); }
  const angle = 0.5 * Math.atan2(2 * suv, suu - svv);
  const axis: Pt = [Math.cos(angle), Math.sin(angle)], across: Pt = [-axis[1], axis[0]];
  // Width per 1mm slice along the axis, as the slice's extent across: a socket's
  // slices keep wood both sides of the hole, so they still span the plank; a peg's don't.
  const lo0 = new Map<number, number>(), hi0 = new Map<number, number>();
  for (const [u, v] of cells) {
    const s = Math.round((u - cu) * axis[0] + (v - cv) * axis[1]);
    const a = (u - cu) * across[0] + (v - cv) * across[1];
    lo0.set(s, Math.min(lo0.get(s) ?? Infinity, a));
    hi0.set(s, Math.max(hi0.get(s) ?? -Infinity, a));
  }
  const slices = new Map<number, number>([...lo0.keys()].map((k) => [k, hi0.get(k)! - lo0.get(k)! + 1]));
  const keys = [...slices.keys()].sort((a, b) => a - b);
  const widths = keys.map((k) => slices.get(k)!);
  const widthMm = [...widths].sort((a, b) => a - b)[Math.floor(widths.length * 0.75)]!;
  if (widthMm > PLANK_WIDTH_MM.max) return 'too wide';
  if (widthMm < PLANK_WIDTH_MM.min) return null;
  // The body: the run of near-full-width slices through the middle.
  const body = keys.filter((k) => slices.get(k)! >= BODY * widthMm);
  if (body.length < 2) return null;
  const mid = body[Math.floor(body.length / 2)]!;
  let lo = mid, hi = mid;
  while (slices.get(lo - 1) !== undefined && slices.get(lo - 1)! >= BODY * widthMm) lo--;
  while (slices.get(hi + 1) !== undefined && slices.get(hi + 1)! >= BODY * widthMm) hi++;
  // The centreline: the median of the body slices' midpoints, halfway between
  // the plank's two edges (an end read off it moves a tenth of a mm per mm sideways).
  const mids = keys.filter((k) => k >= lo && k <= hi).map((k) => (lo0.get(k)! + hi0.get(k)!) / 2).sort((a, b) => a - b);
  const acr = mids[mids.length >> 1]!;
  // Each end: as far as the plank's side walls reach, slice by slice (wood 12mm
  // or more off the centreline on both sides). A socket's walls run to the end
  // even when a shadow narrows the slices there; a peg is narrower, so at a peg
  // end they stop at the body; a lit patch beside an end has a wall one side only.
  const halfWidth = widthMm / 2;
  const walls = new Map<number, number>(); // bit 1: wall on the − side, bit 2: on the + side
  for (const [u, v] of cells) {
    const s = Math.round((u - cu) * axis[0] + (v - cv) * axis[1]);
    const off = (u - cu) * across[0] + (v - cv) * across[1] - acr;
    if (Math.abs(off) >= 12 && Math.abs(off) <= halfWidth) walls.set(s, (walls.get(s) ?? 0) | (off < 0 ? 1 : 2));
  }
  // The run of walled slices through the middle of the body; one slice short of
  // a wall (a speck of shadow) doesn't end it, something lit beside the end
  // (one-sided) doesn't extend it.
  const walled = (k: number) => walls.get(k) === 3;
  let wallLo = Math.round((lo + hi) / 2), wallHi = wallLo;
  if (!walled(wallLo)) return null;
  while (walled(wallLo - 1) || walled(wallLo - 2)) wallLo -= walled(wallLo - 1) ? 1 : 2;
  while (walled(wallHi + 1) || walled(wallHi + 2)) wallHi += walled(wallHi + 1) ? 1 : 2;
  const endAt = (s: number): Pt => paperToPixel(grid.map, [cu + s * axis[0] + acr * across[0], cv + s * axis[1] + acr * across[1]]);
  const coarse: [Pt, Pt] = [endAt(wallLo - 0.5), endAt(wallHi + 0.5)];
  const ra = refineEnd(img, grid.map, coarse[0], coarse[1]), rb = refineEnd(img, grid.map, coarse[1], coarse[0]);
  const ends: [Pt, Pt] = [ra?.px ?? coarse[0], rb?.px ?? coarse[1]];
  const [pa, pb] = [pixelToPaper(grid.map, ends[0]), pixelToPaper(grid.map, ends[1])];
  return { ends, refined: [ra !== null, rb !== null], evidence: [ra, rb], paperLengthMm: Math.hypot(pa[0] - pb[0], pa[1] - pb[1]), widthMm };
}

/** The length on the paper a straight of `mm` can read at a plausible scale. */
const readsAs = (mm: number, paperMm: number) => {
  const k = mm / paperMm;
  return k >= K_PLAUSIBLE.min && k <= K_PLAUSIBLE.max;
};

/** The medium straight (the reference) and the long straight among the planks, when present. */
export function namePlanks(planks: readonly Plank[]): { reference?: Plank; long?: Plank } {
  return {
    reference: planks.find((p) => readsAs(REFERENCE_MM, p.paperLengthMm)),
    long: planks.find((p) => readsAs(216, p.paperLengthMm)),
  };
}

/**
 * The most the automatic grid's crossings may disagree, rms mm. Stricter than
 * GRID_RESIDUAL_MAX_MM (a dozen hand-read points): hundreds of crossings on one
 * flat sheet measured 0.09 to 0.16 (2026-11-08, nine photos), two sheets side
 * by side 0.41; a measurement across two sheets is out by their misalignment.
 */
export const AUTO_GRID_RMS_MAX_MM = 0.3;

/**
 * The grid read at the scale that makes a plank the 144mm reference: the grid
 * finder can take 5mm lines for 10mm ones (or the reverse) on paper without
 * clear 1mm lines, which halves or doubles every length; the reference's known
 * length decides. Scale 1 first, then 2, then 0.5.
 */
export type Found = { grid: FoundGrid; planks: ReturnType<typeof namePlanks>; tooWide: number };
export function gridAndPlanks(img: RgbImage): Found | { reason: string } {
  // With no medium straight at any scale, the first scale that found a grid says why (not a scale that found none).
  let first: Found | { reason: string } | null = null, firstGrid: Found | null = null;
  for (const scale of [1, 2, 0.5]) {
    const found = findGridAuto(img, scale);
    const wood = 'reason' in found ? null : findWood(img, found.grid);
    const attempt = 'reason' in found ? found : { grid: found.grid, planks: namePlanks(wood!.planks), tooWide: wood!.tooWide };
    first ??= attempt;
    if ('reason' in attempt) continue;
    if (attempt.planks.reference) return attempt;
    firstGrid ??= attempt;
  }
  return firstGrid ?? first!;
}

/**
 * True when the paper is as warm as wood: green over blue past wood's bar on
 * the paper. The paper is read as the brightest quarter of the whole photo, at
 * its 25th percentile: paper is the brightest thing in it, and a large orange
 * piece can fill the middle (a station's roof read 31 there on pink paper).
 * Measured (2026-11-09): white, blue and pink papers 6 or less; cream paper
 * with orange lines 18, where wood and paper can't be told apart.
 */
export function paperTooWarm(img: RgbImage): boolean {
  return paperWarmth(img) > WOOD_GREEN_OVER_BLUE;
}

/** The paper's green over blue, read as paperTooWarm reads it, so a refusal can name it. */
export function paperWarmth(img: RgbImage): number {
  const px: [number, number][] = [];
  for (let y = 0; y < img.height; y += 4) {
    for (let x = 0; x < img.width; x += 4) {
      const i = (y * img.width + x) * 3;
      px.push([img.rgb[i]! + img.rgb[i + 1]! + img.rgb[i + 2]!, img.rgb[i + 1]! - img.rgb[i + 2]!]);
    }
  }
  const bright = px.sort((a, b) => a[0] - b[0]).slice(px.length - (px.length >> 2)).map((p) => p[1]).sort((a, b) => a - b);
  return bright.length > 0 ? bright[bright.length >> 2]! : 0;
}
