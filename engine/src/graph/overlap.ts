/**
 * WOOD ON WOOD: two pieces whose planks cover the same floor.
 *
 * `findVertexClashes` asks whether two ENDS share an exact lattice point, and
 * that catches every pile-up that lands end on end: the 16xE double circle,
 * the 8L+8R tangency. It cannot see a plank crossing a plank mid-span, with
 * no end anywhere near the crossing, and that layout was a live false pass:
 * two straights laid in a plus sign, or a curve run across a straight, drew
 * as one merged shape that read as a crossing piece or a switch, and the
 * verdict said nothing. BRIO track cannot cross itself on the flat; only a
 * crossing piece or a bridge does that, and both would be parts.
 *
 * THIS IS FLOAT GEOMETRY, deliberately, and the vertex check stays exact.
 * Wood has width, and the question "do two areas share area" has no lattice
 * answer. A tolerance is therefore part of the rule, stated once:
 * OVERLAP_MIN_AREA_MM2 below.
 *
 * HOW. Every plank is cut into convex quadrilaterals: a straight is one
 * rectangle; a curve is a run of thin annular slices, each the quad between
 * two radii, so the chord error is under 0.3 mm on the largest BRIO curve.
 * Two quads from different pieces are clipped against each other
 * (Sutherland-Hodgman, exact for convex shapes) and the shared area summed
 * per pair of pieces. A spatial hash keeps it near-linear: an all-pairs scan
 * over pieces is the defect `solve.ts` records as a real freeze.
 *
 * WHAT IS EXEMPT, and why each is not a gap in the check:
 * - a piece against itself: a switch's two roads share their heel by design.
 * - two pieces joined by a weld: they meet along the joint, which is zero
 *   area when the joint is exact, and a closing joint that needs give may
 *   push a few millimetres into its neighbour, which is the give, reported
 *   by the loop figures, not a crossing.
 * - a pair with ends on the same exact spot: the vertex check already
 *   reports that spot, exactly, and saying it twice would draw two markers
 *   for one fault. Full membership per spot (`connectorSites`), not the clash
 *   records, which keep one representative pair per spot: keyed on those,
 *   the 16xE double circle still reported one stacked pair as an overlap.
 */

import type { Segment } from '../geom/fk.js';
import type { Graph } from './model.js';
import type { ConnectorSites } from './feasible.js';

/** Two pieces whose wood covers the same floor, and the middle of that shared area. */
export interface PlankOverlap {
  readonly a: string;
  readonly b: string;
  readonly at: [number, number];
  /** The shared area, in square millimetres. */
  readonly areaMm2: number;
}

/**
 * Below this, two planks are touching, not overlapping. 100 mm² is a 40 mm
 * plank pushed 2.5 mm into another end on, or a corner nicked by about 14 mm
 * square: more than float noise and chord error by orders of magnitude, and
 * well under any real crossing (two 40 mm planks crossing square share
 * 1600 mm²).
 */
export const OVERLAP_MIN_AREA_MM2 = 100;

/** Slice a curve this finely: 1/32 of a half turn, 5.6 degrees. */
const SLICE_RAD = Math.PI / 32;

type Pt = readonly [number, number];

interface Quad {
  readonly pieceId: string;
  readonly pts: readonly Pt[];
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function quad(pieceId: string, pts: readonly Pt[]): Quad {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { pieceId, pts, minX, minY, maxX, maxY };
}

/** A segment's plank as convex quads, each wound counter-clockwise. */
export function plankQuads(s: Segment, half: number, pieceId: string): readonly Quad[] {
  const side = (x: number, y: number, h: number, sign: 1 | -1): Pt => [
    x - Math.sin(h) * half * sign,
    y + Math.cos(h) * half * sign,
  ];
  const ccw = (pts: Pt[]): Pt[] => (signedArea(pts) < 0 ? pts.reverse() : pts);
  if (s.kind === 'straight') {
    return [
      quad(pieceId, ccw([
        side(s.from.x, s.from.y, s.from.h, -1),
        side(s.to.x, s.to.y, s.to.h, -1),
        side(s.to.x, s.to.y, s.to.h, 1),
        side(s.from.x, s.from.y, s.from.h, 1),
      ])),
    ];
  }
  // Walk the centreline in exact chords, as the heading turns.
  const r = s.centrelineRadiusMm ?? 0;
  let turn = s.to.h - s.from.h;
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn <= -Math.PI) turn += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(turn) / SLICE_RAD));
  const d = turn / n;
  const chord = 2 * r * Math.sin(Math.abs(d) / 2);
  const out: Quad[] = [];
  let x = s.from.x, y = s.from.y, h = s.from.h;
  for (let i = 0; i < n; i++) {
    const nx = x + Math.cos(h + d / 2) * chord;
    const ny = y + Math.sin(h + d / 2) * chord;
    const nh = h + d;
    out.push(quad(pieceId, ccw([side(x, y, h, -1), side(nx, ny, nh, -1), side(nx, ny, nh, 1), side(x, y, h, 1)])));
    x = nx; y = ny; h = nh;
  }
  return out;
}

function signedArea(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** The shared region of two convex counter-clockwise polygons (Sutherland-Hodgman). */
export function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let out: Pt[] = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const [ax, ay] = clip[i]!;
    const [bx, by] = clip[(i + 1) % clip.length]!;
    const inside = ([px, py]: Pt) => (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= 0;
    const cross = ([px, py]: Pt, [qx, qy]: Pt): Pt => {
      const dx = qx - px, dy = qy - py;
      const den = (bx - ax) * dy - (by - ay) * dx;
      const t = ((ax - px) * (by - ay) - (ay - py) * (bx - ax)) / -den;
      return [px + t * dx, py + t * dy];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j]!;
      const q = input[(j + 1) % input.length]!;
      const pin = inside(p);
      const qin = inside(q);
      if (pin) out.push(p);
      if (pin !== qin) out.push(cross(p, q));
    }
  }
  return out;
}

/**
 * Every pair of pieces whose planks share more than OVERLAP_MIN_AREA_MM2,
 * once per pair, marked at the middle of the shared area.
 */
export function findPlankOverlaps(
  graph: Graph,
  segments: readonly Segment[],
  plankHalfWidth: (partId: string) => number,
  sites: ConnectorSites,
): readonly PlankOverlap[] {
  return planksSharingArea(graph, segments, plankHalfWidth, sites, true);
}

/**
 * Every pair of planks crossing on DIFFERENT levels: the bridges. Counted for
 * the clearance note (design decision 3A), which names how many places raised
 * track passes over floor track. Never a fault: clearance is estimated, not
 * checked (decision L3).
 */
export function findBridges(
  graph: Graph,
  segments: readonly Segment[],
  plankHalfWidth: (partId: string) => number,
  sites: ConnectorSites,
): readonly PlankOverlap[] {
  return planksSharingArea(graph, segments, plankHalfWidth, sites, false);
}

function planksSharingArea(
  graph: Graph,
  segments: readonly Segment[],
  plankHalfWidth: (partId: string) => number,
  sites: ConnectorSites,
  wantSameLevel: boolean,
): readonly PlankOverlap[] {
  const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const exempt = new Set<string>();
  for (const w of graph.welds) exempt.add(pairKey(w.a.pieceId, w.b.pieceId));
  for (const group of sites.at.values()) {
    for (let m = 0; m < group.length; m++) {
      for (let n = m + 1; n < group.length; n++) {
        const a = sites.placed[group[m]!]!.pieceId;
        const b = sites.placed[group[n]!]!.pieceId;
        if (a !== b) exempt.add(pairKey(a, b));
      }
    }
  }

  /*
   * LEVELS (two-layer plan, core 3). Planks cross freely on different levels:
   * that is a bridge. A ramp spans the levels of both its ends, so it clashes
   * with track on either, which is the safe reading of a plank whose height
   * changes along its length.
   */
  const span = new Map<string, readonly [number, number]>();
  for (const s of segments) {
    if (s.pieceId === undefined) continue;
    const lo = s.level ?? 0;
    span.set(s.pieceId, [lo, lo + (s.rise ?? 0)]);
  }
  const sameLevel = (a: string, b: string): boolean => {
    const [alo, ahi] = span.get(a)!;
    const [blo, bhi] = span.get(b)!;
    return alo <= bhi && blo <= ahi;
  };

  const quads: Quad[] = [];
  for (const s of segments) {
    if (s.pieceId === undefined) continue;
    quads.push(...plankQuads(s, plankHalfWidth(s.partId), s.pieceId));
  }

  // A uniform grid, a cell about two plank widths, so a quad spans few cells.
  const CELL = 100;
  const grid = new Map<string, number[]>();
  quads.forEach((q, i) => {
    for (let cx = Math.floor(q.minX / CELL); cx <= Math.floor(q.maxX / CELL); cx++) {
      for (let cy = Math.floor(q.minY / CELL); cy <= Math.floor(q.maxY / CELL); cy++) {
        const k = `${cx},${cy}`;
        const cell = grid.get(k);
        if (cell) cell.push(i);
        else grid.set(k, [i]);
      }
    }
  });

  const seen = new Set<string>();
  const shared = new Map<string, { a: string; b: string; area: number; sx: number; sy: number }>();
  for (const cell of grid.values()) {
    for (let m = 0; m < cell.length; m++) {
      for (let n = m + 1; n < cell.length; n++) {
        const i = Math.min(cell[m]!, cell[n]!);
        const j = Math.max(cell[m]!, cell[n]!);
        const p = quads[i]!;
        const q = quads[j]!;
        if (p.pieceId === q.pieceId) continue;
        if (p.maxX <= q.minX || q.maxX <= p.minX || p.maxY <= q.minY || q.maxY <= p.minY) continue;
        const pk = pairKey(p.pieceId, q.pieceId);
        if (exempt.has(pk)) continue;
        if (sameLevel(p.pieceId, q.pieceId) !== wantSameLevel) continue;
        // Two quads can share several cells; clip each pair once.
        const qk = `${i},${j}`;
        if (seen.has(qk)) continue;
        seen.add(qk);
        const region = clipConvex(p.pts, q.pts);
        if (region.length < 3) continue;
        const area = signedArea(region);
        if (!(area > 0)) continue;
        let cx = 0, cy = 0;
        for (const [x, y] of region) { cx += x; cy += y; }
        const entry = shared.get(pk) ?? {
          a: p.pieceId < q.pieceId ? p.pieceId : q.pieceId,
          b: p.pieceId < q.pieceId ? q.pieceId : p.pieceId,
          area: 0, sx: 0, sy: 0,
        };
        entry.area += area;
        entry.sx += (cx / region.length) * area;
        entry.sy += (cy / region.length) * area;
        shared.set(pk, entry);
      }
    }
  }

  const out: PlankOverlap[] = [];
  for (const e of shared.values()) {
    if (e.area < OVERLAP_MIN_AREA_MM2) continue;
    out.push({ a: e.a, b: e.b, at: [e.sx / e.area, e.sy / e.area], areaMm2: e.area });
  }
  // Stable order, so markers and counts do not reshuffle between edits.
  return out.sort((x, y) => (x.a === y.a ? x.b.localeCompare(y.b) : x.a.localeCompare(y.a)));
}
