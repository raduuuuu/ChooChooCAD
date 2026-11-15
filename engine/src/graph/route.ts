/**
 * WHERE A TRAIN GOES (plan 2026-11-14, E5; eng review findings 6 to 9,
 * docs/plan/2026-11-14-additions-eng.md).
 *
 * A train enters a piece by one end, runs its road to another end, crosses
 * the joint there into the next piece, and so on, until it comes back round,
 * runs out of track, meets a buffer, or reaches somewhere it does not fit.
 *
 *   enter (piece, end) ──▶ the road from that end ──▶ leave by its far end ──▶ the joint ──▶ next (piece, end)
 *        ▲                                                                                        │
 *        └────────────────────────── seen this (piece, end) before: a LOOP ◀─────────────────────┘
 *
 * THE PATH IS THE DRAWN TRACK (finding 9). A leg is the segments the render
 * drew for that road, in the order the train meets them, so a route walked
 * on the track drawn bent follows the bends, and a hump climbs where it was
 * drawn climbing. Nothing here works a shape out again from the catalogue.
 *
 * AT A SWITCH, TWO WALKS. `walkRoute` keeps to the main road (owner, choice
 * C4): of the roads leaving the end it came in by, the first as the piece
 * lists them. One fixed rule, so the same layout gives the same route. It is
 * what a layout with no choice to make is described by, and what the tests
 * of fit and of loops stand on.
 *
 * `startJourney` is what a run shows since 2026-11-15 (owner: "a
 * probabilistic model that decides where the train goes"; an even chance
 * each time): at a switch it takes any of the roads leaving that end, each
 * with the same chance, decided afresh every time the train arrives. A
 * journey has no `lead` and `loop`: it is walked a leg at a time, for as far
 * as the run has got. `journeyEnds` says, before the dice are rolled, every
 * way such a journey CAN end, so the run's sentence never claims more than
 * was checked (DESIGN.md rule 3).
 *
 * IT ALWAYS STOPS (finding 6). "Back at the start" is not the test: a train
 * that enters a loop through a switch's tail never returns to where it
 * began. Every (piece, end) it enters by is remembered, and meeting one
 * again ends the walk, with the legs before that point as the `lead` (run
 * once) and the rest as the `loop` (round and round). A hard cap on legs
 * stands behind that.
 *
 * WHAT THIS DOES NOT DECIDE (finding 7, owner's choice C8). A joint in the
 * layout's data is not proof two ends meet: the verdict says whether the
 * layout works, and a run is offered only when it does. The walk still
 * refuses one thing itself, a joint whose two sides are on different levels,
 * because no train crosses that whatever the verdict.
 */

import type { FPose, Segment } from '../geom/fk.js';
import type { PortsOf } from './frames.js';
import type { Graph, Piece, PortRef } from './model.js';
import type { Opening } from './openings.js';
import type { GraphRender } from './render.js';

/** One piece's worth of a route: the road taken through it, as drawn, in the direction of travel. */
export interface Leg {
  readonly pieceId: string;
  /** The end the train comes in by, and the end it leaves by. */
  readonly from: number;
  readonly to: number;
  /** The road's segments in travel order, each pointing the way the train goes. */
  readonly path: readonly Segment[];
  readonly lengthMm: number;
}

export type RouteEnd =
  /** It comes round again: `loop` repeats for ever. */
  | 'loop'
  /** The track runs out at a free end. */
  | 'open end'
  /** It meets a buffer stop. */
  | 'buffer'
  /** It reaches an opening it does not fit under or through (`blockedBy`). */
  | 'blocked'
  /** The next joint's two sides are on different levels. */
  | 'step'
  /** The piece has no road from the end it was entered by. */
  | 'no road';

export interface Route {
  /** Legs run once, before any loop. The whole route when it does not come round. */
  readonly lead: readonly Leg[];
  /** Legs that repeat. Empty unless `end` is 'loop'. */
  readonly loop: readonly Leg[];
  readonly end: RouteEnd;
  /** The opening that stopped it, when `end` is 'blocked'. */
  readonly blockedBy?: Opening;
  /** How far along the LAST leg of `lead` the train gets before it stops there. Absent: to that leg's end. */
  readonly stopAtMm?: number;
}

const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

/** The angle a curved segment turns through, always positive. */
function sweepOf(s: Segment): number {
  return s.sweep === 'right' ? wrap(s.from.h - s.to.h) : wrap(s.to.h - s.from.h);
}

/** How long a drawn segment is along its centreline, in millimetres. */
export function segmentLength(s: Segment): number {
  if (s.kind === 'curve' && s.centrelineRadiusMm !== undefined) return s.centrelineRadiusMm * sweepOf(s);
  return Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
}

/** Where a train is, `mm` along a drawn segment from its `from` end, and which way it faces. */
export function poseOnSegment(s: Segment, mm: number): FPose {
  const length = segmentLength(s);
  const d = Math.max(0, Math.min(length, mm));
  if (s.kind === 'curve' && s.centrelineRadiusMm !== undefined) {
    const r = s.centrelineRadiusMm;
    const side = s.sweep === 'right' ? -1 : 1;
    // The centre is one radius to the side the curve bends toward.
    const cx = s.from.x - side * r * Math.sin(s.from.h);
    const cy = s.from.y + side * r * Math.cos(s.from.h);
    const h = s.from.h + side * (d / r);
    return { x: cx + side * r * Math.sin(h), y: cy - side * r * Math.cos(h), h };
  }
  const t = length === 0 ? 0 : d / length;
  return { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t, h: s.from.h };
}

/** A segment as met from its other end: ends swapped, facing about, bending the other way, climbing the other way. */
function turnedAbout(s: Segment): Segment {
  const about = (p: FPose): FPose => ({ x: p.x, y: p.y, h: p.h + Math.PI });
  const { highAtStart: _high, sweep: _sweep, alongMm: _along, ...rest } = s;
  const climbs = (s.rise ?? 0) !== 0;
  return {
    ...rest,
    from: about(s.to),
    to: about(s.from),
    ...(s.sweep ? { sweep: s.sweep === 'left' ? ('right' as const) : ('left' as const) } : {}),
    // A slope high at its far end is high at its start when met from that end.
    ...(climbs && !s.highAtStart ? { highAtStart: true as const } : {}),
    ...(s.alongMm ? { alongMm: [s.alongMm[1], s.alongMm[0]] as const } : {}),
  };
}

/** The level of track at each end of a segment as the train meets it: start, then end. */
function levelsOf(s: Segment): [number, number] {
  const low = s.level ?? 0;
  const high = low + (s.rise ?? 0);
  return s.highAtStart ? [high, low] : [low, high];
}

/** Whether the track the train leaves (`last`, absent at the start) and the track it meets are on one level. */
function sameLevel(last: Leg | undefined, next: readonly Segment[]): boolean {
  if (!last) return true;
  return levelsOf(last.path[last.path.length - 1]!)[1] === levelsOf(next[0]!)[0];
}

/** How high the train is, in levels, `mm` along a leg: 0 the floor, 1 the raised level, between them on a slope. */
export function levelAlong(leg: Leg, mm: number): number {
  let left = Math.max(0, Math.min(leg.lengthMm, mm));
  for (const s of leg.path) {
    const length = segmentLength(s);
    if (left <= length || s === leg.path[leg.path.length - 1]) {
      const [a, b] = levelsOf(s);
      return a + (b - a) * (length === 0 ? 0 : Math.min(1, left / length));
    }
    left -= length;
  }
  return 0;
}

/**
 * Which drawn segment the train is on `mm` along a leg, and how far along it
 * as a fraction 0..1. The 3D view stands the train on that segment's top.
 */
export function spotAlong(leg: Leg, mm: number): { readonly segment: Segment; readonly t: number } | null {
  let left = Math.max(0, Math.min(leg.lengthMm, mm));
  for (const s of leg.path) {
    const length = segmentLength(s);
    if (left <= length || s === leg.path[leg.path.length - 1]) {
      return { segment: s, t: length === 0 ? 0 : Math.min(1, left / length) };
    }
    left -= length;
  }
  return null;
}

/** Where the train is and which way it faces, `mm` along a leg. */
export function poseAlong(leg: Leg, mm: number): FPose {
  let left = Math.max(0, Math.min(leg.lengthMm, mm));
  for (const s of leg.path) {
    const length = segmentLength(s);
    if (left <= length || s === leg.path[leg.path.length - 1]) return poseOnSegment(s, left);
    left -= length;
  }
  return { x: 0, y: 0, h: 0 };
}

/** How near a crossing's place must be to a road's centreline to be on that road, in millimetres. */
const ON_ROAD_MM = 30;
/** How finely a leg is sampled to find where a crossing is along it. */
const SAMPLE_MM = 5;

/** How far along a leg the point nearest `at` is, or null when no point of the leg is within `ON_ROAD_MM` of it. */
function alongNearest(leg: Leg, at: readonly [number, number]): number | null {
  let best = Infinity;
  let where = 0;
  for (let mm = 0; mm <= leg.lengthMm; mm += SAMPLE_MM) {
    const p = poseAlong(leg, mm);
    const d = Math.hypot(p.x - at[0], p.y - at[1]);
    if (d < best) {
      best = d;
      where = mm;
    }
  }
  return best <= ON_ROAD_MM ? where : null;
}

/**
 * The first opening on this leg the train does not fit, and how far along
 * the leg it is. A tunnel is the whole piece, so the train stops before it.
 * A crossing overhead stops the train where the two cross, and only on the
 * road that passes under it (finding 8): another road of the same piece that
 * is not under the crossing is not stopped.
 */
function firstBlock(leg: Leg, openings: readonly Opening[]): { opening: Opening; atMm: number } | null {
  let first: { opening: Opening; atMm: number } | null = null;
  for (const o of openings) {
    if (o.fits || o.under !== leg.pieceId) continue;
    const atMm = o.kind === 'tunnel' || o.at === null ? 0 : alongNearest(leg, o.at);
    if (atMm === null) continue;
    if (first === null || atMm < first.atMm) first = { opening: o, atMm };
  }
  return first;
}

/**
 * The route of a train that enters the piece `start.pieceId` by its end
 * `start.port`.
 *
 * `render` is the track as drawn (bent, if the caller drew it bent): its
 * `roads` say which segments are which road. `openings` is the layout's
 * list from `openings.ts`, the same one the verdict's sentences come from.
 */
export function walkRoute(
  graph: Graph,
  ports: PortsOf,
  render: GraphRender,
  start: PortRef,
  openings: readonly Opening[] = [],
): Route {
  const pieceOf = new Map<string, Piece>(graph.pieces.map((p) => [p.pieceId, p]));
  const across = new Map<string, PortRef>();
  for (const w of graph.welds) {
    across.set(`${w.a.pieceId}#${w.a.port}`, w.b);
    across.set(`${w.b.pieceId}#${w.b.port}`, w.a);
  }

  const legs: Leg[] = [];
  /** The leg index at which each (piece, end) was entered. */
  const entered = new Map<string, number>();
  // A route with no loop enters each end of each road at most once; twice that is beyond any real walk.
  const cap = 2 * render.roads.length + 2;
  let at: PortRef = start;

  for (;;) {
    const key = `${at.pieceId}#${at.port}`;
    const before = entered.get(key);
    if (before !== undefined) {
      // Coming round to a joint whose two sides are on different levels is not coming round.
      if (!sameLevel(legs[legs.length - 1], legs[before]!.path)) return { lead: legs, loop: [], end: 'step' };
      return { lead: legs.slice(0, before), loop: legs.slice(before), end: 'loop' };
    }
    if (legs.length >= cap) return { lead: legs, loop: [], end: 'no road' };
    entered.set(key, legs.length);

    const piece = pieceOf.get(at.pieceId);
    if (!piece) return { lead: legs, loop: [], end: 'no road' };
    const local = ports(piece);
    // A buffer has one end and no road through: the train stops against it.
    if (local.length === 1) return { lead: legs, loop: [], end: 'buffer' };
    const out = local[at.port]?.along?.[0] ?? (local.length === 2 ? 1 - at.port : undefined);
    if (out === undefined) return { lead: legs, loop: [], end: 'no road' };
    const road = render.roads.find(
      (r) => r.pieceId === at.pieceId && ((r.from === at.port && r.to === out) || (r.from === out && r.to === at.port)),
    );
    if (!road) return { lead: legs, loop: [], end: 'no road' };

    const drawn = render.segments.slice(road.start, road.start + road.count);
    const path = road.from === at.port ? drawn : [...drawn].reverse().map(turnedAbout);
    const leg: Leg = {
      pieceId: at.pieceId,
      from: at.port,
      to: out,
      path,
      lengthMm: path.reduce((mm, s) => mm + segmentLength(s), 0),
    };

    // A joint whose two sides are on different levels is not one a train crosses.
    if (!sameLevel(legs[legs.length - 1], path)) return { lead: legs, loop: [], end: 'step' };

    legs.push(leg);
    const block = firstBlock(leg, openings);
    if (block) return { lead: legs, loop: [], end: 'blocked', blockedBy: block.opening, stopAtMm: block.atMm };

    const next = across.get(`${at.pieceId}#${out}`);
    if (!next) return { lead: legs, loop: [], end: 'open end' };
    at = next;
  }
}

/** The roads a train may take from the end it entered by: the ends it can leave by. More than one is a switch. */
export function roadsFrom(local: ReturnType<PortsOf>, port: number): readonly number[] {
  const along = local[port]?.along;
  if (along && along.length > 0) return along;
  return local.length === 2 ? [1 - port] : [];
}

/** How a journey stopped, and where. */
export interface JourneyStop {
  readonly end: Exclude<RouteEnd, 'loop'>;
  /** The piece it stopped on or after. Absent when it never got onto one. */
  readonly pieceId?: string;
  readonly blockedBy?: Opening;
}

/**
 * A JOURNEY: the legs a train has run so far, and how to run the next.
 *
 *   legs so far ── extendTo(mm) ──▶ more legs, one at a time, until `mm` is covered or the journey stops
 *                       │
 *                       └─ at a switch: `pick(n)` chooses one of its n roads
 *
 * `pick(n)` returns a whole number from 0 to n - 1. The caller owns the
 * dice, so a test hands in its own and a run hands in a seeded source: the
 * same seed gives the same journey, whoever asks first or how often.
 */
export interface Journey {
  /** The legs run so far, in order. It grows; a leg once there never changes. */
  readonly legs: readonly Leg[];
  /** How it stopped; null while there is still track ahead. */
  readonly stop: JourneyStop | null;
  /** How far along the LAST leg it gets, when it stopped part-way (an opening it does not fit). */
  readonly stopAtMm?: number;
  /** The length of the legs so far, cut short at `stopAtMm`. */
  readonly lengthMm: number;
  /** Walk on until the journey is at least `mm` long, or has stopped. */
  extendTo(mm: number): void;
}

/** A leg cap for one `extendTo`: a layout of zero-length roads must not spin for ever. */
const LEGS_PER_EXTEND = 10_000;

export function startJourney(
  graph: Graph,
  ports: PortsOf,
  render: GraphRender,
  start: PortRef,
  openings: readonly Opening[],
  pick: (choices: number) => number,
): Journey {
  const pieceOf = new Map<string, Piece>(graph.pieces.map((p) => [p.pieceId, p]));
  const across = new Map<string, PortRef>();
  for (const w of graph.welds) {
    across.set(`${w.a.pieceId}#${w.a.port}`, w.b);
    across.set(`${w.b.pieceId}#${w.b.port}`, w.a);
  }
  const legs: Leg[] = [];
  let at: PortRef = start;
  let stop: JourneyStop | null = null;
  let stopAtMm: number | undefined;
  let lengthMm = 0;

  const step = (): void => {
    const last = legs[legs.length - 1];
    const piece = pieceOf.get(at.pieceId);
    if (!piece) return void (stop = { end: 'no road', ...(last ? { pieceId: last.pieceId } : {}) });
    const local = ports(piece);
    if (local.length === 1) return void (stop = { end: 'buffer', ...(last ? { pieceId: last.pieceId } : {}) });
    const outs = roadsFrom(local, at.port);
    if (outs.length === 0) return void (stop = { end: 'no road', pieceId: at.pieceId });
    const chosen = outs.length === 1 ? 0 : Math.max(0, Math.min(outs.length - 1, Math.floor(pick(outs.length))));
    const out = outs[chosen]!;
    const road = render.roads.find(
      (r) => r.pieceId === at.pieceId && ((r.from === at.port && r.to === out) || (r.from === out && r.to === at.port)),
    );
    if (!road) return void (stop = { end: 'no road', pieceId: at.pieceId });
    const drawn = render.segments.slice(road.start, road.start + road.count);
    const path = road.from === at.port ? drawn : [...drawn].reverse().map(turnedAbout);
    const leg: Leg = { pieceId: at.pieceId, from: at.port, to: out, path, lengthMm: path.reduce((mm, s) => mm + segmentLength(s), 0) };
    if (!sameLevel(last, path)) return void (stop = { end: 'step', ...(last ? { pieceId: last.pieceId } : {}) });
    legs.push(leg);
    const block = firstBlock(leg, openings);
    if (block) {
      stopAtMm = block.atMm;
      lengthMm += Math.min(block.atMm, leg.lengthMm);
      return void (stop = { end: 'blocked', pieceId: leg.pieceId, blockedBy: block.opening });
    }
    lengthMm += leg.lengthMm;
    const next = across.get(`${at.pieceId}#${out}`);
    if (!next) return void (stop = { end: 'open end', pieceId: leg.pieceId });
    at = next;
  };

  return {
    legs,
    get stop() {
      return stop;
    },
    get stopAtMm() {
      return stopAtMm;
    },
    get lengthMm() {
      return lengthMm;
    },
    extendTo(mm: number) {
      for (let n = 0; n < LEGS_PER_EXTEND && stop === null && lengthMm < mm; n++) step();
    },
  };
}

/** Every way a journey from `start` can go, whatever the dice say. */
export interface JourneyEnds {
  /** Whether any switch on the way offers more than one road. */
  readonly choices: boolean;
  /** Each distinct way it can stop, in the order found. Empty: it can never stop. */
  readonly stops: readonly JourneyStop[];
  /** Whether it can run for ever (some road it can take comes round again). */
  readonly runsOn: boolean;
  /** Every piece it can reach. */
  readonly pieces: ReadonlySet<string>;
}

/**
 * WHAT CAN HAPPEN, BEFORE ANY DICE (DESIGN.md rule 3). Every (piece, end) a
 * train from `start` can enter by is visited once, taking every road at
 * every switch. So the stops listed are all of them, and `runsOn` is true
 * exactly when some entry can be met twice.
 *
 * A stop at a step between levels is found from each side that reaches it,
 * as the walks find it.
 */
export function journeyEnds(graph: Graph, ports: PortsOf, render: GraphRender, start: PortRef, openings: readonly Opening[] = []): JourneyEnds {
  const pieceOf = new Map<string, Piece>(graph.pieces.map((p) => [p.pieceId, p]));
  const across = new Map<string, PortRef>();
  for (const w of graph.welds) {
    across.set(`${w.a.pieceId}#${w.a.port}`, w.b);
    across.set(`${w.b.pieceId}#${w.b.port}`, w.a);
  }
  const stops: JourneyStop[] = [];
  const seenStop = new Set<string>();
  const note = (s: JourneyStop) => {
    const key = `${s.end}|${s.pieceId ?? ''}|${s.blockedBy ? `${s.blockedBy.kind}:${s.blockedBy.over}` : ''}`;
    if (!seenStop.has(key)) {
      seenStop.add(key);
      stops.push(s);
    }
  };
  const pieces = new Set<string>();
  /** 1 while an entry is on the path being walked, 2 once everything beyond it is known. */
  const state = new Map<string, 1 | 2>();
  let choices = false;
  let runsOn = false;

  // Depth first, with its own stack: a long layout must not overflow the call stack.
  type Frame = { readonly key: string; readonly nexts: { readonly to: PortRef }[]; i: number };
  const open = (at: PortRef, last: Leg | undefined): Frame | null => {
    const key = `${at.pieceId}#${at.port}`;
    const st = state.get(key);
    if (st === 1) {
      runsOn = true;
      return null;
    }
    if (st === 2) return null;
    state.set(key, 1);
    const frame: Frame = { key, nexts: [], i: 0 };
    const piece = pieceOf.get(at.pieceId);
    if (!piece) {
      note({ end: 'no road', ...(last ? { pieceId: last.pieceId } : {}) });
      return frame;
    }
    const local = ports(piece);
    if (local.length === 1) {
      note({ end: 'buffer', ...(last ? { pieceId: last.pieceId } : {}) });
      return frame;
    }
    const outs = roadsFrom(local, at.port);
    if (outs.length === 0) note({ end: 'no road', pieceId: at.pieceId });
    if (outs.length > 1) choices = true;
    for (const out of outs) {
      const road = render.roads.find(
        (r) => r.pieceId === at.pieceId && ((r.from === at.port && r.to === out) || (r.from === out && r.to === at.port)),
      );
      if (!road) {
        note({ end: 'no road', pieceId: at.pieceId });
        continue;
      }
      const drawn = render.segments.slice(road.start, road.start + road.count);
      const path = road.from === at.port ? drawn : [...drawn].reverse().map(turnedAbout);
      const leg: Leg = { pieceId: at.pieceId, from: at.port, to: out, path, lengthMm: 0 };
      if (!sameLevel(last, path)) {
        note({ end: 'step', ...(last ? { pieceId: last.pieceId } : {}) });
        continue;
      }
      pieces.add(at.pieceId);
      const block = firstBlock({ ...leg, lengthMm: path.reduce((mm, s) => mm + segmentLength(s), 0) }, openings);
      if (block) {
        note({ end: 'blocked', pieceId: at.pieceId, blockedBy: block.opening });
        continue;
      }
      const next = across.get(`${at.pieceId}#${out}`);
      if (!next) {
        note({ end: 'open end', pieceId: at.pieceId });
        continue;
      }
      frame.nexts.push({ to: next });
      lastLeg.set(`${key}>${next.pieceId}#${next.port}`, leg);
    }
    return frame;
  };
  const lastLeg = new Map<string, Leg>();
  const stack: Frame[] = [];
  const first = open(start, undefined);
  if (first) stack.push(first);
  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    const next = top.nexts[top.i++];
    if (!next) {
      state.set(top.key, 2);
      stack.pop();
      continue;
    }
    const frame = open(next.to, lastLeg.get(`${top.key}>${next.to.pieceId}#${next.to.port}`));
    if (frame) stack.push(frame);
  }
  return { choices, stops, runsOn, pieces };
}
