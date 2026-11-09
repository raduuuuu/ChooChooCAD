/**
 * `bun engine/tools/photoMeasure.ts <points.json> --photo <photo>`: every
 * figure in one photo (plan 2026-11-02, P1 B, E2; measuring-tools plan
 * 2026-11-09, items 2-6). Read-only. `--help` prints the points format.
 *
 *   points.json ──parse + check whole (points-invalid names the field)──▶ { crop, at } → photo px
 *   photo ──loadUpright──▶ pixels as the phone shows them
 *        │
 *        ▼
 *   grid:      seeded from points.json, or found (scales 1, 2, 0.5)  ── rms > 0.3mm, warm paper: refused
 *   reference: given, or the medium straight found                   ── an end facing the camera, k off: refused
 *        │
 *        ▼   for each figure: ends refined (refineEnd), facing checked (facesAway)
 *   distance [a, b] │ offset / along { point, toward?, line: [a, b] }  ── one figure refused, not the run
 *        │
 *        ▼
 *   one result object ──▶ text (stdout; refusals on stderr)
 *
 * Which scale is used (eng G6b):
 *
 *                 reference given                  reference found
 *   grid seeded   the seeds' millimetres;          the seeds' millimetres; the medium
 *                 k outside K_PLAUSIBLE refuses    straight named at that scale, or refused
 *   grid found    scales 1, 2, 0.5: the first      scales 1, 2, 0.5: the first where the
 *                 whose k falls in K_PLAUSIBLE     medium straight is named (gridAndPlanks)
 *
 * Exit: 0 every figure read; 1 the run refused; 2 bad usage; 3 a figure (or
 * every figure) refused. Every refusal has a code (photoCodes.ts), the values
 * that caused it, and the fix as its last line. points.json lives beside the
 * photo in the ignored photos/ folder (SEC1).
 */

import { mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { GRID_RESIDUAL_MAX_MM, K_PLAUSIBLE, measurePhoto, offsetAlong, REFERENCE_MM, type GridPoint, type PhotoInput, type Pt } from './photo.js';
import { CODES, refusal, type Code, type Refusal } from './photoCodes.js';
import { CROP, fromCrop, ZOOM } from './photoCrop.js';
import { centreAcross, facesAway, refineEnd, type RefinedEnd } from './photoEdges.js';
import { findGrid, pixelToPaper, WOOD_GREEN_OVER_BLUE, type FoundGrid } from './photoGrid.js';
import { findGridAuto } from './photoGridSeed.js';
import { loadUpright, PhotoError, writePng, type RgbImage } from './photoImage.js';
import { drawOverlay, type KeyRow } from './photoOverlay.js';
import { AUTO_GRID_RMS_MAX_MM, BALANCE_ABOVE, balanced, findWood, gridAndPlanks, namePlanks, paperWarmth, type Plank } from './photoStraights.js';

// ── The points file ──────────────────────────────────────────────────────────

/** A point: photo pixels, or a point read off a crop (photoCrop.ts), mapped back by its name. */
export type PointIn = Pt | { readonly crop: string; readonly at: Pt };
export type FigureIn =
  | readonly [PointIn, PointIn]
  | { readonly point: PointIn; readonly toward?: PointIn; readonly line: readonly [PointIn, PointIn]; readonly read: 'offset' | 'along' };
export interface PointsFile {
  readonly grid?: readonly GridPoint[];
  readonly reference?: readonly [PointIn, PointIn];
  readonly figures: Readonly<Record<string, FigureIn>>;
  readonly paper?: { readonly cols: readonly [number, number]; readonly rows: readonly [number, number] };
}

/** The same, every point in photo pixels. */
export type Figure =
  | { readonly kind: 'distance'; readonly ends: readonly [Pt, Pt] }
  | { readonly kind: 'offset' | 'along'; readonly point: Pt; readonly toward?: Pt; readonly line: readonly [Pt, Pt] };
export interface Points {
  readonly grid?: readonly GridPoint[];
  readonly reference?: readonly [Pt, Pt];
  readonly figures: Readonly<Record<string, Figure>>;
  readonly paper?: PointsFile['paper'];
}

const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The points file read and checked whole, before any work (DX D10), or why not. */
export function parsePoints(text: string): PointsFile | Refusal {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return refusal('points-not-json', `the points file is not JSON: ${(e as Error).message}`);
  }
  const bad = (field: string, want: string) => refusal('points-invalid', `${field}: expected ${want}`, `fix ${field} in the points file (--help shows the format)`);
  if (!isObj(raw)) return bad('(the file)', 'an object with "figures"');
  const point = (v: unknown, field: string): Refusal | null => {
    if (isPt(v)) return null;
    if (isObj(v) && typeof v.crop === 'string' && isPt(v.at)) return null;
    return bad(field, 'two finite numbers [x, y] in photo pixels, or { "crop": "<crop file>", "at": [x, y] }');
  };
  if (raw.grid !== undefined) {
    if (!Array.isArray(raw.grid)) return bad('grid', 'a list of { "px": [x, y], "mm": [u, v] }');
    for (const [i, g] of raw.grid.entries()) {
      if (!isObj(g) || !isPt(g.px) || !isPt(g.mm)) return bad(`grid[${i}]`, '{ "px": [x, y], "mm": [u, v] }, each two finite numbers');
    }
  }
  if (raw.reference !== undefined) {
    if (!Array.isArray(raw.reference) || raw.reference.length !== 2) return bad('reference', 'its two end centres, [[x, y], [x, y]]');
    for (const i of [0, 1]) {
      const r = point(raw.reference[i], `reference[${i}]`);
      if (r) return r;
    }
  }
  if (raw.figures === undefined || (isObj(raw.figures) && Object.keys(raw.figures).length === 0)) {
    return refusal('no-figures', 'the points file has no figures');
  }
  if (!isObj(raw.figures)) return bad('figures', 'an object of named figures');
  for (const [name, f] of Object.entries(raw.figures)) {
    const at = `figures.${name}`;
    if (Array.isArray(f)) {
      if (f.length !== 2) return bad(at, 'two points [a, b], or { "point", "toward"?, "line": [a, b], "read" }');
      for (const i of [0, 1]) {
        const r = point(f[i], `${at}[${i}]`);
        if (r) return r;
      }
      continue;
    }
    if (!isObj(f)) return bad(at, 'two points [a, b], or { "point", "toward"?, "line": [a, b], "read" }');
    if (f.read !== 'offset' && f.read !== 'along') return bad(`${at}.read`, '"offset" or "along"');
    const p = point(f.point, `${at}.point`);
    if (p) return p;
    if (f.toward !== undefined) {
      const t = point(f.toward, `${at}.toward`);
      if (t) return t;
    }
    if (!Array.isArray(f.line) || f.line.length !== 2) return bad(`${at}.line`, 'its two ends [a, b]');
    for (const i of [0, 1]) {
      const r = point(f.line[i], `${at}.line[${i}]`);
      if (r) return r;
    }
  }
  return raw as unknown as PointsFile;
}

/**
 * Every point in photo pixels. A `{ crop, at }` names a crop of this photo:
 * resolved from the points file's folder, it must sit beside the photo and be
 * named `<photo's stem>.crop-x0-y0-side.png` exactly, with `at` inside the
 * enlarged crop (eng E3, G6). Only the name is read; no file is opened.
 */
export function resolvePoints(file: PointsFile, pointsDir: string, photo: string | null): Points | Refusal {
  const bad = (field: string, why: string) => refusal('points-invalid', `${field}: ${why}`, `fix ${field} in the points file`);
  const pt = (v: PointIn, field: string): Pt | Refusal => {
    if (isPt(v)) return v;
    if (!photo) return refusal('needs-photo', `${field} is read off a crop, which needs the photo`);
    const crop = resolve(pointsDir, v.crop);
    const m = basename(crop).match(/^(.*)\.crop-(\d+)-(\d+)-(\d+)\.png$/);
    const stem = basename(photo, extname(photo));
    if (!m || !CROP.test(crop) || m[1] !== stem || dirname(crop) !== dirname(resolve(photo))) {
      return bad(field, `${v.crop} is not a crop of ${basename(photo)} (a crop is named ${stem}.crop-x0-y0-side.png, beside the photo)`);
    }
    const w = { x0: Number(m[2]), y0: Number(m[3]), side: Number(m[4]) };
    const [cx, cy] = v.at;
    if (cx < 0 || cy < 0 || cx > w.side * ZOOM || cy > w.side * ZOOM) return bad(field, `at [${cx}, ${cy}] is outside the ${w.side * ZOOM}×${w.side * ZOOM} crop`);
    return fromCrop(w, cx, cy);
  };
  const two = (ends: readonly [PointIn, PointIn], field: string): readonly [Pt, Pt] | Refusal => {
    const a = pt(ends[0], `${field}[0]`);
    if ('code' in a) return a;
    const b = pt(ends[1], `${field}[1]`);
    if ('code' in b) return b;
    if (a[0] === b[0] && a[1] === b[1]) return bad(field, 'its two ends are the same point');
    return [a, b];
  };
  let reference: readonly [Pt, Pt] | undefined;
  if (file.reference) {
    const r = two(file.reference, 'reference');
    if ('code' in r) return r;
    reference = r;
  }
  const figures: Record<string, Figure> = {};
  for (const [name, f] of Object.entries(file.figures)) {
    const at = `figures.${name}`;
    if (Array.isArray(f)) {
      const ends = two(f as readonly [PointIn, PointIn], at);
      if ('code' in ends) return ends;
      figures[name] = { kind: 'distance', ends };
      continue;
    }
    const g = f as Exclude<FigureIn, readonly [PointIn, PointIn]>;
    const line = two(g.line, `${at}.line`);
    if ('code' in line) return line;
    const point = pt(g.point, `${at}.point`);
    if ('code' in point) return point;
    let toward: Pt | undefined;
    if (g.toward !== undefined) {
      const t = pt(g.toward, `${at}.toward`);
      if ('code' in t) return t;
      if (t[0] === point[0] && t[1] === point[1]) return bad(`${at}.toward`, 'it is the same point as "point"');
      toward = t;
    }
    figures[name] = { kind: g.read, point, ...(toward ? { toward } : {}), line };
  }
  return { ...(file.grid ? { grid: file.grid } : {}), ...(reference ? { reference } : {}), figures, ...(file.paper ? { paper: file.paper } : {}) };
}

/** What needs the photo: a figure beyond two points, a crop point, a missing grid or reference (item 5). */
export function needsPhoto(file: PointsFile): string | null {
  if (!file.grid) return 'no "grid" in the points file, so the grid must be found in the photo';
  if (!file.reference) return 'no "reference" in the points file, so the medium straight must be found in the photo';
  if (!isPt(file.reference[0]) || !isPt(file.reference[1])) return 'the reference is read off a crop, which needs the photo';
  for (const [name, f] of Object.entries(file.figures)) {
    if (!Array.isArray(f)) return `figure "${name}" reads ${(f as { read: string }).read}, which needs the photo`;
    if (!isPt(f[0]) || !isPt(f[1])) return `figure "${name}" is read off a crop, which needs the photo`;
  }
  return null;
}

// ── The result ───────────────────────────────────────────────────────────────

/** One end: its point as given (`seed`) and as used (`at`), refined or kept by hand. */
export type End = (
  | { readonly seed: Pt; readonly at: Pt; readonly refined: true; readonly samples: number; readonly spreadMm: number }
  | { readonly seed: Pt; readonly at: Pt; readonly refined: false; readonly reason: string }
) & {
  /** A road's end moved across to the middle of its side edges, mm (centreAcross); absent where it couldn't be. */
  readonly acrossMm?: number;
};

export interface Why {
  readonly code: 'end-hand-read' | 'end-not-centred' | 'facing-not-checked' | 'reference-hand-read';
  readonly end?: string;
  readonly text: string;
}

export type FigureResult =
  | { readonly kind: Figure['kind']; readonly facing: 'checked' | 'not checked'; readonly valueMm: number; readonly status: 'checked' | 'provisional'; readonly why: readonly Why[]; readonly ends: readonly End[] }
  | { readonly kind: Figure['kind']; readonly facing: 'checked' | 'not checked'; readonly refused: Refusal; readonly ends: readonly End[] };

export interface GridUsed {
  readonly source: 'seeded' | 'found';
  readonly points: number;
  readonly rmsMm: number;
  readonly scale?: number;
  /** The crossings used, photo px: drawn on the overlay, left out of --json. */
  readonly crossings: readonly Pt[];
}

export type MeasureResult =
  | {
      readonly kind: 'measured';
      readonly photo: { readonly width: number; readonly height: number };
      readonly grid: GridUsed;
      readonly reference: { readonly source: 'given' | 'found'; readonly k: number; readonly ends: readonly [End, End] };
      readonly figures: Readonly<Record<string, FigureResult>>;
    }
  | {
      readonly kind: 'refused';
      readonly refused: Refusal;
      readonly photo: { readonly width: number; readonly height: number };
      readonly grid?: GridUsed;
      /** The reference's ends, when the run got that far: drawn on a refused run's overlay. */
      readonly referenceEnds?: readonly [End, End];
    };

// ── The core ─────────────────────────────────────────────────────────────────

const steps = ([lo, hi]: readonly [number, number]) => Array.from({ length: Math.floor((hi - lo) / 10) + 1 }, (_, i) => lo + 10 * i);
const fmt = (p: Pt) => `(${p[0].toFixed(1)}, ${p[1].toFixed(1)})`;
const paperDist = (map: FoundGrid['map'], a: Pt, b: Pt) => {
  const [pa, pb] = [pixelToPaper(map, a), pixelToPaper(map, b)];
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
};
const endOf = (seed: Pt, r: RefinedEnd | null, why = 'no clean edge found there'): End =>
  r ? { seed, at: r.px, refined: true, samples: r.samples, spreadMm: r.spreadMm } : { seed, at: seed, refined: false, reason: why };
const kept = (seed: Pt, why: string): End => ({ seed, at: seed, refined: false, reason: why });

/**
 * Every figure in one photo, or why the photo is refused. Pure: the points and the pixels in, one result out.
 * A warm paper (a warm lamp) is read balanced on itself; one as warm as wood is named only when the grid or the
 * reference still can't be read. Any other photo is read as loaded.
 */
export function measure(points: Points, img: RgbImage): MeasureResult {
  const warmth = paperWarmth(img), warm = warmth > WOOD_GREEN_OVER_BLUE;
  const r = measurePixels(points, warmth > BALANCE_ABOVE ? balanced(img) : img);
  if (r.kind === 'refused' && warm && (r.refused.code === 'grid-not-found' || r.refused.code === 'reference-unread')) {
    return { ...r, refused: refusal('paper-warm', `the paper reads ${warmth} green over blue, as warm as wood (over ${WOOD_GREEN_OVER_BLUE}), and ${r.refused.reason}: cream or yellow paper, or a very warm lamp`) };
  }
  return r;
}

function measurePixels(points: Points, img: RgbImage): MeasureResult {
  const photo = { width: img.width, height: img.height };
  const centre: Pt = [img.width / 2, img.height / 2];
  const inPhoto = ([x, y]: Pt) => x >= 0 && y >= 0 && x <= img.width - 1 && y <= img.height - 1;
  const refuse = (code: Code, reason: string, grid?: GridUsed, referenceEnds?: readonly [End, End]): MeasureResult =>
    ({ kind: 'refused', refused: refusal(code, reason), photo, ...(grid ? { grid } : {}), ...(referenceEnds ? { referenceEnds } : {}) });
  const used = (g: FoundGrid, source: GridUsed['source'], scale?: number): GridUsed =>
    ({ source, points: g.points.length, rmsMm: g.rmsMm, ...(scale !== undefined ? { scale } : {}), crossings: g.points.map((p) => p.px) });
  const outside = (field: string, p: Pt) => `${field} ${fmt(p)} is outside the photo, which is ${img.width}×${img.height} px upright`;

  for (const [i, g] of (points.grid ?? []).entries()) if (!inPhoto(g.px)) return refuse('point-outside', outside(`grid[${i}]`, g.px));
  for (const i of [0, 1] as const) if (points.reference && !inPhoto(points.reference[i])) return refuse('point-outside', outside(`reference[${i}]`, points.reference[i]));

  // The grid and the reference, by the scale table above.
  let grid: FoundGrid, gridUsed: GridUsed, refEnds: readonly [End, End], refSource: 'given' | 'found';
  const refineRef = (map: FoundGrid['map'], [a, b]: readonly [Pt, Pt]): readonly [End, End] =>
    [endOf(a, refineEnd(img, map, a, b)), endOf(b, refineEnd(img, map, b, a))];
  const kOf = (map: FoundGrid['map'], ends: readonly [End, End]) => REFERENCE_MM / paperDist(map, ends[0].at, ends[1].at);
  /** The medium straight found, or why not; a found one must have both ends read (as photoCheck asks). */
  const namedRef = (g: FoundGrid, tooWide: number, ref: Plank | undefined): MeasureResult | readonly [End, End] => {
    const at = used(g, points.grid ? 'seeded' : 'found');
    if (!ref) {
      return refuse('reference-unread', tooWide > 0
        ? 'no medium straight found: two pieces seem to touch, or something lies against it'
        : 'no medium straight (144mm) found', at);
    }
    const which = ref.refined[0] ? (ref.refined[1] ? null : 'second') : 'first';
    if (which) return refuse('reference-unread', `the medium straight's ${which} end couldn't be read: no shadow across it, nothing touching it`, at);
    return [endOf(ref.ends[0], ref.evidence[0]), endOf(ref.ends[1], ref.evidence[1])];
  };

  if (points.grid) {
    const paper = points.paper ?? { cols: [0, 180] as const, rows: [0, 280] as const };
    let seeded: FoundGrid | null = null;
    try {
      seeded = findGrid(img, points.grid, { cols: steps(paper.cols), rows: steps(paper.rows) });
    } catch {
      // A singular set of seeds: refused just below.
    }
    if (!seeded || !Number.isFinite(seeded.rmsMm)) return refuse('points-invalid', 'grid: the seeds give no usable map; check each seed\'s px and mm');
    grid = seeded;
    gridUsed = used(grid, 'seeded');
    if (points.reference) {
      refEnds = refineRef(grid.map, points.reference);
      refSource = 'given';
    } else {
      const wood = findWood(img, grid);
      const r = namedRef(grid, wood.tooWide, namePlanks(wood.planks).reference);
      if ('kind' in r) return r;
      refEnds = r;
      refSource = 'found';
    }
  } else if (points.reference) {
    const tried: string[] = [];
    let chosen: { grid: FoundGrid; ends: readonly [End, End]; scale: number } | null = null;
    let firstReason: string | null = null;
    for (const scale of [1, 2, 0.5]) {
      const f = findGridAuto(img, scale);
      if ('reason' in f) {
        firstReason ??= f.reason;
        continue;
      }
      const ends = refineRef(f.grid.map, points.reference);
      const k = kOf(f.grid.map, ends);
      tried.push(`k ${k.toFixed(3)} at scale ${scale}`);
      if (k >= K_PLAUSIBLE.min && k <= K_PLAUSIBLE.max) {
        chosen = { grid: f.grid, ends, scale };
        break;
      }
    }
    if (!chosen) {
      if (tried.length === 0) return refuse('grid-not-found', `no grid found at any scale: ${firstReason}`);
      return refuse('k-implausible', `the reference reads ${tried.join(', ')}; a medium straight lying flat reads ${K_PLAUSIBLE.min} to ${K_PLAUSIBLE.max}`);
    }
    grid = chosen.grid;
    gridUsed = used(grid, 'found', chosen.scale);
    refEnds = chosen.ends;
    refSource = 'given';
  } else {
    const found = gridAndPlanks(img);
    if ('reason' in found) return refuse('grid-not-found', `no grid found at any scale: ${found.reason}`);
    grid = found.grid;
    gridUsed = used(grid, 'found');
    const r = namedRef(grid, found.tooWide, found.planks.reference);
    if ('kind' in r) return r;
    refEnds = r;
    refSource = 'found';
  }

  // One rule for a seeded and a found grid (eng E1).
  const rmsMax = Math.min(AUTO_GRID_RMS_MAX_MM, GRID_RESIDUAL_MAX_MM);
  if (grid.rmsMm > rmsMax) return refuse('grid-rms', `the grid's ${grid.points.length} crossings disagree by ${grid.rmsMm.toFixed(2)}mm rms (limit ${rmsMax}mm): two sheets, or one not flat`, gridUsed);
  for (const [i, j] of [[0, 1], [1, 0]] as const) {
    if (!facesAway(img, refEnds[i].at, refEnds[j].at)) {
      return refuse('reference-faces-camera', `the medium straight's ${i === 0 ? 'first' : 'second'} end ${fmt(refEnds[i].at)} faces the camera (the photo's centre is ${fmt(centre)}), so it shows its end face and reads long`, gridUsed, refEnds);
    }
  }
  const k = kOf(grid.map, refEnds);
  if (!(k >= K_PLAUSIBLE.min && k <= K_PLAUSIBLE.max)) {
    return refuse('k-implausible', `the reference reads ${(REFERENCE_MM / k).toFixed(1)}mm on the paper (k ${Number.isFinite(k) ? k.toFixed(3) : 'not finite'}; a medium straight lying flat reads ${K_PLAUSIBLE.min} to ${K_PLAUSIBLE.max})`, gridUsed, refEnds);
  }
  const refWhy: Why[] = refEnds.flatMap((e, i) => (e.refined ? [] : [{ code: 'reference-hand-read' as const, end: i === 0 ? 'first' : 'second', text: `the reference's ${i === 0 ? 'first' : 'second'} end is a hand reading, so the scale is too` }]));

  const figures: Record<string, FigureResult> = {};
  for (const [name, f] of Object.entries(points.figures)) figures[name] = figure(f);
  return { kind: 'measured', photo, grid: gridUsed, reference: { source: refSource, k, ends: [refEnds[0], refEnds[1]] }, figures };

  function figure(f: Figure): FigureResult {
    const toPaper = (p: Pt) => pixelToPaper(grid.map, p);
    const line = f.kind === 'distance' ? f.ends : f.line;
    const labels = f.kind === 'distance' ? ['first end', 'second end'] as const : ['line a', 'line b'] as const;
    const refused = (code: Code, reason: string, ends: End[], facing: 'checked' | 'not checked', fix?: string): FigureResult =>
      ({ kind: f.kind, facing, refused: refusal(code, reason, fix), ends });
    // Every given point inside the photo first.
    const given: [string, Pt][] = [[labels[0], line[0]], [labels[1], line[1]]];
    if (f.kind !== 'distance') {
      given.push(['point', f.point]);
      if (f.toward) given.push(['toward', f.toward]);
    }
    const out = given.find(([, p]) => !inPhoto(p));
    if (out) {
      return refused('point-outside', outside(`the ${out[0]}`, out[1]), given.filter(([l]) => l !== 'toward').map(([, p]) => kept(p, inPhoto(p) ? 'not read: the figure was refused' : 'outside the photo')), 'not checked');
    }
    // Ends at least 1mm apart on the paper, and finite (eng G5b).
    const apart = (a: Pt, b: Pt) => { const d = paperDist(grid.map, a, b); return Number.isFinite(d) && d >= 1; };
    const notRead = given.filter(([l]) => l !== 'toward').map(([, p]) => kept(p, 'not read: the figure was refused'));
    if (!apart(line[0], line[1])) return refused('geometry', `the ${f.kind === 'distance' ? 'figure' : 'line'}'s two ends are under 1mm apart on the paper`, notRead, 'not checked');
    if (f.kind !== 'distance' && f.toward && !apart(f.point, f.toward)) return refused('geometry', '"point" and "toward" are under 1mm apart on the paper', notRead, 'not checked');

    // A road's ends: centred across the road first (a pick a few px off-centre moves offset and along), then refined along it.
    const across = [centreAcross(img, grid.map, line[0], line[1]), centreAcross(img, grid.map, line[1], line[0])] as const;
    const placed = [across[0]?.px ?? line[0], across[1]?.px ?? line[1]] as const;
    const withAcross = (e: End, c: (typeof across)[number]): End => (c ? { ...e, seed: e.seed, acrossMm: c.shiftMm } : e);
    const a = withAcross({ ...endOf(placed[0], refineEnd(img, grid.map, placed[0], placed[1])), seed: line[0] }, across[0]);
    const b = withAcross({ ...endOf(placed[1], refineEnd(img, grid.map, placed[1], placed[0])), seed: line[1] }, across[1]);
    const ends: End[] = [a, b];
    const why: Why[] = [...refWhy];
    across.forEach((c, i) => {
      if (!c) why.push({ code: 'end-not-centred', end: labels[i], text: `the ${labels[i]} could not be centred across its road (its side edges not found 4-10mm in), so it is where it was picked` });
    });
    const faceFix = (what: string) => `${what}; the photo is uncropped, taken from above the middle of the sheet`;
    for (const [e, other, label] of [[a, b, labels[0]], [b, a, labels[1]]] as const) {
      if (!facesAway(img, e.at, other.at)) {
        return refused('faces-camera', `the ${label} ${fmt(e.at)} faces the camera (the photo's centre is ${fmt(centre)}), so it shows its end face and reads long`, ends, 'checked', faceFix('lay the piece across the middle of the photo and retake'));
      }
      if (!e.refined) why.push({ code: 'end-hand-read', end: label, text: `the ${label} is a hand reading` });
    }
    let facing: 'checked' | 'not checked' = 'checked';
    let valueMm: number;
    if (f.kind === 'distance') {
      valueMm = k * paperDist(grid.map, a.at, b.at);
    } else {
      let p: End;
      if (f.toward) {
        p = endOf(f.point, refineEnd(img, grid.map, f.point, f.toward));
        ends.push(p);
        if (!facesAway(img, p.at, f.toward)) {
          return refused('faces-camera', `the point ${fmt(p.at)} faces the camera, seen from its toward ${fmt(f.toward)} (the photo's centre is ${fmt(centre)})`, ends, 'checked', faceFix('check that "toward" lies back along the same road; if it does, retake with the piece across the middle'));
        }
        if (!p.refined) why.push({ code: 'end-hand-read', end: 'point', text: 'the point is a hand reading' });
      } else {
        p = kept(f.point, 'no "toward" given, so it was not refined');
        ends.push(p);
        facing = 'not checked';
        why.push({ code: 'facing-not-checked', end: 'point', text: 'the point has no "toward", so its facing is not checked and it is a hand reading' });
      }
      const oa = offsetAlong(toPaper(p.at), toPaper(a.at), toPaper(b.at));
      valueMm = k * (f.kind === 'offset' ? oa.offset : oa.along);
    }
    if (!Number.isFinite(valueMm)) return refused('geometry', 'the figure reads a non-finite length', ends, facing);
    return { kind: f.kind, facing, valueMm, status: why.length === 0 ? 'checked' : 'provisional', why, ends };
  }
}

// ── The command line ─────────────────────────────────────────────────────────

export const HELP = `usage: bun engine/tools/photoMeasure.ts <points.json> --photo <photo> [--json] [--overlay <path>]
       bun engine/tools/photoMeasure.ts <points.json>          (only plain [a, b] figures, with "grid" and "reference" given)

  --photo <photo>   the photo the points were read on (--auto is the same)
  --json            one JSON object on stdout instead of text (progress stays on stderr)
  --overlay <path>  a picture of the points used: a folder (it writes <points>.overlay.png
                    there) or a path ending .overlay.png
  --help            this text

points.json: points are photo pixels [x, y] of the photo as a phone shows it
(upright), or { "crop": "<crop file>", "at": [cx, cy] } read off a crop that
photoCrop.ts made of the same photo. Leave out "grid" and "reference" to have
them found. The smallest file, one distance:
  { "figures": { "through": [{ "crop": "t.crop-1150-770-120.png", "at": [241, 236] }, [1780.5, 3310]] } }
A figure is [a, b] (the distance), or { point, toward?, line: [a, b], read }:
  { "figures": {
      "out":   { "point": [2210, 2120], "toward": [2160, 2140], "line": [[1210, 830], [1780.5, 3310]], "read": "offset" },
      "along": { "point": [2210, 2120], "toward": [2160, 2140], "line": [[1210, 830], [1780.5, 3310]], "read": "along" } } }
"offset" is how far the point is from the line (never negative), "along" how
far along it from a towards b its foot lies (negative before a). "toward" is a
point on the same road's centreline at least 20mm back from the end; without
it the point is not refined and its facing is not checked.
Optional: "grid": [{ "px": [x, y], "mm": [u, v] }, ...] seeds, "reference":
[a, b] the medium straight's end centres, "paper": { "cols": [0, 180], "rows": [0, 280] }.

exit: 0 every figure read · 1 the run refused · 2 bad usage · 3 a figure refused

A refusal prints its code, what happened with the values that caused it, and
the fix on its last line. Codes (recovery, fix):
${Object.entries(CODES).map(([c, v]) => `  ${c.padEnd(23)}${v.recovery.padEnd(12)}${v.fix}`).join('\n')}

Every code and its fix: .claude/skills/draw-piece/SKILL.md, "Measure codes".`;

export interface Io {
  readonly load: (photo: string) => RgbImage;
  readonly read: (file: string) => string;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const IO: Io = { load: (p) => loadUpright(p), read: (f) => readFileSync(f, 'utf8'), out: (l) => console.log(l), err: (l) => console.error(l) };

/** Prints a refusal: code first, what happened with its values, the fix last. */
const say = (print: (l: string) => void, head: 'REFUSED' | 'USAGE', r: Refusal) => print(`${head} ${r.code}: ${r.reason}\n${r.fix}`);

function render(r: Extract<MeasureResult, { kind: 'measured' }>, out: (l: string) => void): number {
  const endText = (label: string, e: End) => `  ${label}: ${e.refined ? `${e.samples} edge samples, spread ${e.spreadMm.toFixed(3)}mm` : `hand reading kept (${e.reason})`}`;
  out(`photo: ${r.photo.width}×${r.photo.height} px, upright`);
  out(`grid: ${r.grid.source}${r.grid.scale !== undefined ? ` (scale ${r.grid.scale})` : ''}, ${r.grid.points} crossings, rms ${r.grid.rmsMm.toFixed(3)}mm`);
  out(`reference: ${r.reference.source}, k = ${r.reference.k.toFixed(4)}`);
  r.reference.ends.forEach((e, i) => out(endText(i === 0 ? 'first end' : 'second end', e)));
  let refused = 0;
  for (const [name, f] of Object.entries(r.figures)) {
    if ('refused' in f) {
      refused++;
      out(`${name}: REFUSED ${f.refused.code}: ${f.refused.reason}`);
      out(`  ${f.refused.fix}`);
      continue;
    }
    out(`${name}: ${f.valueMm.toFixed(2)}mm ${f.kind === 'distance' ? '' : `(${f.kind}) `}${f.status}${f.why.length ? `: ${f.why.map((w) => w.text).join('; ')}` : ''}`);
    const labels = f.kind === 'distance' ? ['first end', 'second end'] : ['line a', 'line b', 'point'];
    f.ends.forEach((e, i) => out(endText(labels[i]!, e)));
  }
  return refused > 0 ? 3 : 0;
}

/** --json's object (item 10): one per run, on stdout. The grid's crossings stay out; their count is in. */
export function toJson(r: MeasureResult, overlay?: { path: string; key: readonly KeyRow[] }): object {
  const grid = r.grid && { source: r.grid.source, points: r.grid.points, rmsMm: r.grid.rmsMm, ...(r.grid.scale !== undefined ? { scale: r.grid.scale } : {}) };
  const tail = overlay ? { overlay } : {};
  if (r.kind === 'refused') return { schema: 1, refused: r.refused, photo: r.photo, ...(grid ? { grid } : {}), ...tail };
  return { schema: 1, photo: r.photo, grid, reference: r.reference, figures: r.figures, ...tail };
}

/** Where --overlay writes: a folder (then <points>.overlay.png in it) or a path ending .overlay.png (DX D13). */
export function overlayPath(arg: string, pointsFile: string): string | Refusal {
  const stem = basename(pointsFile, extname(pointsFile));
  const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };
  if (isDir(arg)) return join(arg, `${stem}.overlay.png`);
  if (arg.endsWith('.overlay.png') && isDir(dirname(resolve(arg)))) return arg;
  return refusal('overlay-path', `--overlay ${arg} is neither a folder nor a path ending .overlay.png in an existing folder`, `use --overlay ${join(dirname(pointsFile), `${stem}.overlay.png`)} (or any folder)`);
}

/** Written whole or not at all: a temp file beside the target, then renamed (eng G8b). */
export function writeWhole(path: string, bytes: Uint8Array): void {
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, bytes);
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** The command line: parse, load, measure, print, and the exit code. */
export function main(argv: readonly string[], io: Io = IO): number {
  // --json first, so even a usage error is one JSON object (DX D10).
  const json = argv.includes('--json');
  const emitRefusal = (head: 'REFUSED' | 'USAGE', r: Refusal) =>
    json ? io.out(JSON.stringify(head === 'USAGE' ? { schema: 1, usage: { code: r.code, message: r.reason, fix: r.fix } } : { schema: 1, refused: r }))
      : say(io.err, head, r);
  try {
    if (argv.includes('--help') || argv.includes('-h')) {
      io.out(HELP);
      return 0;
    }
    const usage = (code: Code, reason: string, fix?: string) => (emitRefusal('USAGE', refusal(code, reason, fix)), 2);
    let file: string | undefined, photo: string | undefined, overlayArg: string | undefined;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i]!;
      if (a === '--photo' || a === '--auto' || a === '--overlay') {
        const v = argv[++i];
        if (v === undefined || v.startsWith('--')) return usage('usage', `${a} needs a ${a === '--overlay' ? 'path' : 'photo'} after it`);
        if (a === '--overlay') overlayArg = v;
        else photo = v;
      } else if (a === '--json') continue;
      else if (a.startsWith('-')) return usage('usage', `unknown flag ${a}`);
      else if (file === undefined) file = a;
      else return usage('usage', `one points file only, got ${file} and ${a}`);
    }
    if (!file) return usage('usage', 'no points file given');
    if (overlayArg !== undefined && !photo) return usage('needs-photo', '--overlay draws on the photo');
    let text: string;
    try {
      text = io.read(file);
    } catch (e) {
      return usage('points-invalid', `can't read the points file ${file}: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`, 'check the path to the points file');
    }
    const parsed = parsePoints(text);
    if ('code' in parsed) return (emitRefusal('USAGE', parsed), 2);
    if (!photo) {
      const why = needsPhoto(parsed);
      if (why) return usage('needs-photo', why);
      // Today's plain path: hand-read grid points, no photo (photo.ts).
      const r = measurePhoto(parsed as PhotoInput);
      if (r.kind === 'refused') {
        const code: Code = /grid points disagree/.test(r.reason) ? 'grid-rms' : /reference reads/.test(r.reason) ? 'k-implausible' : 'points-invalid';
        return (emitRefusal('REFUSED', refusal(code, r.reason)), 1);
      }
      if (json) io.out(JSON.stringify({ schema: 1, k: r.k, gridResidualMm: r.gridResidualMm, figures: r.figures }));
      else {
        io.out(`scale k = ${r.k.toFixed(4)}, grid agrees to ${r.gridResidualMm.toFixed(2)}mm`);
        for (const [name, mm] of Object.entries(r.figures)) io.out(`${name}: ${mm.toFixed(2)}mm`);
      }
      return 0;
    }
    const overlayAt = overlayArg === undefined ? undefined : overlayPath(overlayArg, file);
    if (overlayAt !== undefined && typeof overlayAt !== 'string') return (emitRefusal('USAGE', overlayAt), 2);
    const points = resolvePoints(parsed, dirname(resolve(file)), photo);
    if ('code' in points) return (emitRefusal('USAGE', points), 2);
    let img: RgbImage;
    try {
      img = io.load(photo);
    } catch (e) {
      if (!(e instanceof PhotoError)) throw e;
      return (emitRefusal('REFUSED', refusal(e.code, e.message, e.fix)), 1);
    }
    const t0 = Date.now();
    const r = measure(points, img);
    io.err(`measured in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    // The overlay is drawn for a refused run too: that is when it helps most.
    let overlay: { path: string; key: KeyRow[] } | undefined;
    if (overlayAt !== undefined) {
      const { image, key } = drawOverlay(img, points, r);
      writeWhole(overlayAt, writePng(image));
      overlay = { path: overlayAt, key };
    }
    const code = r.kind === 'refused' ? (r.refused.code === 'points-invalid' ? 2 : 1)
      : Object.values(r.figures).some((f) => 'refused' in f) ? 3 : 0;
    if (json) {
      io.out(JSON.stringify(toJson(r, overlay)));
      return code;
    }
    if (r.kind === 'refused') say(io.err, 'REFUSED', r.refused);
    else render(r, io.out);
    if (overlay) {
      io.out(`overlay: ${overlay.path}`);
      for (const k of overlay.key) io.out(`  ${k.colour} ring: ${k.figure}, ${k.end}`);
      io.out('  red dots: grid crossings used; black squares: the reference\'s ends');
    }
    return code;
  } catch (e) {
    // Anything unexpected: a code, a trace on disk, never a bare stack (DX D11); the trace stays out of --json (eng G13).
    const trace = join(mkdtempSync(join(tmpdir(), 'photoMeasure-')), 'trace.txt');
    writeFileSync(trace, (e as Error).stack ?? String(e));
    emitRefusal('REFUSED', refusal('internal', `${(e as Error).message} (trace: ${trace})`));
    return 1;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
