/**
 * The graph verdict (T10, and what T5/T6/T9 were building toward).
 *
 * Mirrors `solveLayout` deliberately: same union, same ordering of checks,
 * same refusal to claim more than was checked. What changes is that every
 * number is now per-cycle, and the one place that matters is `withinBound`,
 * which is true only when EVERY cycle is within its OWN give. The chain
 * engine could not express that because it only ever had one cycle.
 *
 * ORDER OF CHECKS, and it is the same order for the same reason:
 *
 *   1. Impossible geometry first. Two distinct vertices in one place, or a
 *      weld that cannot mate. These OVERRIDE an exact closure, because
 *      sixteen large curves close perfectly and run the same circle twice.
 *   2. Rotation next. A loop that comes back turned is not a gap problem and
 *      no amount of joint give fixes it.
 *   3. Then, and only then, the gap against the give.
 */

import { analyseCycles, type CycleReport } from './cycles.js';
import { findVertexClashes, findWeldPolarityViolations, type VertexClash, type WeldPolarityViolation } from './feasible.js';
import { placeAll, residuals, type PortsOf, type WeldResidual } from './frames.js';
import type { Graph } from './model.js';
import type { Part } from '../parts/schema.js';

export type GraphFailure =
  | 'NO_CYCLE'
  | 'HEADING_MISMATCH'
  | 'TOO_MANY_LOOPS'
  | 'TOO_BIG_TO_CHECK'
  | 'NUMERIC';

export type GraphResult =
  | {
      readonly ok: true;
      readonly closesExactly: boolean;
      /** The worst cycle's gap. Per-cycle figures are in `cycles`. */
      readonly gapMm: number;
      /** The worst cycle's OWN give. Never a sum across loops. */
      readonly totalGiveMm: number;
      /** True only when EVERY cycle is within its own give. */
      readonly withinBound: boolean;
      readonly rank: number;
      readonly cycles: readonly CycleReport[];
      readonly worst: CycleReport | null;
      readonly clashes: readonly VertexClash[];
      readonly polarityViolations: readonly WeldPolarityViolation[];
      /**
       * One per closing weld, with the mismatch in millimetres.
       *
       * Reported alongside the cycle figures, not instead of them, because
       * they answer different questions. A cycle's gap says whether a LOOP
       * closes; a residual says which two ends are apart and by how much,
       * which is the only form of the answer a user can act on by swapping a
       * piece. A combined cycle sums several residuals, so there is no single
       * weld carrying its gap, which is exactly why the drawing annotates
       * welds and the sentence talks about loops.
       */
      readonly residuals: readonly WeldResidual[];
    }
  | {
      readonly ok: false;
      readonly reason: GraphFailure;
      readonly detail: string;
      readonly rank: number;
      /**
       * Reported even when there is no loop to check.
       *
       * These used to live only on the ok branch, so a layout with no cycle
       * returned NO_CYCLE and said nothing about two runs lying on top of
       * each other. Overlapping track is a fact about where the pieces ARE;
       * it does not become true only once you close a loop.
       */
      readonly clashes: readonly VertexClash[];
      readonly polarityViolations: readonly WeldPolarityViolation[];
      /**
       * Also on this branch, for the reason the clashes are: two ends being
       * 12mm apart is a fact about where the pieces ARE. It does not become
       * true only once the layout earns a rankable loop.
       */
      readonly residuals: readonly WeldResidual[];
    };

export function solveGraph(
  graph: Graph,
  ports: PortsOf,
  resolve: (id: string) => Part,
  slop: (pieceId: string) => number,
): GraphResult {
  const placement = placeAll(graph, ports);
  const rs = residuals(graph, ports, placement);
  const rank = placement.forest.closing.length;

  // Computed once, up front, because every branch below reports them.
  const clashes = findVertexClashes(graph, ports, placement);
  const polarityViolations = findWeldPolarityViolations(graph, resolve, ports);

  if (rank === 0) {
    /*
     * NO_CYCLE, not OPEN_CHAIN (T10). The old name was a chain artifact and
     * said something false about a graph: a layout can be a tree, a forest,
     * or four separate pieces on the table, none of which is "an open chain".
     * What is true in every one of those cases is that there is no loop to
     * check.
     */
    /*
     * The detail says what IS there, not a restatement of the headline.
     *
     * "Not a loop yet." followed by "nothing here forms a loop yet" is two
     * sentences carrying one fact. A graph knows something a chain could not:
     * how many separate runs of track are on the table. That is the useful
     * thing to say, and it is the first place the rewrite shows up in copy a
     * user reads.
     */
    const runs = placement.forest.roots.length;
    return {
      ok: false,
      reason: 'NO_CYCLE',
      detail:
        runs <= 1
          ? `${graph.pieces.length} ${graph.pieces.length === 1 ? 'piece' : 'pieces'}, open at both ends`
          : `${runs} separate runs of track, none of them a loop`,
      rank,
      clashes,
      polarityViolations,
      residuals: rs,
    };
  }

  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const portsById = (id: string) => ports(byId.get(id)!);
  const space = analyseCycles(graph, placement, rs, portsById, slop);

  /*
   * TWO LIMITS, TWO ANSWERS. `truncated` names which one stopped the walk,
   * and they are different things to tell someone.
   *
   * 'rank' is too many independent loops: the ceiling refused before any work
   * and the advice is to use fewer loops. 'work' is too much track to check
   * every loop in, at a rank that may be well UNDER the ceiling -- measured
   * at rank 14 over 8402 pieces. Both used to report TOO_MANY_LOOPS, so that
   * case told the user to break a layout into fewer loops when the loop count
   * was never the problem.
   *
   * TOO_BIG_TO_CHECK IS A BACKSTOP, NOT A PATH ANYONE CAN REACH TODAY, and it
   * is deliberately kept anyway. Spending the work budget needs a dense
   * fundamental-sharing graph, which needs one piece sitting in many cycles at
   * once. Both routes to that are now shut: `weldEnds` only ever welds FREE
   * ports, and `loadGraph` refuses a stored weld on an already-claimed port.
   * No part in the catalogue has a third port. So this branch is covered by
   * specs and by nothing a user can do, which is what a bound is for. Do not
   * delete it as dead code: the route reopens the day a switch part lands, and
   * this is what stops that being another 12-second freeze.
   */
  if (space.truncated) {
    const tooMany = space.truncated === 'rank';
    return {
      ok: false,
      reason: tooMany ? 'TOO_MANY_LOOPS' : 'TOO_BIG_TO_CHECK',
      detail: tooMany
        ? `${rank} independent loops is more than this can rank`
        : `checking all ${rank} loops across ${graph.pieces.length} pieces would take too long`,
      rank,
      clashes,
      polarityViolations,
      residuals: rs,
    };
  }

  if (space.rotationBroken) {
    return {
      ok: false,
      reason: 'HEADING_MISMATCH',
      detail: 'the track does not come back pointing the way it started',
      rank,
      clashes,
      polarityViolations,
      residuals: rs,
    };
  }

  const gaps = space.cycles.map((c) => c.gapMm);
  const gives = space.cycles.map((c) => c.giveMm);
  if (![...gaps, ...gives].every((x) => Number.isFinite(x))) {
    return {
      ok: false,
      reason: 'NUMERIC',
      detail: 'a figure came out non-finite',
      rank,
      clashes,
      polarityViolations,
      residuals: rs,
    };
  }

  return {
    ok: true,
    closesExactly: rs.every((r) => r.closes),
    gapMm: space.worst?.gapMm ?? 0,
    totalGiveMm: space.worst?.giveMm ?? 0,
    // EVERY cycle, not the worst one's verdict: two loops each individually
    // fine is fine, and one bad loop fails the layout however good the rest.
    withinBound: space.cycles.every((c) => c.withinGive),
    rank,
    cycles: space.cycles,
    worst: space.worst,
    clashes,
    polarityViolations,
    residuals: rs,
  };
}
