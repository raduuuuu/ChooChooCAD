/**
 * PLAN A TRAIN RUN (plan 2026-11-14, E5, step 6). The one door from the app
 * into the route walker and the playback, so the app loads all of it with a
 * single `import('./trainRun.js')` on the first press of "Run a train" and
 * none of it before (plan choice C7).
 */

import { CLEARANCE } from '../../engine/data/rampSeeds.js';
import type { PortsOf } from '../../engine/src/graph/frames.js';
import type { Graph } from '../../engine/src/graph/model.js';
import { openings } from '../../engine/src/graph/openings.js';
import type { GraphRender } from '../../engine/src/graph/render.js';
import { walkRoute, type Route } from '../../engine/src/graph/route.js';
import type { GraphResult } from '../../engine/src/graph/solve.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { distanceAfter, runWords, startOf, trainAt, type TrainAt } from './playback.js';

export interface TrainRun {
  readonly route: Route;
  /** What the run says, a sentence each. */
  readonly words: readonly string[];
  /** Where the train is `elapsedMs` after the run began. Null when the route has nowhere to be. */
  readonly at: (elapsedMs: number) => TrainAt | null;
}

export interface TrainRunInput {
  readonly graph: Graph;
  readonly ports: PortsOf;
  readonly resolve: (partId: string) => Part;
  /** The track as the canvas draws it, bent where the joints bend: the train follows this. */
  readonly drawn: GraphRender;
  /** The solver's answer for this layout: the openings are read from it, as the verdict's sentences are. */
  readonly result: GraphResult;
  readonly selected: string | null;
}

/** The run for this layout, or null when no piece has a road to start on. */
export function planRun(input: TrainRunInput): TrainRun | null {
  const { graph, ports, resolve, drawn, result, selected } = input;
  const start = startOf(graph, ports, selected);
  if (!start) return null;
  const partOf = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId)]));
  const number = new Map(graph.pieces.map((p, i) => [p.pieceId, i + 1]));
  const open = openings(result, graph.pieces, resolve, drawn.segments, CLEARANCE);
  const route = walkRoute(graph, ports, drawn, start, open);
  const words = runWords({
    route,
    openings: open,
    trainMm: CLEARANCE.trainMm,
    trainMeasured: CLEARANCE.trainMeasured,
    numberOf: (id) => number.get(id)!,
    nameOf: (id) => partOf.get(id)!.name.toLowerCase(),
    endsOf: (id) => {
      const piece = graph.pieces.find((p) => p.pieceId === id);
      return piece ? ports(piece).length : 0;
    },
  });
  return { route, words, at: (elapsedMs) => trainAt(route, distanceAfter(elapsedMs)) };
}
