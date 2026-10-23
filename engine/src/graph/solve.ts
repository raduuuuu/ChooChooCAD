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
import { classifyWelds, connectorSites, findVertexClashes, type AdapterJoint, type VertexClash, type WeldPolarityViolation } from './feasible.js';
import { findBridges, findPlankOverlaps, type PlankOverlap } from './overlap.js';
import { renderGraph } from './render.js';
import { findLevelFaults, placeAll, residuals, type LevelMismatch, type PortsOf, type ThirdLevel, type WeldResidual } from './frames.js';
import type { Graph } from './model.js';
import { pieceRepair, type PieceRepair, type RepairLibrary } from './repair.js';
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
      /** Planks crossing planks, ends nowhere near (overlap.ts). Both branches, like clashes. */
      readonly overlaps: readonly PlankOverlap[];
      readonly polarityViolations: readonly WeldPolarityViolation[];
      /** Welds where two sockets meet: buildable with a male-male adapter. Every branch. */
      readonly adapterJoints: readonly AdapterJoint[];
      /** Joints whose ends sit on different levels (frames.ts). Every branch: IMPOSSIBLE. */
      readonly levelMismatches: readonly LevelMismatch[];
      /** Ramps that would climb above the raised level. Every branch: IMPOSSIBLE. */
      readonly thirdLevels: readonly ThirdLevel[];
      /** Planks crossing on different levels: bridges. Never a fault; the clearance note counts them. */
      readonly bridges: readonly PlankOverlap[];
      /** Whether any track is off the floor, for the supports note (design 3A). */
      readonly raised: boolean;
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
      /**
       * The one straight that would close the one failing loop, when that is
       * exactly true (task X6, `repair.ts`). Null whenever any guard fails,
       * including when the caller passed no library to suggest from.
       */
      readonly repair: PieceRepair | null;
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
      /** Planks crossing planks, ends nowhere near (overlap.ts). Both branches, like clashes. */
      readonly overlaps: readonly PlankOverlap[];
      readonly polarityViolations: readonly WeldPolarityViolation[];
      /** Welds where two sockets meet: buildable with a male-male adapter. Every branch. */
      readonly adapterJoints: readonly AdapterJoint[];
      /** Joints whose ends sit on different levels (frames.ts). Every branch: IMPOSSIBLE. */
      readonly levelMismatches: readonly LevelMismatch[];
      /** Ramps that would climb above the raised level. Every branch: IMPOSSIBLE. */
      readonly thirdLevels: readonly ThirdLevel[];
      /** Planks crossing on different levels: bridges. Never a fault; the clearance note counts them. */
      readonly bridges: readonly PlankOverlap[];
      /** Whether any track is off the floor, for the supports note (design 3A). */
      readonly raised: boolean;
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
  /** Parts a repair may suggest, and how brands join. Omit for no suggestion. */
  library?: RepairLibrary,
): GraphResult {
  const placement = placeAll(graph, ports);
  const rs = residuals(graph, ports, placement);
  const rank = placement.forest.closing.length;

  // Computed once, up front, because every branch below reports them.
  const clashes = findVertexClashes(graph, ports, placement);
  const segments = renderGraph(graph, ports, resolve, placement).segments;
  const overlaps = findPlankOverlaps(
    graph,
    segments,
    (id) => resolve(id).plankWidthMm / 2,
    connectorSites(graph, ports, placement),
  );
  const { violations: polarityViolations, adapters: adapterJoints } = classifyWelds(graph, resolve, ports);
  const { mismatches: levelMismatches, thirdLevels } = findLevelFaults(graph, ports, placement, rs);
  const bridges = findBridges(graph, segments, (id) => resolve(id).plankWidthMm / 2, connectorSites(graph, ports, placement));
  const raised = segments.some((sg) => (sg.level ?? 0) + (sg.rise ?? 0) > 0);
  const levels = { levelMismatches, thirdLevels, bridges, raised };

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
    /*
     * "Both ends" is only true of a run with two. A switch adds a third, and
     * one run with no loop has exactly (ports - 2 x welds) of them free.
     */
    const freeEnds =
      graph.pieces.reduce((n, p) => n + ports(p).length, 0) - 2 * graph.welds.length;
    const pieces = `${graph.pieces.length} ${graph.pieces.length === 1 ? 'piece' : 'pieces'}`;
    return {
      ok: false,
      reason: 'NO_CYCLE',
      detail:
        runs <= 1
          ? freeEnds === 2
            ? `${pieces}, open at both ends`
            : `${pieces}, ${freeEnds} open ends`
          : `${runs} separate runs of track, none of them a loop`,
      rank,
      clashes,
      overlaps,
      polarityViolations,
      adapterJoints,
      ...levels,
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
   * TOO_BIG_TO_CHECK IS A BACKSTOP, and it is deliberately kept.
   *
   * Spending the work budget needs either a dense fundamental-sharing graph
   * or an enormous one. The dense route is shut: `weldEnds` only ever welds
   * FREE ports, `loadGraph` refuses a stored weld on an already-claimed
   * port, and no catalogue part has a third port, so every component is a
   * path or a cycle and no piece sits in two fundamentals. The large route is
   * open in principle and impractical in fact -- 150,000 welds is roughly
   * 14MB of JSON against a ~5MB storage quota.
   *
   * WHAT THAT DOES NOT LICENSE. An earlier version of this comment went on to
   * conclude that the route to an expensive solve was therefore shut, and
   * that inference is what let two real freezes through review: the all-pairs
   * overlap scan upstream of here (seconds at ten thousand pieces; the
   * figures are in the DONE entry in `docs/plan/brio-TODOS.md`) and a scanning
   * `slop` callback in `App.tsx` (quadratic in pieces; measured at the
   * callback). Neither needed a dense
   * graph, a duplicate weld, or anything this branch bounds. "The input this
   * guard refuses is unreachable" is a claim about this guard only, never
   * about the cost of a solve.
   *
   * Do not delete the branch as dead code: the dense route reopens the day a
   * switch part lands.
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
      overlaps,
      polarityViolations,
      adapterJoints,
      ...levels,
      residuals: rs,
    };
  }

  /*
   * RANK SAYS THERE ARE LOOPS; THE ENUMERATION TRACED NONE. Refuse.
   *
   * This was a false pass with nothing guarding it. `withinBound` below is
   * `space.cycles.every(...)`, which is vacuously TRUE on an empty array, and
   * `gapMm`/`totalGiveMm` come from `space.worst?.… ?? 0`, so a report with
   * rank 3 and no traced cycles rendered as EXACT: "This works. Closes
   * exactly, no give needed at any joint.", tone pass, green, over three
   * loops that were never examined.
   *
   * It is unreachable today only by accident: every fundamental is a closing
   * weld plus a simple tree path, so every vertex has degree exactly 2 and
   * `traceSimpleCycle` accepts it (a self-weld traces as a valid one-edge
   * loop). Nothing asserted that, and it stops being automatic the moment
   * `traceSimpleCycle` starts rejecting things -- which a third port makes
   * routine. The cheap guard is better than the accident.
   *
   * NUMERIC rather than a new reason, because its headline "Could not check
   * this layout." fits. Its ADVICE did not -- it promised a check still in
   * progress, and this refusal is deterministic and already finished -- so
   * the advice was reworded to cover both causes rather than split the
   * reason, since this arm is not reachable today.
   */
  if (space.cycles.length === 0) {
    return {
      ok: false,
      reason: 'NUMERIC',
      detail: `${rank} ${rank === 1 ? 'loop' : 'loops'} in this layout, but the check could not follow ${rank === 1 ? 'it' : 'them'} round`,
      rank,
      clashes,
      overlaps,
      polarityViolations,
      adapterJoints,
      ...levels,
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
      overlaps,
      polarityViolations,
      adapterJoints,
      ...levels,
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
      overlaps,
      polarityViolations,
      adapterJoints,
      ...levels,
      residuals: rs,
    };
  }

  // EVERY cycle, not the worst one's verdict: two loops each individually
  // fine is fine, and one bad loop fails the layout however good the rest.
  const withinBound = space.cycles.every((c) => c.withinGive);

  return {
    ok: true,
    closesExactly: rs.every((r) => r.closes),
    gapMm: space.worst?.gapMm ?? 0,
    totalGiveMm: space.worst?.giveMm ?? 0,
    withinBound,
    rank,
    cycles: space.cycles,
    worst: space.worst,
    clashes,
    overlaps,
    polarityViolations,
    adapterJoints,
    ...levels,
    residuals: rs,
    repair:
      withinBound || !library
        ? null
        : pieceRepair(graph, ports, placement, rs, space.cycles, resolve, library),
  };
}
