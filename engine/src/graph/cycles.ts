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
 * How many fundamentals a subset mask can carry.
 *
 * Subsets live in an int32, so the usable bit positions are 0..30 and a basis
 * of 31 is the largest that fits -- `1 << 31` is the sign bit and `1 << 32`
 * wraps to 1. The COUNT is 31; the last index is 30. Named once because it
 * was a bare literal in two guards and two message strings, and raising it
 * means changing all four together.
 */
export const SUBSET_MASK_BITS = 31;

/**
 * Above this rank the cycle space is not enumerated.
 *
 * It bounds the INPUT; `CYCLE_WORK_BUDGET` bounds the WORK.
 *
 * 31, RAISED FROM 20, and the number is now the representation rather than a
 * leftover. 20 was justified with "2^rank subsets, so 20 is about a million",
 * the cost model of an enumeration that walked every subset; the walk now
 * visits only connected subsets and is charged per weld, so that sentence
 * stopped describing anything and 20 kept standing on it.
 *
 * What 20 cost, MEASURED: 21 separate 8-curve circles -- 168 pieces, every
 * loop closing EXACTLY, reachable by 21 weld clicks with no stored layout
 * involved -- were refused with "21 independent loops is more than this can
 * rank" in 1.1ms, while 20 of the same circles answered `closesExactly` in
 * 4.8ms. Those 21 circles spend 168 of `CYCLE_WORK_BUDGET`'s 150,000 slots.
 * Refusing a correct, ordinary layout the solver can check in a millisecond
 * is the mirror of never styling a pass as a failure.
 *
 * 31 is the hard limit, not a preference: both the sharing graph and the walk
 * carry subsets in an int32 mask, whose usable positions are 0..30, so a
 * basis of 31 is the largest that fits. The work budget is what bounds cost
 * now, and it is measured; this bounds only what can be represented.
 *
 * The point of the ceiling is that
 * exceeding it REPORTS "too many loops to rank" rather than quietly falling
 * back to the fundamental basis: a basis cycle is an arbitrary choice of
 * which loops to look at, and presenting one as "the worst" would be a claim
 * nobody checked. It is a bound on the INPUT, tested before any enumeration
 * begins, so a hostile graph cannot spend the time before being refused.
 */
export const CYCLE_RANK_CEILING = SUBSET_MASK_BITS;

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
  /**
   * Why the cycle space was NOT fully enumerated, or `false` when it was.
   *
   * `'rank'` means rank exceeded `CYCLE_RANK_CEILING`, refused before any
   * work. `'work'` means the walk spent `CYCLE_WORK_BUDGET`. Both return
   * `cycles: []` and `worst: null`: a partial enumeration must not be read as
   * the whole, so there is deliberately nothing here to mistake for an
   * answer. Anything other than `false` means this report answers nothing.
   */
  readonly truncated: false | 'rank' | 'work';
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
  // `down.includes` inside a filter was O(|up| x |down|), so building the
  // basis was quadratic in tree depth. MEASURED at rank 20 on a branching
  // forest, before and after: 2000 pieces 11.7ms -> 3.2ms, 4000 45.3 -> 5.8,
  // 8000 162.8 -> 16.2. It only bites when both ends of a closing weld sit
  // deep in the tree, which needs a branching forest, which is the same
  // dense shape the work budget above exists for.
  const inDown = new Set(down);
  const shared = new Set(up.filter((w) => inDown.has(w)));
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
 * THE SHARING GRAPH: fundamental i is adjacent to j when they pass through a
 * common PIECE. Vertex-sharing, not edge-sharing, because connectivity of the
 * combined subgraph is what decides whether a symmetric difference can be one
 * circuit, and two cycles sharing an edge share its ends anyway.
 *
 * @internal Exported as a test seam for `engine/test/cycles.test.ts`, not as
 * engine API. The only non-test caller is `analyseCycles` in this file.
 *
 * Separated from `analyseCycles` so it can be tested on its own, because on
 * today's catalogue it CANNOT be tested through `analyseCycles`: every part
 * has two ports and both `weldEnds` and `addPiece` weld only FREE ports, so
 * no piece can carry a third weld and no two fundamentals can share one.
 * Every mask this returns is 0 today, and the whole 12-second freeze went
 * away because of it: the walk yields `rank` subsets instead of 2^rank - 1,
 * 20 instead of 1,048,575 at the ceiling.
 *
 * The dangerous direction is a MISSING edge. Two fundamentals that really do
 * share a piece, reported as disjoint, make their combined subset
 * unreachable, and that subset can be a real loop the user built. A loop
 * never examined is a loop that never fails, which is a false pass. The
 * extra edge is the harmless direction: it only costs a subset that
 * `traceSimpleCycle` then rejects.
 */
export function sharingGraph(
  graph: Graph,
  fundamentals: readonly (readonly number[])[],
): number[] {
  // Same trap as `forEachConnectedSubset`, same reason to be loud about it:
  // `1 << j` wraps past 31, so a 32nd fundamental would quietly take vertex
  // 0's bit and the adjacency would be wrong rather than absent. Unreachable
  // because `CYCLE_RANK_CEILING` IS `SUBSET_MASK_BITS`: the ceiling refuses
  // rank 32 before this is reached, so these two can no longer drift apart.
  if (fundamentals.length > SUBSET_MASK_BITS) {
    throw new Error(
      `${fundamentals.length} fundamentals exceeds the ${SUBSET_MASK_BITS}-bit mask`,
    );
  }

  const piecesOf = fundamentals.map((edges) => {
    const ids = new Set<string>();
    for (const e of edges) {
      const w = graph.welds[e]!;
      ids.add(w.a.pieceId);
      ids.add(w.b.pieceId);
    }
    return ids;
  });
  /*
   * INVERTED, not compared pairwise.
   *
   * This used to intersect every fundamental's piece set against every
   * other's, which is O(rank x total pieces) and ALWAYS hit its worst case in
   * production: the inner `break` fires only when two fundamentals really do
   * share a piece, and on today's catalogue none ever do, so every call ran
   * the full rank x (rank-1) scan to return all zeros. Measured 1.94ms of a
   * 13.2ms answer at 10,000 pieces, and 52.56ms at 150,000.
   *
   * One pass records which fundamentals own each piece; a second ORs the
   * owners of the pieces each fundamental touches. Same condition -- j is a
   * neighbour of i exactly when some piece of i is also owned by j -- in
   * O(total pieces).
   *
   * MEASURED, old against new, rank 20, mean of 20 runs:
   *
   *    10,000 pieces   1.55ms  ->  0.68ms
   *    40,000 pieces   6.36ms  ->  2.41ms
   *   150,000 pieces  32.72ms  -> 15.79ms
   *
   * and byte-identical masks over 1,202 random fundamental sets.
   */
  const owners = new Map<string, number>();
  piecesOf.forEach((ids, i) => {
    for (const id of ids) owners.set(id, (owners.get(id) ?? 0) | (1 << i));
  });
  return piecesOf.map((ids, i) => {
    let mask = 0;
    for (const id of ids) mask |= owners.get(id)!;
    // Own bit cleared here rather than skipped in a loop: a fundamental owns
    // every piece it touches, so it is always its own neighbour otherwise.
    return (mask & ~(1 << i)) >>> 0;
  });
}

/**
 * How much WORK the enumeration will do before it gives up, in weld-slots.
 *
 * THIS COUNTED SUBSETS AND THAT WAS THE WRONG AXIS. A subset's cost is the
 * total length of the fundamentals it selects, and a fundamental is as long
 * as the tree path between its closing weld's ends, so cost scales with PIECE
 * count while `CYCLE_RANK_CEILING` bounds only RANK. Both failure modes were
 * measured on a dense sharing graph of two-port parts, reachable from stored
 * data with no switch part in the catalogue:
 *
 *   rank 14,  8402 pieces   16,383 subsets, UNDER the old 20,000 cap, so
 *                           nothing truncated: 6905ms and a normal verdict
 *   rank 20,  6302 pieces   capped at 20,000 subsets, but it had already
 *                           spent 8875ms getting there, then refused
 *
 * The first is the worse of the two: a seven-second frozen tab and no
 * refusal at all, which is the same P0 this walk was written to close.
 *
 * AND THE WALK ALONE DID NOT CLOSE IT. Two other things on the same path had
 * to change before a large layout stopped freezing the tab: the all-pairs
 * overlap scan in `feasible.ts`, which ran BEFORE every bound here and cost
 * 8337ms at 10,000 pieces, and `App.tsx`'s scanning `slop` callback. Any
 * claim in this file that the enumeration fix closed the freeze means the
 * enumeration's share of it.
 *
 * WHAT THIS BOUNDS, AND WHAT IT DOES NOT. Stated precisely because the first
 * version of this comment claimed "the bound no longer depends on layout
 * size", which is true of the WALK and false of `analyseCycles`.
 *
 * It bounds the walk. The budget is charged per subset BEFORE that subset's
 * work is done, so a subset costing more than the whole budget is refused
 * unvisited and total work inside the walk is at most `budget` -- the same
 * property `CYCLE_RANK_CEILING` claims for the input.
 *
 * It does NOT bound what happens before the walk. `fundamentals` and
 * `sharingGraph` both run first and both are linear in pieces, so a REFUSAL
 * still costs something. Measured on DISJOINT loops at rank 20, where a
 * subset's cost equals its weld count so the budget is spent exactly -- NOT
 * on a dense graph, which an earlier version of this table claimed and which
 * cannot produce these rows at all, since a dense bundle refuses at 602
 * pieces:
 *
 *    10,000 pieces, answered       15ms
 *   150,000 pieces, answered      169-189ms  (the whole budget, one walk)
 *   200,000 pieces, refused       180-286ms
 *   400,000 pieces, refused       285-493ms
 *
 * The refusal rows are ranges because two machines disagreed by about 1.6x;
 * the shape is what matters, and a refusal at 200,000 cannot be cheaper than
 * an answer at 150,000, which the single-number version implied.
 *
 * So 150,000 weld-slots buys about 170ms on the answered path, not one frame.
 * A slot costs ~7x more when the subset is ACCEPTED (it then pays
 * `giveOfWeld` per edge) than when `traceSimpleCycle` rejects it, and the
 * dense specs measure the cheap side, so no spec measures within 15x of what
 * this constant permits. Filed rather than retuned: picking the number from a
 * frame target needs `giveOfWeld` precomputed per weld first, which is its
 * own change.
 *
 * It also assumes a slot is O(1), which is a contract on the CALLER. The
 * `slop` and `ports` callbacks are invoked per edge, and a scanning
 * implementation makes the whole thing quadratic in pieces from outside --
 * `App.tsx` did exactly that, measured at 2196ms for 32,000 pieces with the
 * budget never firing. The engine cannot defend itself there: caching inside
 * does not help, because the first lookup per piece still scans and there
 * are O(pieces) distinct pieces. Both callers now pass Map lookups.
 */
export const CYCLE_WORK_BUDGET = 150_000;

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
 *
 * @internal Exported as a test seam for the brute-force differential in
 * `engine/test/cycles.test.ts`, not as engine API. The only non-test caller
 * is `analyseCycles` in this file.
 */
export function forEachConnectedSubset(
  neighbours: readonly number[],
  rank: number,
  budget: number,
  /** Work this subset will cost, in whatever unit `budget` is counted in. */
  costOf: (mask: number) => number,
  visit: (mask: number) => void,
): boolean {
  // Guarded for the same reason `giveOfWeld` is: this is exported, the only
  // caller today passes a mask array it just built, and both ways of getting
  // it wrong fail SILENTLY rather than loudly -- and silently SMALLER, which
  // on this path is a missed cycle, which is a layout that cannot be built
  // reported as fine.
  //
  // MEASURED with the guard removed, complete graph, `visit` counted:
  //   rank 4, neighbours length 4   15 subsets, reports complete  (correct)
  //   rank 4, neighbours length 2   14 subsets, reports complete
  //   rank 32                       32 subsets, reports complete
  //
  // A short `neighbours` yields `undefined`, which `&` coerces to 0, so a
  // missing vertex reads as isolated. At rank 32 the shift count wraps
  // (`1 << 32 === 1`), so `allowed` collapses to 0 and only singletons come
  // out. Neither case sets `exhausted`, so both claim a complete walk.
  if (rank < 0 || rank > SUBSET_MASK_BITS) {
    throw new Error(`rank ${rank} outside 0..${SUBSET_MASK_BITS}`);
  }
  if (neighbours.length !== rank) {
    throw new Error(`neighbours has ${neighbours.length} entries for rank ${rank}`);
  }

  let spent = 0;
  let exhausted = false;

  const grow = (sub: number, ext: number, banned: number, allowed: number): void => {
    // Charged BEFORE the work, so the refusal does not first pay for what it
    // is refusing. `costOf` is O(rank); the work it prices is O(welds).
    spent += costOf(sub);
    if (spent > budget) {
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
    return { rank, truncated: 'rank', rotationBroken: false, cycles: [], worst: null };
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

  const neighbours = sharingGraph(graph, fundamentals);

  /*
   * What a subset COSTS, which is what the budget is charged in. The visit
   * below walks every weld of every selected fundamental, so the price is
   * their total length. O(rank) to compute, pricing O(welds) of work.
   */
  const lengths = fundamentals.map((edges) => edges.length);
  const costOf = (mask: number): number => {
    let n = 0;
    for (let i = 0; i < rank; i++) if ((mask & (1 << i)) !== 0) n += lengths[i]!;
    return n;
  };

  const cycles: CycleReport[] = [];
  const complete = forEachConnectedSubset(neighbours, rank, CYCLE_WORK_BUDGET, costOf, (mask) => {
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

  /*
   * A TRUNCATED WALK REPORTS NOTHING, the same as the rank ceiling above.
   *
   * It used to return the partial `cycles` and a `worst` reduced over them,
   * which is exactly the "presenting one as the worst would be a claim nobody
   * checked" that `CYCLE_RANK_CEILING`'s own docblock says the refusal exists
   * to avoid. `solve.ts` bails on `truncated` before reading either, so
   * nothing was wrong in the product; the struct was handing the next reader
   * a plausible answer built from a walk that did not finish.
   */
  if (!complete) {
    return { rank, truncated: 'work', rotationBroken, cycles: [], worst: null };
  }

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

  return { rank, truncated: false, rotationBroken, cycles, worst };
}
