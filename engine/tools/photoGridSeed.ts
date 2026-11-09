/**
 * THE GRID'S FIRST POINTS, FOUND WITHOUT A HAND (community-pieces plan, eng D5):
 * findGrid needs a few seed crossings; a contributor's photo arrives with none.
 *
 *   central half of the photo, wood skipped (nearly the whole photo when a large piece hides it)
 *        │  for each angle θ in [-45°, 45°): line darkness projected on θ's normal
 *        ▼
 *   the angle whose profile is most peaked = one family of lines; θ + 90° the other
 *        │  in each profile: the strong peaks' spacing, made exact by the 1mm
 *        │  lines when they show; a comb picks the peak most lines agree with,
 *        │  then steps peak to peak towards the middle (perspective changes the pitch)
 *        ▼
 *   12 crossings near where the two lines found meet (the anchor), clear of wood
 *        │  findGrid, ring by ring: ±30, 60, 120mm, then the whole photo,
 *        │  each ring predicted from a fit of the one before
 *        ▼
 *   every crossing, labelled in paper mm
 *
 * The labels are relative (the anchor is 0, 0): a check needs lengths, not
 * where on the sheet the pieces lie.
 */

import type { GridPoint, Pt } from './photo.js';
import { findGrid, pixelToPaper, WOOD_GREEN_OVER_BLUE, type FoundGrid } from './photoGrid.js';
import type { RgbImage } from './photoImage.js';

/** Samples every this many pixels while searching angles. */
const STRIDE = 3;
/** Width of the moving average a profile is measured against, in profile bins (px). */
const TREND = 25;

/**
 * Paper and its grid ink, blue or red, have green within a little of blue;
 * wood, a wooden table, a patterned cloth's oranges and leaves have green well
 * above it (WOOD_GREEN_OVER_BLUE), and their edges would read as lines. Pixels
 * darker than this are a shadow or a dark object, not paper.
 */
const PAPER_MIN_BRIGHTNESS = 90;

/** How far from wood a pixel must be to count, px: a plank's shadow is grey, as dark as a line. */
const SHADOW = 15;

/** Every pixel within SHADOW of wood, as a mask (a box dilation, rows then columns). */
const nearWoodCache = new WeakMap<RgbImage, Uint8Array>();
function nearWood(img: RgbImage): Uint8Array {
  const cached = nearWoodCache.get(img);
  if (cached) return cached;
  const { width: w, height: h, rgb } = img;
  const wood = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) wood[k] = rgb[3 * k + 1]! - rgb[3 * k + 2]! > WOOD_GREEN_OVER_BLUE ? 1 : 0;
  // Along rows: a running count of wood in the window [x - SHADOW, x + SHADOW].
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = -SHADOW; x < w; x++) {
      if (x + SHADOW < w) n += wood[y * w + x + SHADOW]!;
      if (x - SHADOW - 1 >= 0) n -= wood[y * w + x - SHADOW - 1]!;
      if (x >= 0) rows[y * w + x] = n > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = -SHADOW; y < h; y++) {
      if (y + SHADOW < h) n += rows[(y + SHADOW) * w + x]!;
      if (y - SHADOW - 1 >= 0) n -= rows[(y - SHADOW - 1) * w + x]!;
      if (y >= 0) out[y * w + x] = n > 0 ? 1 : 0;
    }
  }
  nearWoodCache.set(img, out);
  return out;
}

/** Darkness (255 less the darkest channel, so any ink reads) at a pixel, NaN off the paper (wood and its shadow, background) or outside. */
function darkness(img: RgbImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return NaN;
  const i = (y * img.width + x) * 3;
  const [r, g, b] = [img.rgb[i]!, img.rgb[i + 1]!, img.rgb[i + 2]!];
  if (g - b > WOOD_GREEN_OVER_BLUE || Math.max(r, g, b) < PAPER_MIN_BRIGHTNESS || nearWood(img)[y * img.width + x]) return NaN;
  return 255 - Math.min(r, g, b);
}

export interface Profile {
  /** Mean darkness per 1px bin along the normal, minus its moving average. */
  readonly values: Float64Array;
  /** The normal coordinate of bin 0. */
  readonly t0: number;
}

/**
 * Where the lines are looked for, as the share of the photo left out on each
 * side: the central half first; nearly the whole photo when a large piece
 * covers the middle (a station's roof filled it, 2026-11-09).
 */
export const CENTRAL = 1 / 4, WIDE = 1 / 16;

/** The darkness inside the window `inset` from each side, projected on the normal at angle `deg` (degrees). */
export function profile(img: RgbImage, deg: number, stride = STRIDE, inset = CENTRAL): Profile {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  const x0 = Math.floor(img.width * inset), x1 = Math.ceil(img.width * (1 - inset));
  const y0 = Math.floor(img.height * inset), y1 = Math.ceil(img.height * (1 - inset));
  const ts = [x0 * c + y0 * s, x1 * c + y0 * s, x0 * c + y1 * s, x1 * c + y1 * s];
  const t0 = Math.floor(Math.min(...ts)), n = Math.ceil(Math.max(...ts)) - t0 + 1;
  const sum = new Float64Array(n), count = new Float64Array(n);
  // Every row, but every `stride`th pixel along it, staggered row by row: a fixed
  // grid of samples leaves most 1px bins empty when the lines are square to it.
  for (let y = y0; y < y1; y++) {
    for (let x = x0 + (y % stride); x < x1; x += stride) {
      const d = darkness(img, x, y);
      if (Number.isNaN(d)) continue;
      const b = Math.round(x * c + y * s) - t0;
      sum[b]! += d;
      count[b]! += 1;
    }
  }
  // A bin few pixels reach (the edge of the window, a strip beside the wood) is
  // mostly noise; under 30% of the typical count it is left out.
  const counts = Array.from(count).filter((c) => c > 0).sort((x, y) => x - y);
  const enough = counts.length > 0 ? 0.3 * counts[Math.floor(counts.length / 2)]! : 1;
  const mean = new Float64Array(n);
  for (let b = 0; b < n; b++) mean[b] = count[b]! >= enough ? sum[b]! / count[b]! : NaN;
  const values = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    let acc = 0, k = 0;
    for (let j = Math.max(0, b - TREND); j <= Math.min(n - 1, b + TREND); j++) {
      if (!Number.isNaN(mean[j]!)) { acc += mean[j]!; k++; }
    }
    values[b] = Number.isNaN(mean[b]!) || k === 0 ? 0 : mean[b]! - acc / k;
  }
  return { values, t0 };
}

/** How peaked a profile is: the variance of its detrended values. */
function peakedness(p: Profile): number {
  let s = 0;
  for (const v of p.values) s += v * v;
  return s / p.values.length;
}

/**
 * The angle in [lo, hi] whose profile is most peaked, searched at `step`
 * degrees; with `both`, scored on θ and θ + 90° together, since a grid's two
 * families are square to each other and one noisy direction alone can win.
 */
function bestAngle(img: RgbImage, lo: number, hi: number, step: number, both = false, inset = CENTRAL): number {
  let best = lo, score = -Infinity;
  for (let a = lo; a <= hi + 1e-9; a += step) {
    const sc = peakedness(profile(img, a, STRIDE, inset)) + (both ? peakedness(profile(img, a + 90, STRIDE, inset)) : 0);
    if (sc > score) { score = sc; best = a; }
  }
  return best;
}

export interface LineFamily {
  /** The lines' normal, degrees. */
  readonly deg: number;
  /** The 10mm pitch along the normal, px. */
  readonly pitch: number;
  /** The normal coordinate of the 10mm line nearest the middle. */
  readonly t: number;
}

/** The profile's autocorrelation at `lag`, per overlapping bin. */
function autocorr(v: Float64Array, lag: number): number {
  let s = 0;
  for (let i = 0; i + lag < v.length; i++) s += v[i]! * v[i + lag]!;
  return s / (v.length - lag);
}

/** Pitches searched for the strong lines, px: 5mm at 4px/mm to 10mm at 40px/mm. */
const PITCH = { min: 20, max: 400 } as const;

/** A peak at least this share of the strongest is a strong (5mm or 10mm) line. */
const STRONG = 0.6;

/** The strong lines by their peaks: their pitch and positions, or null when they aren't regular. */
function strongPeaks(v: Float64Array): { pitch: number; peaks: number[] } | null {
  const peaks: { at: number; s: number }[] = [];
  for (let b = 2; b < v.length - 2; b++) {
    // Strictly above the bin before, so a flat top counts once.
    if (v[b]! > 0 && v[b]! > v[b - 1]! && v[b]! >= v[b + 1]! && v[b]! > v[b - 2]! && v[b]! > v[b + 2]!) {
      // Sub-pixel: a parabola through the peak and its neighbours.
      const den = v[b - 1]! - 2 * v[b]! + v[b + 1]!;
      peaks.push({ at: b + (den !== 0 ? (0.5 * (v[b - 1]! - v[b + 1]!)) / den : 0), s: v[b]! });
    }
  }
  if (peaks.length < 3) return null;
  const top = Math.max(...peaks.map((q) => q.s));
  const strong = peaks.filter((q) => q.s >= STRONG * top).map((q) => q.at).sort((a, b) => a - b);
  if (strong.length < 3) return null;
  const gaps = strong.slice(1).map((a, i) => a - strong[i]!);
  // The pitch: the median of the gaps no wider than 1.5 times the narrowest (a hidden line doubles a gap).
  const narrow = Math.min(...gaps);
  const regular = gaps.filter((g) => g <= 1.5 * narrow).sort((a, b) => a - b);
  if (regular.length < 2) return null;
  const pitch = regular[Math.floor(regular.length / 2)]!;
  // Under PITCH.min the "strong" lines are 1mm lines or noise, not 5mm or 10mm ones: leave it to strongRepeat.
  if (pitch < PITCH.min || regular.some((g) => Math.abs(g - pitch) > 0.2 * pitch)) return null;
  return { pitch, peaks: strong };
}

/** The strong lines by periodicity, when peak picking fails (a few strong edges among faint lines): the fundamental repeat. */
function strongRepeat(v: Float64Array): { pitch: number } | null {
  const zero = autocorr(v, 0);
  if (zero <= 0) return null;
  const top = Math.min(PITCH.max, Math.floor(v.length / 3));
  const maxima: { lag: number; r: number }[] = [];
  for (let lag = PITCH.min; lag <= top; lag++) {
    const r = autocorr(v, lag);
    if (r > autocorr(v, lag - 1) && r >= autocorr(v, lag + 1)) maxima.push({ lag, r });
  }
  if (maxima.length === 0) return null;
  const best = Math.max(...maxima.map((m) => m.r));
  if (best < 0.2 * zero) return null;
  // The fundamental: the shortest lag nearly as strong as the strongest (its multiples repeat too).
  return { pitch: maxima.find((m) => m.r >= 0.6 * best)!.lag };
}

/** How many pitches either side of a line its comb reaches: enough to outvote a lone false peak, few enough that perspective (the pitch changing across the photo) doesn't smear it. */
const COMB_REACH = 5;

/** The darkness a comb of teeth `pitch` apart collects within COMB_REACH pitches of bin `o`. */
function combScore(v: Float64Array, pitch: number, o: number): number {
  let sum = 0;
  for (let k = -COMB_REACH; k <= COMB_REACH; k++) {
    const t = o + k * pitch, b = Math.floor(t), f = t - b;
    if (b >= 0 && b + 1 < v.length) sum += v[b]! * (1 - f) + v[b + 1]! * f;
  }
  return sum;
}

/**
 * Where a strong line sits, as near bin `mid` as one shows. Of the strong
 * peaks, the one whose comb collects the most darkness is surely a line (a
 * false peak, such as a plank's edge shadow, has few lines in step with it);
 * from there, step a pitch at a time towards the middle, moving onto the strong
 * peak at each step, so the steps follow perspective (the pitch changing across
 * the photo). The answer is the last peak reached: a real line, never a guess
 * carried across wood, where the pitch may have changed. With no peaks
 * (strongRepeat), the comb tries every quarter bin.
 */
function strongPhase(v: Float64Array, pitch: number, peaks: readonly number[] | undefined, mid: number): number {
  const candidates = peaks ?? Array.from({ length: Math.ceil(v.length * 4) }, (_, k) => k / 4);
  const best = candidates.reduce((a, b) => (combScore(v, pitch, b) > combScore(v, pitch, a) ? b : a));
  if (!peaks) return best + pitch * Math.round((mid - best) / pitch);
  let at = best, reached = best, step = pitch;
  while (Math.abs(mid - at) > step / 2) {
    const guess = at + Math.sign(mid - at) * step;
    const snap = peaks.reduce((a, b) => (Math.abs(b - guess) < Math.abs(a - guess) ? b : a));
    if (Math.abs(snap - guess) < pitch / 6) {
      step = Math.abs(snap - at);
      at = reached = snap;
    } else {
      at = guess;
    }
  }
  return reached;
}

/**
 * The 10mm lines in one direction, or null when no regular lines show. The
 * strong lines by their peaks (by periodicity when that fails); on paper whose
 * 5mm lines print as dark as its 10mm ones, the 1mm lines give the 10mm pitch
 * exactly. Any factor of two left (no 1mm lines) is settled by the reference
 * straight's length, in photoCheck.ts.
 */
export function lineFamily(img: RgbImage, deg: number, inset = CENTRAL): LineFamily | null {
  const p = profile(img, deg, 1, inset);
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  const mid = (img.width / 2) * c + (img.height / 2) * s - p.t0;
  const peaks = strongPeaks(p.values);
  const strong = peaks ?? strongRepeat(p.values);
  if (!strong) return null;
  const mm = millimetrePitch(p.values, strong.pitch);
  // With the 1mm lines the comb runs at the exact 10mm pitch, so it lands on the
  // 10mm lines (darker) rather than the 5mm ones between them.
  const pitch = mm === null ? strong.pitch : 10 * mm;
  return { deg, pitch, t: strongPhase(p.values, pitch, peaks?.peaks, mid) + p.t0 };
}

/**
 * The 1mm line pitch, px, from the profile's autocorrelation, or null when no
 * 1mm lines show. Usually the first clear peak at a lag of a twentieth to a
 * fifth of the strong-line pitch (the strong repeat being 5, 10 or 20mm). On
 * paper whose 1mm lines print nearly as dark as the rest, the "strong" lines
 * can be any few millimetres apart (one photo read them 3mm apart); then a
 * strong repeat dividing the strong pitch three or more times is taken.
 */
function millimetrePitch(v: Float64Array, strongPitch: number): number | null {
  const usual = repeatUnder(v, Math.max(3, Math.floor(strongPitch / 21)), Math.ceil(strongPitch / 4.5), 0.15);
  const ratio = usual === null ? 0 : strongPitch / usual;
  if (usual !== null && Math.abs(ratio - Math.round(ratio)) < 0.15 && [5, 10, 20].includes(Math.round(ratio))) return usual;
  // At least three to the strong pitch: half of it is the 5mm lines between 10mm ones.
  const dark = repeatUnder(v, 3, Math.floor(strongPitch / 2.5), 0.5);
  const r = dark === null ? 0 : strongPitch / dark;
  return dark !== null && Math.abs(r - Math.round(r)) < 0.15 ? dark : null;
}

/**
 * The first autocorrelation peak at a lag in [lo, hi] at least `share` of the
 * zero lag, refined over ten pitches, where one lag's rounding is a tenth as
 * large; null when there is none.
 */
function repeatUnder(v: Float64Array, lo: number, hi: number, share: number): number | null {
  const ac = (lag: number) => autocorr(v, lag);
  const zero = ac(0);
  if (zero <= 0) return null;
  // A peak's position to a fraction of a lag: a parabola through it and its neighbours.
  const subLag = (lag: number) => {
    const [a, b, c] = [ac(lag - 1), ac(lag), ac(lag + 1)];
    const den = a - 2 * b + c;
    return den !== 0 ? lag + (0.5 * (a - c)) / den : lag;
  };
  // The first clear peak is the pitch; later ones are its multiples.
  let at = 0;
  for (let lag = lo; lag <= hi; lag++) {
    const r = ac(lag);
    if (r > ac(lag - 1) && r >= ac(lag + 1) && r >= share * zero) { at = subLag(lag); break; }
  }
  if (at === 0) return null;
  // Ten pitches out the peak is within 10% of 10·at; its position over 10 is the pitch, ten times finer.
  let tenBest = -Infinity, tenAt = 0;
  for (let lag = Math.floor(9 * at); lag <= Math.ceil(11 * at); lag++) {
    const r = ac(lag);
    if (r > ac(lag - 1) && r >= ac(lag + 1) && r > tenBest) { tenBest = r; tenAt = lag; }
  }
  return tenAt === 0 ? null : subLag(tenAt) / 10;
}

/** Where line `ia` of family A meets line `ib` of family B, px. */
function meet(a: LineFamily, ia: number, b: LineFamily, ib: number): Pt {
  const ra = (a.deg * Math.PI) / 180, rb = (b.deg * Math.PI) / 180;
  const ta = a.t + ia * a.pitch, tb = b.t + ib * b.pitch;
  const det = Math.cos(ra) * Math.sin(rb) - Math.sin(ra) * Math.cos(rb);
  return [(ta * Math.sin(rb) - tb * Math.sin(ra)) / det, (Math.cos(ra) * tb - Math.cos(rb) * ta) / det];
}

/** How many seeds, how far out to look for them (10mm lines), and how close wood may come (px). */
const SEEDS = 12, REACH = 12, CLEAR = 42;

/** True when no wood lies within CLEAR px of a point (the pieces lie across the middle, by the guide). */
function clearOfWood(img: RgbImage, [x, y]: Pt): boolean {
  for (let dy = -CLEAR; dy <= CLEAR; dy += 3) {
    for (let dx = -CLEAR; dx <= CLEAR; dx += 3) {
      const xx = Math.round(x + dx), yy = Math.round(y + dy);
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) return false;
      const i = (yy * img.width + xx) * 3;
      if (img.rgb[i + 1]! - img.rgb[i + 2]! > WOOD_GREEN_OVER_BLUE) return false;
    }
  }
  return true;
}

/** The two families of 10mm lines inside the window `inset` from each side, or null when either doesn't show. */
function families(img: RgbImage, inset: number): readonly [LineFamily, LineFamily] | null {
  const coarse = bestAngle(img, -45, 44, 1, true, inset);
  const degA = bestAngle(img, coarse - 1, coarse + 1, 0.1, false, inset);
  const degB = bestAngle(img, degA + 87, degA + 93, 0.1, false, inset);
  const fa = lineFamily(img, degA, inset), fb = lineFamily(img, degB, inset);
  return fa && fb ? [fa, fb] : null;
}

/** Each photo's families, found once: photoCheck.ts asks again at each scale, and they don't depend on it. */
const familiesCache = new WeakMap<RgbImage, readonly [LineFamily, LineFamily] | null>();

/**
 * Twelve seed crossings near the anchor crossing (where the two families' lines
 * found nearest the middle meet) and clear of wood, labelled in relative paper
 * mm (the anchor is 0, 0), or why none could be found.
 */
export function seedGrid(img: RgbImage, scale = 1): { seeds: GridPoint[] } | { reason: string } {
  if (!familiesCache.has(img)) familiesCache.set(img, families(img, CENTRAL) ?? families(img, WIDE));
  const found = familiesCache.get(img);
  if (!found) return { reason: 'no regular grid lines found: is the millimetre paper flat and in focus?' };
  const [fa, fb] = found;
  // `scale` corrects a 10mm pitch read at 5mm or 20mm (photoCheck.ts retries with 2 and 0.5).
  const a = { ...fa, pitch: fa.pitch * scale }, b = { ...fb, pitch: fb.pitch * scale };
  // Seeds gather round the crossing of the two lines found (0, 0): the families
  // are straight lines at one pitch, exact there and drifting with perspective away from it.
  const mid = meet(a, 0, b, 0);
  const candidates: GridPoint[] = [];
  for (let i = -REACH; i <= REACH; i++) {
    for (let j = -REACH; j <= REACH; j++) {
      const px = meet(a, i, b, j);
      if (clearOfWood(img, px)) candidates.push({ px, mm: [10 * i, 10 * j] });
    }
  }
  const byDistance = candidates.sort((p, q) => Math.hypot(p.px[0] - mid[0], p.px[1] - mid[1]) - Math.hypot(q.px[0] - mid[0], q.px[1] - mid[1]));
  const seeds = byDistance.slice(0, SEEDS);
  // Seeds all on one line can't fix a perspective (a gap between two planks
  // shows one column of grid): take nearer crossings off it until three
  // different lines show each way.
  for (const axis of [0, 1] as const) {
    const lines = () => new Set(seeds.map((q) => q.mm[axis])).size;
    for (const q of byDistance) {
      if (lines() >= 3) break;
      if (!seeds.some((p) => p.mm[axis] === q.mm[axis])) seeds.push(q);
    }
  }
  if (seeds.length < 6 || new Set(seeds.map((q) => q.mm[0])).size < 3 || new Set(seeds.map((q) => q.mm[1])).size < 3) {
    return { reason: 'too little of the grid shows near the middle of the photo: keep a ring of grid around the pieces' };
  }
  return { seeds };
}

/**
 * How far out each pass of findGrid looks, mm either way of the anchor: each
 * ring is predicted from a fit of the one before, so perspective and a page's
 * gentle bend are followed outwards instead of guessed from the seeds alone.
 */
const RINGS = [30, 60, 120, 400] as const;

/** The whole grid, from seeds found here, grown ring by ring out to every crossing the photo can hold. */
export function findGridAuto(img: RgbImage, scale = 1): { grid: FoundGrid } | { reason: string } {
  const seeded = seedGrid(img, scale);
  if ('reason' in seeded) return seeded;
  let points: readonly GridPoint[] = seeded.seeds;
  let grid: FoundGrid | null = null;
  for (const ring of RINGS) {
    let cols: number[], rows: number[];
    if (grid) {
      // No further than the photo reaches on the paper, from the last fit.
      const corners = ([[0, 0], [img.width, 0], [0, img.height], [img.width, img.height]] as Pt[]).map((p) => pixelToPaper(grid!.map, p));
      const range = (lo: number, hi: number) => {
        const out: number[] = [];
        for (let m = Math.max(-ring, Math.floor(lo / 10) * 10); m <= Math.min(ring, Math.ceil(hi / 10) * 10); m += 10) out.push(m);
        return out;
      };
      cols = range(Math.min(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[0])));
      rows = range(Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[1])));
    } else {
      cols = rows = Array.from({ length: (2 * ring) / 10 + 1 }, (_, k) => k * 10 - ring);
    }
    try {
      grid = findGrid(img, points, { cols, rows });
    } catch (e) {
      // Too few crossings this close in (the pieces cover them): look further out.
      if (grid === null && ring !== RINGS[RINGS.length - 1]) continue;
      return { reason: (e as Error).message };
    }
    points = grid.points;
  }
  return { grid: grid! };
}
