/**
 * A TRAIN RUN: WHERE THE TRAIN IS, AND WHAT THE RUN SAYS (plan 2026-11-14,
 * E5, step 6; docs/plan/2026-11-14-additions-eng.md).
 *
 * `engine/src/graph/route.ts` says where a train goes. This turns that into
 * a place at a moment, and into the sentence shown with the run.
 *
 *   route (lead, then loop) ── distance run ──▶ where the train is, which way it faces, how high
 *        │
 *        └── how it ends ──▶ "A train gets all the way round." / where it stops, and why
 *
 * THE SAME PLACE AT THE SAME MOMENT, ON EVERY MACHINE. Time is cut into fixed
 * steps (`STEP_MS`) and the train moves a fixed distance per step, so its
 * place at 2.5 seconds is the same number whatever the frame rate, and a test
 * can ask for it with no clock.
 *
 * A RUN ROLLS ITS OWN DICE (owner, 2026-11-15). At a switch the train takes
 * any road, each with the same chance, so two runs of one layout differ. One
 * run does not: its dice are a seeded sequence (`dice`), so the plan and the
 * 3D view, asking in any order, are shown the same journey.
 *
 * THE WORDS ARE THE VERDICT'S. Where a train does not fit, the run says it in
 * the verdict line's own phrases ("may not pass under", "may not fit
 * through"), because they come from the same list (`openings.ts`) and must
 * not sound like two opinions. It names the train it ran, the app's one
 * measured train, and never claims another train would pass.
 *
 * Loaded on first use, with the route walker (plan choice C7): none of this
 * is in the editor's first load.
 */

import type { FPose, Segment } from '../../engine/src/geom/fk.js';
import type { PortsOf } from '../../engine/src/graph/frames.js';
import type { Graph, PortRef } from '../../engine/src/graph/model.js';
import type { Opening } from '../../engine/src/graph/openings.js';
import { levelAlong, poseAlong, spotAlong, type Journey, type JourneyEnds, type JourneyStop, type Leg, type Route } from '../../engine/src/graph/route.js';
import { TRAIN_CARS, TRAIN_HEAD_MM } from './trainShape.js';

/** One step of the run's clock, in milliseconds: a sixtieth of a second. */
export const STEP_MS = 1000 / 60;
/** How fast the train goes, in millimetres a second: a little over a train's length each second, slow enough to follow. */
export const TRAIN_SPEED_MM_S = 240;

/** How far the train has run after `elapsedMs`, counted in whole steps of the clock. */
export function distanceAfter(elapsedMs: number): number {
  const steps = Math.max(0, Math.floor(elapsedMs / STEP_MS));
  return (steps * STEP_MS * TRAIN_SPEED_MM_S) / 1000;
}

export interface TrainAt {
  readonly pose: FPose;
  /** How high, in levels: 0 the floor, 1 the raised level, between them on a slope. */
  readonly level: number;
  /** The piece it is on. */
  readonly pieceId: string;
  /** The drawn segment it is on, and how far along it (0..1): the 3D view stands the train on this segment's top. */
  readonly on: Segment | null;
  readonly t: number;
  /** True once the train has reached the end of a route that ends. Never true on a loop. */
  readonly done: boolean;
}

/** How long the part run once is: the lead, cut short where the train stops. */
export function leadLength(route: Route): number {
  const full = route.lead.reduce((mm, leg) => mm + leg.lengthMm, 0);
  const last = route.lead[route.lead.length - 1];
  return route.stopAtMm !== undefined && last ? full - last.lengthMm + Math.min(route.stopAtMm, last.lengthMm) : full;
}

const lengthOf = (legs: readonly Leg[]) => legs.reduce((mm, leg) => mm + leg.lengthMm, 0);

function within(legs: readonly Leg[], mm: number): { leg: Leg; at: number } | null {
  let left = mm;
  for (const leg of legs) {
    if (left <= leg.lengthMm) return { leg, at: left };
    left -= leg.lengthMm;
  }
  const last = legs[legs.length - 1];
  return last ? { leg: last, at: last.lengthMm } : null;
}

/**
 * Where the train is after running `mm` from the start of the route: along
 * the lead once, then round the loop for as long as it is asked. Null for a
 * route with nowhere to be (no legs at all).
 */
export function trainAt(route: Route, mm: number): TrainAt | null {
  const lead = leadLength(route);
  const loop = lengthOf(route.loop);
  const run = Math.max(0, mm);
  const onLoop = route.end === 'loop' && loop > 0 && run >= lead;
  const spot = onLoop ? within(route.loop, (run - lead) % loop) : within(route.lead, Math.min(run, lead));
  if (!spot) return null;
  const on = spotAlong(spot.leg, spot.at);
  return {
    pose: poseAlong(spot.leg, spot.at),
    level: levelAlong(spot.leg, spot.at),
    pieceId: spot.leg.pieceId,
    on: on?.segment ?? null,
    t: on?.t ?? 0,
    done: !onLoop && route.end !== 'loop' && run >= lead,
  };
}

/**
 * Where a run starts: the selected piece when it has a road, or else the
 * first piece laid that has one. The train goes in by the piece's first end.
 * Null when no piece has a road (an empty layout, or only buffers and piers).
 */
export function startOf(graph: Graph, ports: PortsOf, selected: string | null): PortRef | null {
  const hasRoad = (pieceId: string) => {
    const piece = graph.pieces.find((p) => p.pieceId === pieceId);
    return piece !== undefined && ports(piece).length >= 2;
  };
  if (selected !== null && hasRoad(selected)) return { pieceId: selected, port: 0 };
  const first = graph.pieces.find((p) => hasRoad(p.pieceId));
  return first ? { pieceId: first.pieceId, port: 0 } : null;
}

export interface RunWordsInput {
  readonly route: Route;
  /** Every opening on the layout (`openings.ts`), to say when one on the route is an estimate. */
  readonly openings: readonly Opening[];
  /** The train's height in millimetres, and whether it was measured (`CLEARANCE`). */
  readonly trainMm: number;
  readonly trainMeasured: boolean;
  /** A piece's number in the layout, as the verdict numbers pieces. */
  readonly numberOf: (pieceId: string) => number;
  /** A piece's name as a sentence says it: "stone arch bridge". */
  readonly nameOf: (pieceId: string) => string;
  /** How many ends a piece has: more than two is a switch or a crossing. */
  readonly endsOf: (pieceId: string) => number;
}

/** What `walkRoute`'s fixed rule is, said beside a route walked by it. A journey takes any road and never says this. */
export const MAIN_ROAD_LINE = 'It keeps to the main road at switches.';

/** What the run says: how it ends, then what it rests on. One sentence each. */
export function runWords(input: RunWordsInput): readonly string[] {
  const { route, numberOf, nameOf } = input;
  const legs = [...route.lead, ...route.loop];
  const last = route.lead[route.lead.length - 1] ?? legs[legs.length - 1];
  const where = last ? `piece ${numberOf(last.pieceId)}` : 'the start';
  const out: string[] = [];

  switch (route.end) {
    case 'loop':
      out.push(route.lead.length > 0 ? 'A train runs in, then gets all the way round, again and again.' : 'A train gets all the way round.');
      break;
    case 'open end':
      out.push(`A train runs to the end of the track at ${where}.`);
      break;
    case 'buffer':
      out.push(`A train runs to the buffer after ${where}.`);
      break;
    case 'step':
      out.push(`A train stops after ${where}: the next joint is a step between levels.`);
      break;
    case 'no road':
      out.push(`A train has no road to take at ${where}.`);
      break;
    case 'blocked': {
      const o = route.blockedBy!;
      // The verdict line's own phrases for the same opening (VerdictLine.tsx `TrainFit`).
      const why =
        o.kind === 'tunnel'
          ? `it may not fit through the ${nameOf(o.over)}`
          : o.kind === 'bridge'
            ? `it may not pass under the ${nameOf(o.over)}`
            : 'it may not pass under raised track';
      out.push(`The train stops at ${where}: ${why}.`);
      break;
    }
  }

  out.push(
    `This is the ${input.trainMm}mm train the app measures with${input.trainMeasured ? '' : ', whose height is an estimate'}; another train may differ.`,
  );
  const on = new Set(legs.map((l) => l.pieceId));
  if (input.openings.some((o) => o.estimated && on.has(o.under))) out.push('An opening on its way is an estimate.');
  if (legs.some((l) => input.endsOf(l.pieceId) > 2)) out.push(MAIN_ROAD_LINE);
  return out;
}

/**
 * The dice for one run: whole numbers from 0 to n - 1, each as likely as the
 * next, from a seed (mulberry32). The same seed gives the same sequence, so
 * one run is one journey however often it is asked about.
 */
export function dice(seed: number): (choices: number) => number {
  let a = seed >>> 0;
  return (choices) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * choices);
  };
}

/**
 * Where each car of the train is once the ENGINE has run `mm` along the
 * journey, engine first. The journey is walked on as far as that needs. A
 * wagon rides its own distance behind the engine along the track, and waits
 * at the start while the track behind it has not been run yet. Empty when
 * the journey has nowhere to be.
 */
export function carsOn(journey: Journey): (mm: number) => readonly TrainAt[] {
  /** Where each leg ends, along the journey: filled as the legs appear. */
  const ends: number[] = [];
  const spot = (d: number, done: boolean): TrainAt | null => {
    let lo = 0;
    let hi = ends.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ends[mid]! >= d) hi = mid;
      else lo = mid + 1;
    }
    const leg = journey.legs[lo];
    if (!leg) return null;
    const at = Math.max(0, Math.min(leg.lengthMm, d - (ends[lo - 1] ?? 0)));
    const on = spotAlong(leg, at);
    return { pose: poseAlong(leg, at), level: levelAlong(leg, at), pieceId: leg.pieceId, on: on?.segment ?? null, t: on?.t ?? 0, done };
  };
  return (mm) => {
    const asked = Math.max(0, mm) + TRAIN_HEAD_MM;
    journey.extendTo(asked);
    for (let i = ends.length; i < journey.legs.length; i++) ends.push((ends[i - 1] ?? 0) + journey.legs[i]!.lengthMm);
    if (journey.legs.length === 0) return [];
    const engine = Math.min(asked, journey.lengthMm);
    const done = journey.stop !== null && asked >= journey.lengthMm;
    const out: TrainAt[] = [];
    for (const car of TRAIN_CARS) {
      const at = spot(Math.max(0, engine - car.behindMm), done);
      if (at) out.push(at);
    }
    return out;
  };
}

export interface JourneyWordsInput extends Omit<RunWordsInput, 'route'> {
  /** The main-road route, which is the whole story when no switch offers a choice. */
  readonly route: Route;
  /** Every way a journey can go (`journeyEnds`). */
  readonly ends: JourneyEnds;
}

/** At most this many of the ways a journey can stop are named; the rest are counted. */
const STOPS_NAMED = 2;

/**
 * What a run says BEFORE the dice are rolled: every way it can go, never one
 * journey's luck (DESIGN.md rule 3).
 *
 *   no switch offers a choice ─▶ the fixed route's own sentences (`runWords`)
 *   it can never stop ─────────▶ "A train keeps running, whichever road it takes at a switch."
 *   it can stop, and can run on ▶ "A train runs until a switch sends it down a road that ends." + where
 *   every road ends ───────────▶ "Whichever road a train takes at a switch, it comes to a stop." + where
 */
export function journeyWords(input: JourneyWordsInput): readonly string[] {
  const { ends, numberOf, nameOf } = input;
  if (!ends.choices) return runWords(input).filter((line) => line !== MAIN_ROAD_LINE);
  const where = (s: JourneyStop): string => {
    const piece = s.pieceId === undefined ? 'the start' : `piece ${numberOf(s.pieceId)}`;
    switch (s.end) {
      case 'open end':
        return `the track ends at ${piece}`;
      case 'buffer':
        return `there is a buffer after ${piece}`;
      case 'step':
        return `the joint after ${piece} is a step between levels`;
      case 'no road':
        return `there is no road to take at ${piece}`;
      case 'blocked': {
        const o = s.blockedBy!;
        // The verdict line's own phrases for the same opening (VerdictLine.tsx `TrainFit`).
        const why = o.kind === 'tunnel' ? `fit through the ${nameOf(o.over)}` : o.kind === 'bridge' ? `pass under the ${nameOf(o.over)}` : 'pass under raised track';
        return `it may not ${why} at ${piece}`;
      }
    }
  };
  const out: string[] = [];
  if (ends.stops.length === 0) out.push('A train keeps running, whichever road it takes at a switch.');
  else {
    out.push(ends.runsOn ? 'A train runs until a switch sends it down a road that ends.' : 'Whichever road a train takes at a switch, it comes to a stop.');
    const named = ends.stops.slice(0, STOPS_NAMED).map(where);
    const more = ends.stops.length - named.length;
    const list = named.join('; ');
    out.push(`It stops where ${list}${more > 0 ? `, and in ${more} more ${more === 1 ? 'place' : 'places'}` : ''}.`);
  }
  out.push('At a switch it takes any road, each with the same chance, so no two runs need be alike.');
  out.push(`This is the ${input.trainMm}mm train the app measures with${input.trainMeasured ? '' : ', whose height is an estimate'}; another train may differ.`);
  if (input.openings.some((o) => o.estimated && ends.pieces.has(o.under))) out.push('An opening on its way is an estimate.');
  return out;
}
