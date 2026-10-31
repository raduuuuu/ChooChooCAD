/**
 * The SVG path a track segment renders as.
 *
 * Extracted from TrackCanvas so it has exactly ONE owner and can be tested
 * against what it actually emits.
 *
 * WHY THIS FILE EXISTS (task T1)
 *
 * The sweep flag used to live as a literal inside TrackCanvas and AGAIN as a
 * hand-copied constant in engine/test/render.test.ts, with each file's comment
 * claiming the other enforced it: the test said "Must match
 * TrackCanvas.segmentPath", the renderer said "Pinned by
 * engine/test/render.test.ts". Neither was true. The test computed the SVG
 * spec's centre from its OWN copy of the flag, so it was a circular pin:
 * inverting the renderer's literal left all 50 tests green, which was proven by
 * mutation during the fourth eng review. The one test touching the renderer
 * could not detect a renderer regression, and getting this flag wrong renders
 * the eight-curve circle as a flower while every endpoint, and therefore every
 * other test, stays perfectly correct.
 *
 * Deliberately free of React and of any DOM reference, so the test that pins it
 * runs in the plain node environment and asserts the real emitted string.
 */

import type { Segment } from '../../engine/src/geom/fk.js';
import type { WeldResidual } from '../../engine/src/graph/frames.js';
import type { PortRef, Weld } from '../../engine/src/graph/model.js';
import type { RenderedPort } from '../../engine/src/graph/render.js';

/**
 * SVG sweep flag for a left turn.
 *
 * Our y axis points down in screen space after the flip in the viewBox
 * transform, so a left turn draws as sweep 1. This is the single owner of that
 * fact; nothing else may restate it.
 */
export const SVG_SWEEP_FOR_LEFT = 1 as const;

/** The flag for either turn direction, derived from the one above. */
export function svgSweepFlag(sweep: Segment['sweep']): 0 | 1 {
  return (sweep === 'left' ? SVG_SWEEP_FOR_LEFT : 1 - SVG_SWEEP_FOR_LEFT) as 0 | 1;
}

/** The SVG `d` attribute for one placed piece. */
export function segmentPath(s: Segment): string {
  const { from, to } = s;
  if (s.kind === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const r = s.centrelineRadiusMm ?? 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 0 ${svgSweepFlag(s.sweep)} ${to.x} ${to.y}`;
}

/**
 * Where to draw clash markers (task T12).
 *
 * Decision A4 approved REPORTING coincident ends and owed a drawing half
 * that was never written, so for three reviews the verdict said "8 pairs of
 * track ends land in exactly the same spot" and the canvas gave no clue
 * which. A count you cannot locate is not actionable.
 *
 * One marker per PLACE, not per pair. A spot where four separate joins
 * coincide is six reported pairs and one problem; drawing it six times over
 * would stack six rings at full opacity and read as something worse than it
 * is. The invariant that matters, and the one `trackPath.test.ts` pins, is
 * that every reported clash's position appears exactly once.
 *
 * Keyed on the exact millimetres the engine reported. Nothing is rounded
 * into or out of a match here; the engine already decided what coincides,
 * exactly, in Z[zeta16].
 */
export function clashMarkers(
  clashes: readonly { readonly at: readonly [number, number] }[],
): ReadonlyArray<readonly [number, number]> {
  const seen = new Map<string, readonly [number, number]>();
  for (const c of clashes) seen.set(`${c.at[0]},${c.at[1]}`, c.at);
  return [...seen.values()];
}

/**
 * THE GAP ANNOTATION (task W2, decision D4).
 *
 * A layout that fails on a gap used to draw identically to one that closes:
 * six references to clash markers in the canvas and zero to gaps. The only
 * difference a user saw was a sentence underneath, so the one failure they can
 * fix by swapping a piece was also the one the drawing said nothing about.
 *
 * Geometry only, and pure, so the suite can check it with no DOM. The shape is
 * a drafting leader: a line out from the spot where two ends fail to meet, and
 * the figure at the far end of it, clear of the track.
 *
 * `gapMm` is CARRIED, never derived from `a` and `b`. The engine measures the
 * mismatch exactly in Z[zeta16] and converts once (`WeldResidual.gapMm`);
 * re-deriving it here from two rounded screen positions is how a drawing ends
 * up labelled with a different number than the sentence under it.
 */
export interface GapMark {
  /** The two ends that should have met, in millimetres. */
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  /** The engine's figure for this weld. Not recomputed from a and b. */
  readonly gapMm: number;
  /** Which weld, so the 3D view can place the mark on its level (3D plan, eng O3). */
  readonly weld: number;
}

export interface GapAnnotation {
  /** The spot being annotated: midway between the two ends. */
  readonly at: readonly [number, number];
  /** Where the leader line stops. */
  readonly leaderEnd: readonly [number, number];
  /** Where the figure sits, past the leader so it never lies on it. */
  readonly label: readonly [number, number];
  readonly gapMm: number;
}

/**
 * WHICH WELDS THE CANVAS ANNOTATES (task W2, decision D4).
 *
 * One per closing weld whose two ends are apart, resolved to the positions
 * the canvas already drew them at. The engine's `gapMm` is passed through
 * untouched: the drawing must not be able to disagree with the sentence
 * under it.
 *
 * A rotated weld is SKIPPED. `headingSteps !== 0` means the loop comes back
 * pointing the wrong way, and a distance there would promise a fix that does
 * not exist: closing those millimetres still leaves the track turned. The
 * verdict says that in words and the canvas stays quiet rather than
 * contradicting it with a number.
 *
 * Lifted out of an `App.tsx` memo (task X2b, finding E10) so the two
 * decisions in the filter can be tested against a real solve.
 */
export function gapMarks(
  residuals: readonly WeldResidual[],
  welds: readonly Weld[],
  ports: readonly RenderedPort[],
): readonly GapMark[] {
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  return residuals.flatMap((r) => {
    if (!(r.gapMm > 0) || r.headingSteps !== 0) return [];
    const w = welds[r.weld];
    if (!w) return [];
    const a = byPort.get(`${w.a.pieceId}#${w.a.port}`);
    const b = byPort.get(`${w.b.pieceId}#${w.b.port}`);
    if (!a || !b) return [];
    return [{ a: [a.x, a.y] as const, b: [b.x, b.y] as const, gapMm: r.gapMm, weld: r.weld }];
  });
}

/** One breakable joint on the canvas (task U5). */
export interface WeldTarget {
  /** The two ends the weld joins, which is what a break action carries (E4). */
  readonly a: PortRef;
  readonly b: PortRef;
  /** Where the hit circle and the hover brackets sit, in millimetres. */
  readonly at: readonly [number, number];
  /** Track direction through the joint, radians, so the brackets open along it. */
  readonly h: number;
}

/**
 * Every weld, resolved to the place the canvas draws it.
 *
 * At the MIDPOINT of the two ends. For an ordinary joint they coincide, so it
 * is the joint itself; for a closing weld with a gap it is the middle of the
 * gap, which is where the gap annotation already points. Welds whose ends are
 * not on the canvas are skipped rather than drawn at a guess.
 */
export function weldTargets(
  welds: readonly Weld[],
  ports: readonly RenderedPort[],
): readonly WeldTarget[] {
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  return welds.flatMap((w) => {
    const a = byPort.get(`${w.a.pieceId}#${w.a.port}`);
    const b = byPort.get(`${w.b.pieceId}#${w.b.port}`);
    if (!a || !b) return [];
    return [{ a: w.a, b: w.b, at: [(a.x + b.x) / 2, (a.y + b.y) / 2] as const, h: a.h }];
  });
}

/**
 * Leader direction is PERPENDICULAR to the gap, which is the drafting
 * convention and also the practical one: a label along the gap would sit on
 * the two track ends it is measuring. A degenerate gap cannot reach here
 * because the caller filters on `gapMm > 0`, but a near-degenerate one still
 * yields a usable direction, and an exactly-zero vector falls back to up.
 */
export function gapAnnotations(
  // Only where the two ends are and the figure; the weld is for the 3D view.
  marks: readonly Pick<GapMark, 'a' | 'b' | 'gapMm'>[],
  leaderMm: number,
  labelGapMm: number,
): readonly GapAnnotation[] {
  return marks.map((m) => {
    const mx = (m.a[0] + m.b[0]) / 2;
    const my = (m.a[1] + m.b[1]) / 2;
    const dx = m.b[0] - m.a[0];
    const dy = m.b[1] - m.a[1];
    const len = Math.hypot(dx, dy);
    const [px, py] = len === 0 ? [0, 1] : [-dy / len, dx / len];
    return {
      at: [mx, my] as const,
      leaderEnd: [mx + px * leaderMm, my + py * leaderMm] as const,
      label: [
        mx + px * (leaderMm + labelGapMm),
        my + py * (leaderMm + labelGapMm),
      ] as const,
      gapMm: m.gapMm,
    };
  });
}

/**
 * WHERE A REFUSED JOINT IS MARKED (brio-TODOS.md P2, "The polarity marker,
 * and three things it does not yet do", limits 1 and 3).
 *
 * At BOTH ends of the weld. The ends of a tree weld coincide and one mark is
 * the whole truth, but a closing weld can have a gap, and a self-weld of one
 * B2 has its ends 54mm apart; marking end `a` alone put the mark wherever the
 * first click happened to be. Where a clash or a crossing is already drawn,
 * that mark holds the spot and the bar inside it is left out; a joint left
 * with no mark at all is counted in `hidden`, which the verdict says aloud,
 * as it does for level faults.
 */
export function badJointMarks(
  refused: readonly number[],
  welds: readonly Weld[],
  ports: readonly RenderedPort[],
  taken: readonly (readonly [number, number])[],
): { readonly marks: readonly (readonly [number, number])[]; readonly hidden: number } {
  // The common case, built for nothing otherwise: the Map is over every end.
  if (refused.length === 0) return { marks: [], hidden: 0 };
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  const same = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  const marks: (readonly [number, number])[] = [];
  let hidden = 0;
  for (const i of refused) {
    const w = welds[i];
    if (!w) continue;
    const ends = [w.a, w.b]
      .map((r) => byPort.get(`${r.pieceId}#${r.port}`))
      .filter((p): p is RenderedPort => p !== undefined)
      .map((p) => [p.x, p.y] as const);
    const spots = ends.filter((at, k) => k === 0 || !same(at, ends[0]!));
    const shown = spots.filter((at) => !taken.some((t) => same(t, at)));
    if (spots.length > 0 && shown.length === 0) hidden++;
    marks.push(...shown);
  }
  return { marks, hidden };
}

/** One seam: a short line across the plank where two pieces meet. */
export interface SeamLine {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** One of the two pieces it joins; both are in the same run. */
  readonly pieceId: string;
}

/**
 * WHERE ONE PIECE ENDS AND THE NEXT BEGINS (request 2 of the 2026-10-22
 * editing plan, decision 11A).
 *
 * The track is painted layer by layer across every segment so a joint shows
 * no seam that is not there (see TrackCanvas). Three straights in a row then
 * read as one long plank, and the user could not see where each ended. Real
 * BRIO joints are visible, so each one gets a line straight across the plank.
 *
 * At end `a` of the weld, across the NARROWER of the two planks, so the line
 * never pokes out past the thinner piece. A weld is skipped when its ends do
 * not coincide (a closing weld with a gap, which the gap annotation already
 * marks) or when it is a refused joint (the polarity marker sits there).
 * Coincidence is exact float equality: both ends come from the same exact
 * lattice point, so they convert to identical numbers or they are apart.
 */
export function seamLines(
  welds: readonly Weld[],
  ports: readonly RenderedPort[],
  plankWidthOf: (pieceId: string) => number,
  refused: ReadonlySet<number>,
): readonly SeamLine[] {
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  return welds.flatMap((w, i) => {
    if (refused.has(i)) return [];
    const a = byPort.get(`${w.a.pieceId}#${w.a.port}`);
    const b = byPort.get(`${w.b.pieceId}#${w.b.port}`);
    if (!a || !b || a.x !== b.x || a.y !== b.y) return [];
    const half = Math.min(plankWidthOf(w.a.pieceId), plankWidthOf(w.b.pieceId)) / 2;
    const nx = -Math.sin(a.h) * half;
    const ny = Math.cos(a.h) * half;
    return [{ from: [a.x - nx, a.y - ny] as const, to: [a.x + nx, a.y + ny] as const, pieceId: w.a.pieceId }];
  });
}

/**
 * THE GRID STEPS, in millimetres: a 1-2-5 series from 10 cm to 10 m
 * (decision R4/D3 and the spec review's grid rule). Adjacent steps differ by at
 * most 2.5x, which is what keeps a chosen cell between 20 and 50 px.
 */
export const GRID_STEPS_MM = [100, 200, 500, 1000, 2000, 5000, 10000] as const;

/** The smallest cell the grid draws, in CSS pixels. */
export const GRID_MIN_CELL_PX = 20;

/**
 * The grid step for the current view.
 *
 * With a measurement (`pxPerMm`, CSS pixels per model millimetre), the
 * smallest step whose cell is at least GRID_MIN_CELL_PX. Without one -- a
 * static render, jsdom, or the first paint before the size is known -- the
 * smallest step that draws at most 40 lines across the larger side of the
 * view. Either way a layout too big for the largest step gets the largest.
 */
export function gridStep(spanMm: number, pxPerMm: number | null): number {
  for (const step of GRID_STEPS_MM) {
    if (pxPerMm !== null ? step * pxPerMm >= GRID_MIN_CELL_PX : spanMm / step <= 40) {
      return step;
    }
  }
  return GRID_STEPS_MM[GRID_STEPS_MM.length - 1]!;
}

/**
 * Every grid line inside a box, as ONE path `d` string.
 *
 * One element for the whole grid rather than one per line, so a big layout
 * adds no tags to a canvas whose cost is counted in tags (see the ceiling in
 * TrackCanvas). Lines sit on multiples of the step from the model origin, so
 * they stay put as the layout grows instead of following its corner.
 */
export function gridPath(
  minX: number,
  minY: number,
  width: number,
  height: number,
  step: number,
): string {
  const parts: string[] = [];
  const maxX = minX + width;
  const maxY = minY + height;
  for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
    parts.push(`M ${x} ${minY} V ${maxY}`);
  }
  for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
    parts.push(`M ${minX} ${y} H ${maxX}`);
  }
  return parts.join(' ');
}

/** The caption for a step: "10 cm" up to "50 cm", then metres. */
export function gridLabel(step: number): string {
  return step < 1000 ? `${step / 10} cm` : `${step / 1000} m`;
}

/**
 * The part of the model the canvas actually shows, in millimetres.
 *
 * The default `xMidYMid meet` fits the viewBox inside the element and centres
 * it, so the element shows MORE than the viewBox along one axis, and SVG paints
 * up to the element's edge. The grid covers this box so it reaches the edge of
 * the floor instead of stopping at the viewBox (seen in a browser, 2026-10-22).
 * Without a measurement the viewBox itself is all that is known.
 */
export function visibleBox(
  view: { readonly minX: number; readonly minY: number; readonly width: number; readonly height: number },
  drawn: { readonly width: number; readonly height: number } | null,
): { minX: number; minY: number; width: number; height: number; pxPerMm: number | null } {
  if (!drawn || drawn.width <= 0 || drawn.height <= 0) return { ...view, pxPerMm: null };
  const pxPerMm = Math.min(drawn.width / view.width, drawn.height / view.height);
  const width = drawn.width / pxPerMm;
  const height = drawn.height / pxPerMm;
  return {
    minX: view.minX - (width - view.width) / 2,
    minY: view.minY - (height - view.height) / 2,
    width,
    height,
    pxPerMm,
  };
}

/**
 * The two long edges of a piece's plank, as path `d` strings (decisions 10A
 * and 17A: a selection, its run and keyboard focus are drawn ALONG the plank
 * edges, so each keeps its own stroke weight and dash at every zoom).
 *
 * Exact offsets, not a fat stroke under the track: a straight's edges are the
 * centreline moved half a plank either side; a curve's are concentric arcs,
 * the inner one `r - half` and the outer `r + half`, with the same sweep.
 */
export function plankEdges(s: Segment, half: number): readonly [string, string] {
  const side = (sign: 1 | -1): string => {
    const ox = (h: number) => -Math.sin(h) * half * sign;
    const oy = (h: number) => Math.cos(h) * half * sign;
    const x1 = s.from.x + ox(s.from.h);
    const y1 = s.from.y + oy(s.from.h);
    const x2 = s.to.x + ox(s.to.h);
    const y2 = s.to.y + oy(s.to.h);
    if (s.kind === 'straight') return `M ${x1} ${y1} L ${x2} ${y2}`;
    const r = s.centrelineRadiusMm ?? 0;
    // The centre is on the left of a left turn, so the left edge is inside.
    const toward = (s.sweep === 'left' ? 1 : -1) === sign;
    const radius = toward ? r - half : r + half;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${svgSweepFlag(s.sweep)} ${x2} ${y2}`;
  };
  return [side(1), side(-1)];
}

/**
 * Where a selected piece's label goes (decision 21A): off the middle of the
 * piece, on its outward side (away from a curve's centre; to the left of a
 * straight), unless the label there would cover a gap figure or leave the
 * view, then on the inward side, and if both fail, nowhere: the selection
 * strip names the piece already. Gap figures never move.
 *
 * `halfSize` is half the label box, in millimetres, so the caller can size it
 * from the text and the current scale.
 */
export function labelSpot(
  s: Segment,
  gapMarkMm: number,
  clearMm: number,
  halfSize: readonly [number, number],
  view: { readonly minX: number; readonly minY: number; readonly width: number; readonly height: number },
  avoid: readonly (readonly [number, number])[],
): readonly [number, number] | null {
  let mx: number;
  let my: number;
  let nx: number;
  let ny: number;
  if (s.kind === 'straight') {
    mx = (s.from.x + s.to.x) / 2;
    my = (s.from.y + s.to.y) / 2;
    nx = -Math.sin(s.from.h);
    ny = Math.cos(s.from.h);
  } else {
    const r = s.centrelineRadiusMm ?? 0;
    const sign = s.sweep === 'left' ? 1 : -1;
    const cx = s.from.x - Math.sin(s.from.h) * r * sign;
    const cy = s.from.y + Math.cos(s.from.h) * r * sign;
    const vx = (s.from.x + s.to.x) / 2 - cx;
    const vy = (s.from.y + s.to.y) / 2 - cy;
    const len = Math.hypot(vx, vy) || 1;
    nx = vx / len;
    ny = vy / len;
    mx = cx + nx * r;
    my = cy + ny * r;
  }
  const fits = ([x, y]: readonly [number, number]): boolean =>
    x - halfSize[0] >= view.minX &&
    x + halfSize[0] <= view.minX + view.width &&
    y - halfSize[1] >= view.minY &&
    y + halfSize[1] <= view.minY + view.height &&
    avoid.every(
      ([ax, ay]) =>
        Math.abs(ax - x) > halfSize[0] + gapMarkMm || Math.abs(ay - y) > halfSize[1] + gapMarkMm,
    );
  /*
   * The box's CENTRE goes past the edge by half its own size along the
   * normal's dominant axis, so the text starts beside the plank instead of
   * straddling it. Centring the text on the clearance point put half of a
   * long name back across the track (seen in a browser, 2026-10-22).
   */
  const alongX = Math.abs(nx) >= Math.abs(ny);
  for (const sign of [1, -1] as const) {
    const px = mx + nx * clearMm * sign;
    const py = my + ny * clearMm * sign;
    const spot = alongX
      ? ([px + Math.sign(nx) * sign * halfSize[0], py] as const)
      : ([px, py + Math.sign(ny) * sign * halfSize[1]] as const);
    if (fits(spot)) return spot;
  }
  return null;
}

/** Two free ends close enough, and facing, to offer a one-press join (design 28B). */
export interface JoinSuggestion {
  readonly a: PortRef;
  readonly b: PortRef;
  /** Midway between the two ends, where the Join button sits. */
  readonly at: readonly [number, number];
  /** Both ends' level (they share one); the button is drawn with that level's track. */
  readonly level: number;
}

/**
 * How far apart two free ends may be and still be offered a join, in mm (28B).
 * 100, not the 60 first proposed: the Near miss loop, opened at its closing
 * joint, leaves its ends 72mm apart, and that is the very case the button is
 * for (seen in a browser, 2026-10-31). Under a medium straight's 144mm, so a
 * gap you could fill with a piece is not offered as a join.
 */
export const SUGGEST_JOIN_MM = 100;
/** How far from facing each other they may turn, in degrees (28B). */
export const SUGGEST_JOIN_DEG = 30;
/** Above this many free ends nothing is suggested: the pairs grow as the square. */
export const SUGGEST_JOIN_MAX_ENDS = 200;

/**
 * THE JOINS THE CANVAS OFFERS (design review 28B, 2026-10-31).
 *
 * A loop whose last piece stops just short of its first is the commonest
 * join there is, and the one the free-end dots hide best. So: two free ends on
 * one level, at most SUGGEST_JOIN_MM apart, pointing at each other to within
 * SUGGEST_JOIN_DEG, and a join the editor would make (`canJoin`, the same
 * refusal the reducer applies). Each end is offered once, to its nearest
 * partner, so two buttons never claim the same end.
 */
export function joinSuggestions(
  ports: readonly RenderedPort[],
  canJoin: (a: PortRef, b: PortRef) => boolean,
): readonly JoinSuggestion[] {
  const free = ports.filter((p) => p.free);
  if (free.length < 2 || free.length > SUGGEST_JOIN_MAX_ENDS) return [];
  const facing = Math.cos((SUGGEST_JOIN_DEG * Math.PI) / 180);
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const p = free[i]!;
      const q = free[j]!;
      if ((p.level ?? 0) !== (q.level ?? 0)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > SUGGEST_JOIN_MM) continue;
      // Outward headings opposite: cos(h_p - h_q) close to -1.
      if (-Math.cos(p.h - q.h) < facing) continue;
      // And each points at the other, not away (a gap, not two backs).
      if (d > 1e-6 && (Math.cos(p.h) * (q.x - p.x) + Math.sin(p.h) * (q.y - p.y)) / d < facing) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((x, y) => x.d - y.d);
  const used = new Set<number>();
  const out: JoinSuggestion[] = [];
  for (const { i, j } of pairs) {
    if (used.has(i) || used.has(j)) continue;
    const p = free[i]!;
    const q = free[j]!;
    const a = { pieceId: p.pieceId, port: p.port };
    const b = { pieceId: q.pieceId, port: q.port };
    if (!canJoin(a, b)) continue;
    used.add(i);
    used.add(j);
    out.push({ a, b, at: [(p.x + q.x) / 2, (p.y + q.y) / 2], level: p.level ?? 0 });
  }
  return out;
}

/** How far a seam runs past each plank edge, in screen pixels (design 26A). */
export const SEAM_OVERHANG_PX = 4;

/** A seam lengthened by `byMm` at both ends, along its own line. */
export function pastEdges(m: SeamLine, byMm: number): readonly [readonly [number, number], readonly [number, number]] {
  const dx = m.to[0] - m.from[0];
  const dy = m.to[1] - m.from[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [m.from, m.to];
  const ux = (dx / len) * byMm;
  const uy = (dy / len) * byMm;
  return [
    [m.from[0] - ux, m.from[1] - uy],
    [m.to[0] + ux, m.to[1] + uy],
  ];
}
