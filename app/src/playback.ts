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
 * THE SAME RUN EVERY TIME, ON EVERY MACHINE. Time is cut into fixed steps
 * (`STEP_MS`) and the train moves a fixed distance per step, so its place at
 * 2.5 seconds is the same number whatever the frame rate, and a test can ask
 * for it with no clock.
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

import type { FPose } from '../../engine/src/geom/fk.js';
import type { PortsOf } from '../../engine/src/graph/frames.js';
import type { Graph, PortRef } from '../../engine/src/graph/model.js';
import type { Opening } from '../../engine/src/graph/openings.js';
import { levelAlong, poseAlong, type Leg, type Route } from '../../engine/src/graph/route.js';

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
  return {
    pose: poseAlong(spot.leg, spot.at),
    level: levelAlong(spot.leg, spot.at),
    pieceId: spot.leg.pieceId,
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
  if (legs.some((l) => input.endsOf(l.pieceId) > 2)) out.push('It keeps to the main road at switches.');
  return out;
}
