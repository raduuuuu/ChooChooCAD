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
import { placeAll, residuals, type PortsOf } from './frames.js';
import type { Graph } from './model.js';
import type { Part } from '../parts/schema.js';

export type GraphFailure = 'NO_CYCLE' | 'HEADING_MISMATCH' | 'TOO_MANY_LOOPS' | 'NUMERIC';

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
    }
  | {
      readonly ok: false;
      readonly reason: GraphFailure;
      readonly detail: string;
      readonly rank: number;
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
    };
  }

  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const portsById = (id: string) => ports(byId.get(id)!);
  const space = analyseCycles(graph, placement, rs, portsById, slop);

  if (space.truncated) {
    return {
      ok: false,
      reason: 'TOO_MANY_LOOPS',
      detail: `${rank} independent loops is more than this can rank`,
      rank,
    };
  }

  if (space.rotationBroken) {
    return {
      ok: false,
      reason: 'HEADING_MISMATCH',
      detail: 'the track does not come back pointing the way it started',
      rank,
    };
  }

  const gaps = space.cycles.map((c) => c.gapMm);
  const gives = space.cycles.map((c) => c.giveMm);
  if (![...gaps, ...gives].every((x) => Number.isFinite(x))) {
    return { ok: false, reason: 'NUMERIC', detail: 'a figure came out non-finite', rank };
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
    clashes: findVertexClashes(graph, ports, placement),
    polarityViolations: findWeldPolarityViolations(graph, resolve, ports),
  };
}
