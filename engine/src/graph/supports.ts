/**
 * IS RAISED TRACK HELD UP? (generic-TODOS.md P2 "Check that raised track is
 * held up"; owner decisions 2026-11-06.)
 *
 * Raised track rests on what is under it. Three things hold it:
 *
 *   a track support   a block (TS) whose footprint the track's centre line
 *                     crosses, turned within one 22.5 degree step of the
 *                     track (owner: "centre line through it, roughly
 *                     along"); the track is held over the footprint's length
 *   a structure       a piece that carries its own raised road (a riser, the
 *                     tunnel's overpass, a bridge, the elevated station): it
 *                     holds the track joined to its end
 *   a ramp            holds the track joined to its high end
 *
 * The rule is calibration F4, the largest clear gap two straights joined in
 * the middle can cross between two supports: measured along the track, no
 * stretch of raised track between two held places may be longer. The joint
 * in the middle is the hardest case, so the figure is used wherever the
 * joints fall.
 *
 * Track that ends in mid-air past its last support is reported, never
 * judged: F4 does not measure how far track can stick out (owner: "say it's
 * not checked").
 *
 * FLOAT GEOMETRY, like overlap.ts: the centre line is walked in steps of
 * `STEP_MM`, so a stretch's length is good to about that, and track ends
 * within `JOIN_MM` of each other are one place (a closing joint that needs
 * give leaves its two ends a little apart).
 */

import type { Segment } from '../geom/fk.js';
import { isStructure, type Part } from '../parts/schema.js';

/** Raised track longer than F4 between two held places. */
export interface UnheldStretch {
  /** Along the track, from where one support stops holding it to where the next starts. */
  readonly lengthMm: number;
  /** The piece at the middle of the stretch: the one the sentence names. */
  readonly pieceId: string;
  /** The middle of the stretch, for a mark. */
  readonly at: readonly [number, number];
  /** Every piece in the stretch, in no particular order. */
  readonly pieceIds: readonly string[];
}

/** Raised track ending in mid-air, past its last support. Not judged: F4 does not cover it. */
export interface OpenRaisedEnd {
  readonly pieceId: string;
  readonly at: readonly [number, number];
}

export interface SupportReport {
  /** The F4 figure the check used. */
  readonly spanMm: number;
  /** Longest first. */
  readonly unheld: readonly UnheldStretch[];
  readonly openEnds: readonly OpenRaisedEnd[];
}

/** How finely the centre line is walked. */
export const STEP_MM = 1;
/** Track ends this close are one place. */
export const JOIN_MM = 3;
/** One lattice step, and a hair for float noise: a support turned further than this does not hold. */
const ALONG_RAD = (22.5 + 0.5) * (Math.PI / 180);

interface Sample {
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly pieceId: string;
}

/** A segment's centre line, every `STEP_MM` or finer, both ends included. */
function walk(s: Segment): Sample[] {
  const pieceId = s.pieceId ?? '';
  if (s.kind === 'straight') {
    const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
    const n = Math.max(1, Math.ceil(len / STEP_MM));
    const h = Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
    return Array.from({ length: n + 1 }, (_, i) => ({
      x: s.from.x + ((s.to.x - s.from.x) * i) / n,
      y: s.from.y + ((s.to.y - s.from.y) * i) / n,
      h,
      pieceId,
    }));
  }
  // The same exact chords as overlap.ts `plankQuads`, finer.
  const r = s.centrelineRadiusMm ?? 0;
  let turn = s.to.h - s.from.h;
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn <= -Math.PI) turn += 2 * Math.PI;
  const n = Math.max(1, Math.ceil((Math.abs(turn) * r) / STEP_MM));
  const d = turn / n;
  const chord = 2 * r * Math.sin(Math.abs(d) / 2);
  const out: Sample[] = [{ x: s.from.x, y: s.from.y, h: s.from.h, pieceId }];
  let { x, y, h } = s.from;
  for (let i = 0; i < n; i++) {
    x += Math.cos(h + d / 2) * chord;
    y += Math.sin(h + d / 2) * chord;
    h += d;
    out.push({ x, y, h, pieceId });
  }
  return out;
}

/** Whether a track support's footprint holds the track at this sample. */
function holds(foot: Segment, p: Sample): boolean {
  const ax = foot.to.x - foot.from.x;
  const ay = foot.to.y - foot.from.y;
  const len = Math.hypot(ax, ay);
  if (len === 0) return false;
  const ux = ax / len, uy = ay / len;
  const dx = p.x - foot.from.x, dy = p.y - foot.from.y;
  const along = dx * ux + dy * uy;
  const across = -dx * uy + dy * ux;
  if (along < 0 || along > len || Math.abs(across) > (foot.halfWidthMm ?? 0)) return false;
  // Turned either way along the track: a support has no front.
  let diff = Math.abs(p.h - Math.atan2(uy, ux)) % Math.PI;
  if (diff > Math.PI / 2) diff = Math.PI - diff;
  return diff <= ALONG_RAD;
}

/**
 * The supports check, or null when nothing needs it: no raised track. `spanMm`
 * is F4; the caller passes null while it is unmeasured and gets null back, so
 * the verdict keeps saying supports are not checked.
 */
export function checkSupports(
  segments: readonly Segment[],
  bodies: readonly Segment[],
  partOf: (pieceId: string) => Part,
  spanMm: number | null,
): SupportReport | null {
  if (spanMm === null) return null;
  const structural = (s: Segment) => s.pieceId !== undefined && isStructure(partOf(s.pieceId));

  // The raised track to check: off the floor, flat, and not a structure's own road.
  const track = segments.filter((s) => (s.level ?? 0) >= 1 && (s.rise ?? 0) === 0 && !structural(s));
  if (track.length === 0) return null;

  // Places that hold the track joined to them: a ramp's high end, a structure's raised road ends.
  const anchors: [number, number][] = [];
  for (const s of segments) {
    if ((s.rise ?? 0) > 0) {
      const high = s.highAtStart ? s.from : s.to;
      anchors.push([high.x, high.y]);
    } else if ((s.level ?? 0) >= 1 && structural(s)) {
      anchors.push([s.from.x, s.from.y], [s.to.x, s.to.y]);
    }
  }
  const feet = bodies.filter((b) => b.body === 'footprint' && b.pieceId !== undefined && partOf(b.pieceId).kind === 'block');

  /*
   * THE TRACK AS A GRAPH of samples. Consecutive samples on a segment are
   * joined by their distance; a segment's two ends are merged with any other
   * end within JOIN_MM, which is how joints, and a switch's shared heel,
   * connect one piece's track to the next.
   */
  const pts: Sample[] = [];
  const edges: [number, number, number][] = [];
  const ends: number[] = [];
  for (const s of track) {
    const w = walk(s);
    const first = pts.length;
    pts.push(...w);
    for (let i = 1; i < w.length; i++) {
      edges.push([first + i - 1, first + i, Math.hypot(w[i]!.x - w[i - 1]!.x, w[i]!.y - w[i - 1]!.y)]);
    }
    ends.push(first, first + w.length - 1);
  }
  const root = pts.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i]!)));
  for (let m = 0; m < ends.length; m++) {
    for (let n = m + 1; n < ends.length; n++) {
      const a = pts[ends[m]!]!, b = pts[ends[n]!]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= JOIN_MM) root[find(ends[m]!)] = find(ends[n]!);
    }
  }

  const held = new Set<number>();
  pts.forEach((p, i) => {
    if (feet.some((f) => holds(f, p))) held.add(find(i));
  });
  for (const e of ends) {
    const p = pts[e]!;
    if (anchors.some(([x, y]) => Math.hypot(p.x - x, p.y - y) <= JOIN_MM)) held.add(find(e));
  }

  const adj = new Map<number, [number, number][]>();
  const link = (a: number, b: number, d: number) => {
    const l = adj.get(a);
    if (l) l.push([b, d]);
    else adj.set(a, [[b, d]]);
  };
  for (const [i, j, d] of edges) {
    const a = find(i), b = find(j);
    if (a === b) continue;
    link(a, b, d);
    link(b, a, d);
  }
  const nodes = [...new Set(pts.map((_, i) => find(i)))];

  /*
   * THE STRETCHES: what is left of the track once every held place is taken
   * out. Each is measured from held place to held place, so its length is
   * the clear gap F4 measures, inner face to inner face.
   */
  const unheld: UnheldStretch[] = [];
  const openEnds: OpenRaisedEnd[] = [];
  const seen = new Set<number>();
  for (const start of nodes) {
    if (held.has(start) || seen.has(start)) continue;
    const part: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const n = stack.pop()!;
      part.push(n);
      for (const [m] of adj.get(n) ?? []) {
        if (!held.has(m) && !seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    const inPart = new Set(part);
    const loose = part.filter((n) => (adj.get(n)?.length ?? 0) <= 1);
    for (const n of loose) openEnds.push({ pieceId: pts[n]!.pieceId, at: [pts[n]!.x, pts[n]!.y] });

    /*
     * The held places this stretch runs between, each counted once per side.
     * A dead end is not one: a stretch held only at one place has no gap to
     * judge, and a branch that dead-ends leaves the gap between the others.
     */
    const gates: [number, number][] = [];
    for (const n of part) for (const [m] of adj.get(n) ?? []) if (held.has(m)) gates.push([m, n]);
    const longest = gates.length === 0 ? closedLoop(part, adj) : farthestPair(gates, inPart, adj);
    if (longest.lengthMm <= spanMm) continue;
    const mid = pts[longest.mid]!;
    unheld.push({
      lengthMm: longest.lengthMm,
      pieceId: mid.pieceId,
      at: [mid.x, mid.y],
      pieceIds: [...new Set(part.map((n) => pts[n]!.pieceId))],
    });
  }
  unheld.sort((a, b) => b.lengthMm - a.lengthMm);
  return { spanMm, unheld, openEnds };
}

type Adj = Map<number, [number, number][]>;

/**
 * The longest of the shortest routes between two held places, through the
 * stretch: for a plain run, its length; for a run that branches, the longest
 * way between any two of its supports.
 */
function farthestPair(gates: readonly [number, number][], inPart: Set<number>, adj: Adj): { lengthMm: number; mid: number } {
  let best = { lengthMm: -1, mid: gates[0]![1] };
  for (const [from, first] of gates) {
    const step = adj.get(from)!.find(([m]) => m === first)![1];
    const { dist, prev } = shortest(first, step, inPart, adj);
    for (const [to, last] of gates) {
      if (to === from && last === first) continue;
      const d = dist.get(last);
      if (d === undefined) continue;
      const total = d + adj.get(last)!.find(([m]) => m === to)![1];
      if (total > best.lengthMm) best = { lengthMm: total, mid: middleOf(last, prev, dist, total / 2) };
    }
  }
  return best;
}

/** A raised loop with nothing under it at all: its whole length is the stretch. */
function closedLoop(part: readonly number[], adj: Adj): { lengthMm: number; mid: number } {
  let twice = 0;
  for (const n of part) for (const [, d] of adj.get(n) ?? []) twice += d;
  return { lengthMm: twice / 2, mid: part[0]! };
}

function shortest(source: number, startMm: number, inPart: Set<number>, adj: Adj) {
  const dist = new Map<number, number>([[source, startMm]]);
  const prev = new Map<number, number>();
  // Stretches are short chains of samples: a sorted frontier is plenty.
  const open = [source];
  while (open.length > 0) {
    open.sort((a, b) => dist.get(b)! - dist.get(a)!);
    const n = open.pop()!;
    for (const [m, d] of adj.get(n) ?? []) {
      if (!inPart.has(m)) continue;
      const nd = dist.get(n)! + d;
      if (nd < (dist.get(m) ?? Infinity)) {
        if (!dist.has(m)) open.push(m);
        dist.set(m, nd);
        prev.set(m, n);
      }
    }
  }
  return { dist, prev };
}

/** Back along the route from `last` to the sample nearest half way. */
function middleOf(last: number, prev: Map<number, number>, dist: Map<number, number>, half: number): number {
  let n = last;
  while (prev.has(n) && dist.get(n)! > half) n = prev.get(n)!;
  return n;
}
