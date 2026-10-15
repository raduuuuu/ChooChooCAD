/**
 * THE CYCLE SPACE (tasks T5 and T6).
 *
 * A chain had one loop or none, so one gap was the whole answer. A graph has
 * a cycle rank of E - V + CC, and every independent loop is its own question.
 *
 * TWO RULES, and the second is the one that changes verdicts.
 *
 * 1. Rank comes from the forest, not from a formula. `closing.length` IS the
 *    rank by construction, so it cannot drift from the thing it describes.
 *
 * 2. GIVE IS NEVER POOLED. Each cycle is checked against the give of ITS OWN
 *    welds. Slack in one loop cannot pay for a gap in another, because the
 *    pieces are not shared: pushing a joint in the left loop to absorb 2mm
 *    does nothing for the right loop's joints. The architecture review
 *    measured 9 distinct gaps around 10 pieces per cycle where pooling flips
 *    the verdict from "will not fit" to "might", which is a false pass on a
 *    layout somebody then tries to build.
 *
 * WHY ONLY ALIGNED CYCLES GET A COMBINED GAP. Weld defects compose in SE(2),
 * where a rotation followed by a translation is not the same as the reverse,
 * so the gaps of two cycles do not simply add when either carries a rotation
 * error. They do add, exactly, when every closing weld is rotation-aligned,
 * because pure translations commute. That is not a restriction in practice:
 * a layout that comes back pointing the wrong way already fails on rotation,
 * and no amount of joint give fixes a rotation. So when any closing weld is
 * misaligned this reports that fact and does not rank gaps it cannot add.
 */

import { type Cyc, ZERO, add, magnitude, scale } from '../geom/cyclotomic.js';
import type { Forest } from './forest.js';
import { type Placement, type WeldResidual } from './frames.js';
import type { Graph, Port } from './model.js';
import { weldGiveMm } from './model.js';

/**
 * Above this rank the cycle space is not enumerated.
 *
 * 2^rank subsets, so 20 is about a million. The point of the ceiling is that
 * exceeding it REPORTS "too many loops to rank" rather than quietly falling
 * back to the fundamental basis: a basis cycle is an arbitrary choice of
 * which loops to look at, and presenting one as "the worst" would be a claim
 * nobody checked. It is a bound on the INPUT, tested before any enumeration
 * begins, so a hostile graph cannot spend the time before being refused.
 */
export const CYCLE_RANK_CEILING = 20;

export interface CycleReport {
  /** Weld indices forming this cycle. */
  readonly welds: readonly number[];
  /** Pieces the cycle passes through. */
  readonly pieces: readonly string[];
  /** Exact closure error. Zero means this loop closes. */
  readonly gap: Cyc;
  readonly gapMm: number;
  /** Give from THIS cycle's welds only. Never pooled with another's. */
  readonly giveMm: number;
  /** The necessary condition: a false here means it definitely does not fit. */
  readonly withinGive: boolean;
}

export interface CycleSpace {
  /** E - V + CC, taken from the forest's leftover welds. */
  readonly rank: number;
  /** True when rank exceeded the ceiling and nothing was enumerated. */
  readonly truncated: boolean;
  /** True when some closing weld is rotated, so gaps cannot be combined. */
  readonly rotationBroken: boolean;
  readonly cycles: readonly CycleReport[];
  /** The cycle furthest over its own give. Null when there are none. */
  readonly worst: CycleReport | null;
}

type PortsOf = (pieceId: string) => readonly Port[];
type SlopOf = (pieceId: string) => number;

/** Tree edges from a piece up to its component root, nearest first. */
function pathToRoot(forest: Forest, pieceId: string): number[] {
  const out: number[] = [];
  let at = pieceId;
  for (;;) {
    const link = forest.parent.get(at);
    if (!link) return out;
    out.push(link.weld);
    at = link.from;
  }
}

/**
 * The fundamental cycle of a closing weld: the weld, plus the tree path
 * between its two endpoints. Built by cancelling the shared tail of the two
 * root paths, which is the lowest common ancestor without computing one.
 */
function fundamentalCycle(graph: Graph, forest: Forest, closingWeld: number): number[] {
  const weld = graph.welds[closingWeld]!;
  const up = pathToRoot(forest, weld.a.pieceId);
  const down = pathToRoot(forest, weld.b.pieceId);
  const shared = new Set(up.filter((w) => down.includes(w)));
  return [
    closingWeld,
    ...up.filter((w) => !shared.has(w)),
    ...down.filter((w) => !shared.has(w)),
  ];
}

/**
 * Walk an edge set that forms a simple cycle, returning the pieces in order
 * and the direction each weld is traversed. Returns null when the edge set is
 * not a single simple cycle: disconnected, or a vertex of degree other than 2.
 *
 * Degree exactly 2 is the filter that makes this SIMPLE cycles rather than
 * any connected even subgraph. A vertex of degree 4 is two loops meeting at a
 * piece, and reporting that as one cycle would pool the give of both, which
 * is the thing rule 2 forbids.
 */
function traceSimpleCycle(
  graph: Graph,
  edges: readonly number[],
): { pieces: string[]; forward: Map<number, boolean> } | null {
  if (edges.length === 0) return null;
  const incident = new Map<string, number[]>();
  for (const e of edges) {
    const w = graph.welds[e]!;
    for (const id of [w.a.pieceId, w.b.pieceId]) {
      if (!incident.has(id)) incident.set(id, []);
      incident.get(id)!.push(e);
    }
  }
  for (const list of incident.values()) if (list.length !== 2) return null;

  const start = graph.welds[edges[0]!]!.a.pieceId;
  const pieces: string[] = [];
  const forward = new Map<number, boolean>();
  let at = start;
  let prevEdge = -1;
  for (let step = 0; step < edges.length; step++) {
    pieces.push(at);
    const next = incident.get(at)!.find((e) => e !== prevEdge);
    if (next === undefined) return null;
    const w = graph.welds[next]!;
    // Traversed a-to-b means the weld's own orientation, which is the sign
    // its residual was measured with.
    forward.set(next, w.a.pieceId === at);
    at = w.a.pieceId === at ? w.b.pieceId : w.a.pieceId;
    prevEdge = next;
  }
  // A real cycle returns to where it started, and covers every edge once.
  if (at !== start || forward.size !== edges.length) return null;
  return { pieces, forward };
}

/**
 * How many subsets the enumeration will look at before it gives up.
 *
 * The CONNECTED-subset walk below collapses today's catalogue to `rank`
 * iterations, but a graph whose fundamentals all share pieces can still have
 * exponentially many connected subsets, and a three-port switch is what makes
 * that reachable. This is the bound that turns "slow" into "refused": a
 * budget on WORK, where `CYCLE_RANK_CEILING` is a bound on INPUT. Exceeding
 * it reports `truncated` for the same reason the rank ceiling does -- naming
 * one basis cycle "the worst" would be a claim nobody checked.
 *
 * 20,000 at the measured ~12us per subset is about a quarter of a second in
 * the worst case the old code took 12 seconds on.
 */
export const CYCLE_SUBSET_BUDGET = 20_000;

/**
 * Every CONNECTED subset of the fundamental-sharing graph, each exactly once.
 *
 * WHY CONNECTED IS LOSSLESS, which is the whole basis of this optimisation.
 * `traceSimpleCycle` accepts an edge set only when a single walk covers all
 * of it (`forward.size !== edges.length` rejects otherwise). Take a subset
 * whose fundamentals split into two groups sharing no piece: their edge sets
 * are vertex-disjoint, each group contributes at least one edge -- no
 * fundamental can cancel entirely, since each owns a closing weld no other
 * contains -- so the symmetric difference is two or more disjoint circuits
 * and the walk covers only one. Every subset the old loop could ACCEPT is
 * therefore connected here. Nothing is lost; the full cycle space is still
 * covered, so T6's no-pooling guarantee is unchanged.
 *
 * Each subset is emitted once, identified by its lowest member: the outer
 * loop fixes that minimum and the walk may only add higher vertices, and
 * within a walk a candidate that has already been branched on is banned from
 * later branches of the same frame.
 *
 * Returns false when the budget ran out, which the caller reports as
 * `truncated` rather than presenting a partial enumeration as the whole.
 */
export function forEachConnectedSubset(
  neighbours: readonly number[],
  rank: number,
  budget: number,
  visit: (mask: number) => void,
): boolean {
  let spent = 0;
  let exhausted = false;

  const grow = (sub: number, ext: number, banned: number, allowed: number): void => {
    if (++spent > budget) {
      exhausted = true;
      return;
    }
    visit(sub);
    let cand = ext & allowed & ~sub & ~banned;
    let seen = banned;
    while (cand !== 0) {
      const bit = cand & -cand;
      cand &= ~bit;
      const i = 31 - Math.clz32(bit);
      // `seen` goes in as the child's `banned`, which is what stops a subset
      // being reached twice; masking `ext` with it here as well would be
      // redundant, since the child filters its own candidates by `banned`.
      grow(sub | bit, (ext | neighbours[i]!) & ~bit, seen, allowed);
      if (exhausted) return;
      seen |= bit;
    }
  };

  for (let v = 0; v < rank; v++) {
    // Bits v and above, so each connected subset is reached once, from its
    // own lowest member.
    const allowed = (~((1 << v) - 1) & ((1 << rank) - 1)) >>> 0;
    grow(1 << v, neighbours[v]! & allowed, 0, allowed);
    if (exhausted) return false;
  }
  return true;
}

export function analyseCycles(
  graph: Graph,
  placement: Placement,
  residuals: readonly WeldResidual[],
  ports: PortsOf,
  slop: SlopOf,
): CycleSpace {
  const forest = placement.forest;
  const rank = forest.closing.length;

  // Checked BEFORE enumerating, so an adversarial graph is refused rather
  // than paid for.
  if (rank > CYCLE_RANK_CEILING) {
    return { rank, truncated: true, rotationBroken: false, cycles: [], worst: null };
  }
  if (rank === 0) {
    return { rank: 0, truncated: false, rotationBroken: false, cycles: [], worst: null };
  }

  const rotationBroken = residuals.some((r) => r.headingSteps !== 0);
  const residualByWeld = new Map(residuals.map((r) => [r.weld, r]));
  const fundamentals = forest.closing.map((w) => fundamentalCycle(graph, forest, w));

  const giveOfWeld = (index: number): number => {
    const w = graph.welds[index]!;
    // Guarded for the same reason as `placeAll`: a bad index should name the
    // piece and the port, not fail as a property read on undefined.
    const pa = ports(w.a.pieceId)[w.a.port];
    const pb = ports(w.b.pieceId)[w.b.port];
    if (!pa) throw new Error(`piece ${w.a.pieceId} has no port ${w.a.port}`);
    if (!pb) throw new Error(`piece ${w.b.pieceId} has no port ${w.b.port}`);
    return weldGiveMm(pa, pb, slop(w.a.pieceId), slop(w.b.pieceId));
  };

  /*
   * THE SHARING GRAPH: fundamental i is adjacent to j when they pass through
   * a common PIECE. Vertex-sharing, not edge-sharing, because connectivity of
   * the combined subgraph is what decides whether a symmetric difference can
   * be one circuit, and two cycles sharing an edge share its ends anyway.
   *
   * On today's catalogue this graph has no edges at all. Every part has two
   * ports and both `weldEnds` and `addPiece` weld only FREE ports, so no
   * piece can carry a third weld and every fundamental is vertex-disjoint
   * from every other. The walk below then yields exactly `rank` subsets
   * instead of 2^rank - 1. At the rank-20 ceiling that is 20 iterations in
   * place of 1,048,575, which is the 12-second freeze this replaces.
   */
  const piecesOf = fundamentals.map((edges) => {
    const ids = new Set<string>();
    for (const e of edges) {
      const w = graph.welds[e]!;
      ids.add(w.a.pieceId);
      ids.add(w.b.pieceId);
    }
    return ids;
  });
  const neighbours = piecesOf.map((mine, i) => {
    let mask = 0;
    for (let j = 0; j < rank; j++) {
      if (j === i) continue;
      for (const id of piecesOf[j]!) {
        if (mine.has(id)) {
          mask |= 1 << j;
          break;
        }
      }
    }
    return mask;
  });

  const cycles: CycleReport[] = [];
  const complete = forEachConnectedSubset(neighbours, rank, CYCLE_SUBSET_BUDGET, (mask) => {
    const counts = new Map<number, number>();
    for (let i = 0; i < rank; i++) {
      if ((mask & (1 << i)) === 0) continue;
      for (const e of fundamentals[i]!) counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const edges = [...counts.entries()].filter(([, n]) => n % 2 === 1).map(([e]) => e);
    const traced = traceSimpleCycle(graph, edges);
    if (!traced) return;

    let gap: Cyc = ZERO;
    if (!rotationBroken) {
      for (const e of edges) {
        const r = residualByWeld.get(e);
        if (!r) continue; // tree edges are satisfied exactly by construction
        gap = add(gap, traced.forward.get(e) ? r.gap : scale(r.gap, -1));
      }
    }
    const giveMm = edges.reduce((sum, e) => sum + giveOfWeld(e), 0);
    const gapMm = rotationBroken ? Number.NaN : magnitude(gap);
    cycles.push({
      welds: edges,
      pieces: traced.pieces,
      gap,
      gapMm,
      giveMm,
      withinGive: !rotationBroken && gapMm <= giveMm,
    });
  });

  // Worst = furthest over its OWN give. Ties go to the larger gap, so the
  // reported cycle is stable rather than whichever the enumeration hit first.
  const worst =
    cycles.length === 0
      ? null
      : cycles.reduce((a, b) => {
          const da = a.gapMm - a.giveMm;
          const db = b.gapMm - b.giveMm;
          if (Number.isNaN(da)) return b;
          if (Number.isNaN(db)) return a;
          if (db !== da) return db > da ? b : a;
          return b.gapMm > a.gapMm ? b : a;
        });

  return { rank, truncated: !complete, rotationBroken, cycles, worst };
}
