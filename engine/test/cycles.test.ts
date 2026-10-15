/**
 * The cycle space (T5 and T6).
 *
 * The property that matters most here is NEGATIVE: give is never pooled. A
 * layout with a slack loop and a tight loop must not let the slack one pay
 * for the tight one, because the joints are not shared.
 *
 * EVERY `MUTATION PROOF` BELOW QUOTES A MESSAGE AND A COUNT THAT WERE RUN.
 *
 * That is a correction, not a boast. Across three review rounds, THIRTEEN
 * records in this file were written without being run and every one was
 * wrong: reversed messages, predicted arrays, a claim that one mutation
 * would HANG when it fails in milliseconds, its mirror where a mutation
 * really does hang the file, failure counts off in both directions, and
 * repeated SUITE TOTALS that matched no commit.
 *
 * The totals are why this rule is written in terms of RELATIVE counts. An
 * absolute total goes stale the moment a spec is added, so every record
 * below says "five specs fail" or "exactly one spec fails" and none says how
 * many remain. Three separate attempts to correct the totals produced three
 * more wrong totals; the shape of the claim was the defect, not the
 * arithmetic.
 *
 * None of them weakened a test. All were records a reader is told to trust
 * instead of re-running, which is the same defect class as a test that
 * cannot fail. If a message here does not reproduce, the comment is what is
 * broken: fix it, do not weaken the spec.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import {
  CYCLE_RANK_CEILING,
  CYCLE_WORK_BUDGET,
  SUBSET_MASK_BITS,
  analyseCycles,
  forEachConnectedSubset,
  sharingGraph,
} from '../src/graph/cycles.js';
import { placeAll, residuals } from '../src/graph/frames.js';
import { solveGraph } from '../src/graph/solve.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import type { Layout } from '../src/parts/schema.js';

const base = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(base(piece.partId), piece.turn);

function analyse(g: Graph, slopMm = 0.8) {
  const byId = new Map(g.pieces.map((p) => [p.pieceId, p]));
  const portsById = (id: string) => ports(byId.get(id)!);
  const place = placeAll(g, ports);
  return analyseCycles(g, place, residuals(g, ports, place), portsById, () => slopMm);
}

/**
 * `analyseCycles` alone, timed. `placeAll` and `residuals` are hoisted OUT of
 * the measurement on purpose: they are linear in pieces and cheap (6ms at
 * 8402), they are not what the budget bounds, and the unbounded-layout cost
 * is its own filed P1. Timing them together made the bound a measurement of
 * two unrelated things and flaked 2 runs in 8.
 */
function timeAnalyse(g: Graph, slopMm = 0.8) {
  const byId = new Map(g.pieces.map((p) => [p.pieceId, p]));
  const portsById = (id: string) => ports(byId.get(id)!);
  const place = placeAll(g, ports);
  const rs = residuals(g, ports, place);
  const t0 = performance.now();
  const space = analyseCycles(g, place, rs, portsById, () => slopMm);
  return { space, ms: performance.now() - t0 };
}

/** `n` DISJOINT closed loops of `k` pieces: rank n, sharing graph all zeros. */
const loops = (n: number, k = 8): Graph => {
  const pieces: Piece[] = [];
  const welds: Weld[] = [];
  for (let c = 0; c < n; c++) {
    for (let i = 0; i < k; i++) pieces.push({ pieceId: `c${c}p${i}`, partId: 'E', turn: 'left' });
    for (let i = 0; i < k; i++)
      welds.push({ a: { pieceId: `c${c}p${i}`, port: 1 }, b: { pieceId: `c${c}p${(i + 1) % k}`, port: 0 } });
  }
  return { pieces, welds, anchors: new Map() };
};

const chain = (ids: string[], closed: boolean): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed,
});

describe('rank', () => {
  it('is zero for an open chain, one for a closed one', () => {
    expect(analyse(graphFromChain(chain(Array(8).fill('E'), false))).rank).toBe(0);
    expect(analyse(graphFromChain(chain(Array(8).fill('E'), true))).rank).toBe(1);
  });

  it('equals E - V + CC', () => {
    const g = graphFromChain(chain(Array(8).fill('E'), true));
    const place = placeAll(g, ports);
    const cc = place.forest.roots.length;
    expect(analyse(g).rank).toBe(g.welds.length - g.pieces.length + cc);
  });

  it('the exact circle closes and needs no give', () => {
    const a = analyse(graphFromChain(chain(Array(8).fill('E'), true)));
    expect(a.worst!.gapMm).toBe(0);
    expect(a.worst!.withinGive).toBe(true);
  });
});

/*
 * TWO LOOPS SHARING ONE PIECE, which is the shape the whole no-pooling rule
 * exists for. Built as two circles joined through a shared straight so they
 * are genuinely separate loops with their own joints.
 */
function twoLoops(secondLoopParts: string[]): Graph {
  const pieces: Piece[] = [
    ...Array.from({ length: 8 }, (_, i) => ({ pieceId: `a${i}`, partId: 'E', turn: 'left' as const })),
    ...secondLoopParts.map((partId, i) => ({ pieceId: `b${i}`, partId, turn: 'left' as const })),
  ];
  const welds = [];
  for (let i = 0; i < 7; i++) {
    welds.push({ a: { pieceId: `a${i}`, port: 1 }, b: { pieceId: `a${i + 1}`, port: 0 } });
  }
  welds.push({ a: { pieceId: 'a7', port: 1 }, b: { pieceId: 'a0', port: 0 } });
  for (let i = 0; i + 1 < secondLoopParts.length; i++) {
    welds.push({ a: { pieceId: `b${i}`, port: 1 }, b: { pieceId: `b${i + 1}`, port: 0 } });
  }
  welds.push({
    a: { pieceId: `b${secondLoopParts.length - 1}`, port: 1 },
    b: { pieceId: 'b0', port: 0 },
  });
  return { pieces, welds };
}

describe('T6: give is never pooled across cycles', () => {
  it('two disjoint loops are rank 2 and reported separately', () => {
    const g = twoLoops(Array(8).fill('E'));
    const a = analyse(g);
    expect(a.rank).toBe(2);
    // Both close exactly, so both are within give independently.
    expect(a.cycles.filter((c) => c.gapMm === 0).length).toBeGreaterThanOrEqual(2);
  });

  /*
   * THE TEST THAT EARNS THE RULE.
   *
   * One loop closes exactly and so has its whole give unspent. The other is
   * 72mm short against about 7mm of give. Pooled, the spare give from eight
   * untouched joints would be offered to the broken loop; it still would not
   * cover 72mm, so the pooling has to be caught by the SHAPE of the answer,
   * not by the number. Each cycle carries its own give and its own gap, and
   * no reported cycle has the broken gap paired with the intact loop's give.
   */
  it('a slack loop never pays for a tight one', () => {
    const g = twoLoops([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'A']);
    const a = analyse(g);
    expect(a.rank).toBe(2);

    const exact = a.cycles.filter((c) => c.gapMm === 0);
    const broken = a.cycles.filter((c) => c.gapMm > 0);
    expect(exact.length).toBeGreaterThan(0);
    expect(broken.length).toBeGreaterThan(0);

    /*
     * Each cycle's give is EXACTLY its own welds, stated as an equation
     * rather than an inequality.
     *
     * The first version asserted `giveMm < totalWelds * 0.8`, and when I
     * mutated the code to pool give it failed only by floating-point noise:
     * 14.400000000000004 against 14.4. An assertion that a defect clears by
     * 4e-15 is not an assertion. This one is off by more than 6mm.
     */
    for (const c of broken) {
      expect(c.giveMm).toBeCloseTo(c.welds.length * 0.8, 9);
      expect(c.giveMm).toBeLessThan(g.welds.length * 0.8 - 1);
      expect(c.withinGive).toBe(false);
    }
    for (const c of exact) {
      expect(c.giveMm).toBeCloseTo(c.welds.length * 0.8, 9);
    }
    // The worst cycle is a broken one, not an average of the two.
    expect(a.worst!.gapMm).toBeGreaterThan(0);
    expect(a.worst!.withinGive).toBe(false);
  });

  /*
   * T5's verify, stated as the plan states it: adding an unrelated piece must
   * not change the reported gap for an untouched loop.
   */
  it('an unrelated piece does not move an untouched loop', () => {
    const before = analyse(graphFromChain(chain(Array(8).fill('E'), true)));
    const g = graphFromChain(chain(Array(8).fill('E'), true));
    const withExtra: Graph = {
      pieces: [...g.pieces, { pieceId: 'loose', partId: 'D' }],
      welds: g.welds,
    };
    const after = analyse(withExtra);
    expect(after.rank).toBe(before.rank);
    expect(after.worst!.gapMm).toBe(before.worst!.gapMm);
    expect(after.worst!.giveMm).toBe(before.worst!.giveMm);
  });
});

describe('T5: the rank ceiling', () => {
  it('is a bound on input, checked before enumeration', () => {
    // A graph whose rank exceeds the ceiling: one piece, many self-welds.
    const pieces: Piece[] = [{ pieceId: 'p', partId: 'E', turn: 'left' }];
    const welds = Array.from({ length: CYCLE_RANK_CEILING + 5 }, () => ({
      a: { pieceId: 'p', port: 1 },
      b: { pieceId: 'p', port: 0 },
    }));
    const started = performance.now();
    const a = analyse({ pieces, welds });
    // The CAUSE, not just the fact. There are two now, and this is the one
    // that refuses before any work; 'work' is pinned separately below.
    expect(a.truncated).toBe('rank');
    expect(a.cycles).toEqual([]);
    expect(a.worst).toBeNull();
    expect(a.rank).toBeGreaterThan(CYCLE_RANK_CEILING);
    // Refused, not paid for: enumerating 2^25 subsets would not be instant.
    expect(performance.now() - started).toBeLessThan(250);
  });

  it('does not fall back to a basis cycle', () => {
    const pieces: Piece[] = [{ pieceId: 'p', partId: 'E', turn: 'left' }];
    const welds = Array.from({ length: CYCLE_RANK_CEILING + 1 }, () => ({
      a: { pieceId: 'p', port: 1 },
      b: { pieceId: 'p', port: 0 },
    }));
    // The dangerous failure is reporting SOME cycle as "the worst" when the
    // space was never searched. There must be nothing to mistake for an answer.
    expect(analyse({ pieces, welds }).worst).toBeNull();
  });
});

describe('rotation', () => {
  it('a loop that comes back turned is reported, not ranked', () => {
    // Seven E curves closed: 7 x 45 = 315 degrees, so the heading is wrong.
    const a = analyse(graphFromChain(chain(Array(7).fill('E'), true)));
    expect(a.rotationBroken).toBe(true);
    expect(a.worst!.withinGive).toBe(false);
  });
});

/**
 * THE ENUMERATION COST. This was a SKIPPED spec pinning a P0; the P0 is fixed
 * and it runs.
 *
 * Value: protects=analyseCycles stays inside a frame budget at the accepted
 * rank ceiling, so the ENUMERATION cannot freeze the tab
 * Value: fails_when=the enumeration goes back to walking all 2^rank subsets
 * rather than only the connected ones
 * Value: why_new=nothing in the suite timed anything, so the 26x gap between
 * the recorded figures and the measured ones was undetectable
 * Value: seam=none
 * Value: no_claim=nothing about the browser's own scheduling; these are bun
 * numbers and Chrome is within about 2x
 *
 * MEASURED, old implementation against new, same graphs, same results:
 *
 *   rank 12 /  96 pieces      41ms  ->  0.75ms
 *   rank 16 / 128 pieces     521ms  ->  0.33ms
 *   rank 18 / 144 pieces    2348ms  ->  0.37ms
 *   rank 20 / 160 pieces   12289ms  ->  1.65ms
 *
 * The cycle count is identical at every rank, which is the point: the subsets
 * that were dropped could never have been accepted. `traceSimpleCycle` takes
 * an edge set only when one walk covers all of it, and a subset of
 * fundamentals sharing no piece is two or more disjoint circuits. See
 * `forEachConnectedSubset` for the argument in full.
 *
 * The second case is the one that would catch a regression to exponential
 * growth even if the constant improved: it compares rank 20 against rank 10
 * rather than against a wall-clock number.
 */
describe('enumeration cost at the accepted ceiling', () => {
  it('solves a rank-20 layout of 160 pieces inside one frame budget', () => {
    const g = loops(20);
    const t0 = performance.now();
    analyse(g);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  /*
   * THIS SPEC FLAKED AND THE FLOOR IS WHY. The fix it guards made both
   * measurements sub-millisecond, so `Math.max(ms(10), 0.5)` collapses to
   * the 0.5 floor and the bound becomes a flat 10ms against a ~1ms reading.
   * Reproduced by a reviewer at `expected 17.636 to be less than 10.253` on
   * a loaded machine, 1 run in 6; 8 runs idle were clean, which is the
   * difference between a loaded machine and an idle one, not a difference in
   * the code. A pin that fails at random teaches people to re-run instead of
   * to look, and this branch makes ci.yml and README both advertise a green
   * nothing-skipped suite.
   *
   * The floor is now 5ms, so the bound is at least 100ms against the same
   * ~1ms reading. That is noise headroom, NOT a performance target: the
   * regression it exists to catch is exponential growth, which measured
   * 11,364ms against 100 when it was last run, so no tightness is lost.
   *
   * The deterministic half of this property lives elsewhere and is worth
   * knowing about: `forEachConnectedSubset` on an edgeless sharing graph
   * emits exactly `rank` subsets, and `sharingGraph` returns all-zero masks
   * for disjoint fundamentals. Those two need no clock at all.
   */
  it('does not grow exponentially in rank', () => {
    const ms = (n: number) => {
      const t0 = performance.now();
      analyse(loops(n));
      return performance.now() - t0;
    };
    const small = Math.max(ms(10), 5);
    expect(ms(20)).toBeLessThan(small * 20);
  });
});

/**
 * The connected-subset walk, pinned directly rather than only through its
 * effect on cycle counts.
 *
 * Value: protects=the enumeration visits exactly the connected subsets, each
 * once, and stops rather than hanging when a graph has too many
 * Value: fails_when=the walk emits a disconnected subset, emits a duplicate,
 * misses a connected one, or ignores the budget
 * Value: why_new=the old enumeration had no structure to pin; this one is
 * the whole fix, and a cycle-count assertion cannot tell "visited the right
 * subsets" from "visited too many and filtered them"
 * Value: seam=none
 * Value: no_claim=nothing about which subsets `traceSimpleCycle` then
 * accepts; that is its own contract and tested above
 */
describe('forEachConnectedSubset', () => {
  /** Every non-empty subset that is connected, found the slow obvious way. */
  const bruteForce = (nb: readonly number[], rank: number): number[] => {
    const out: number[] = [];
    for (let mask = 1; mask < 1 << rank; mask++) {
      const members = [];
      for (let i = 0; i < rank; i++) if (mask & (1 << i)) members.push(i);
      const seen = new Set([members[0]!]);
      const stack = [members[0]!];
      while (stack.length) {
        const v = stack.pop()!;
        for (const u of members) {
          if (!seen.has(u) && (nb[v]! & (1 << u)) !== 0) {
            seen.add(u);
            stack.push(u);
          }
        }
      }
      if (seen.size === members.length) out.push(mask);
    }
    return out;
  };

  const collect = (nb: readonly number[], rank: number, budget = 1 << 22) => {
    const got: number[] = [];
    const complete = forEachConnectedSubset(nb, rank, budget, () => 1, (m) => got.push(m));
    return { got, complete };
  };

  /*
   * MUTATION PROOF, run: pass `0` instead of `seen` as the child's `banned`
   * and this fails with `duplicate at rank 3 trial 2: expected 7 to be 8` --
   * 8 subsets emitted, 7 of them distinct. That argument is the whole
   * duplicate-avoidance mechanism.
   *
   */
  it('matches brute force exactly over 660 random graphs, with no duplicates', () => {
    let rng = 12345;
    const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let rank = 1; rank <= 11; rank++) {
      for (let trial = 0; trial < 60; trial++) {
        const density = rand();
        const nb = Array<number>(rank).fill(0);
        for (let i = 0; i < rank; i++) {
          for (let j = i + 1; j < rank; j++) {
            if (rand() < density) {
              nb[i]! |= 1 << j;
              nb[j]! |= 1 << i;
            }
          }
        }
        const { got, complete } = collect(nb, rank);
        expect(complete).toBe(true);
        expect(new Set(got).size, `duplicate at rank ${rank} trial ${trial}`).toBe(got.length);
        expect([...got].sort((a, b) => a - b), `mismatch at rank ${rank} trial ${trial}`).toEqual(
          bruteForce(nb, rank).sort((a, b) => a - b),
        );
      }
    }
  });

  /*
   * TODAY'S CATALOGUE IS THE NO-EDGE CASE, which is where the 12-second
   * freeze went. Every part has two ports, so no piece can take a third weld
   * and no two fundamentals share one.
   */
  it('a sharing graph with no edges yields exactly rank subsets', () => {
    for (const rank of [1, 5, 20]) {
      const { got } = collect(Array<number>(rank).fill(0), rank);
      expect(got).toHaveLength(rank);
      expect(new Set(got.map((m) => m.toString(2).split('1').length - 1))).toEqual(new Set([1]));
    }
  });

  /*
   * THE BUDGET IS A REAL STOP, not advice. A complete sharing graph at rank
   * 20 has 2^20 - 1 connected subsets, which is the case the budget exists
   * for.
   *
   * MUTATION PROOF, run WITH `-t 'stops at the budget'`: remove the budget's
   * early return and this fails on `expected true to be false` -- the walk
   * runs the complete rank-20 graph to completion and reports success.
   *
   * THE `-t` IS NOT OPTIONAL. Run the whole file under that mutation and it
   * does not terminate: the dense rank-20 specs below enumerate 2^20 subsets
   * at O(welds) each, synchronously, and vitest's 5000ms per-test timeout
   * cannot pre-empt a synchronous walk. An earlier version of this record
   * said the mutation "fails in 9ms", which is true only of the isolated
   * run it was taken from.
   *
   * The count is asserted EXACTLY, not as an upper bound: cost is 1 per
   * subset here and `spent` is compared before the visit, so 500 is
   * deterministic. `<= 500` would also pass a mutation that stops after the
   * FIRST subset, which is the opposite defect and just as wrong.
   */
  it('stops at the budget and says so, instead of running to completion', () => {
    const rank = 20;
    const complete = (1 << rank) - 1;
    const nb = Array.from({ length: rank }, (_, i) => complete & ~(1 << i));
    let visits = 0;
    // Cost 1 per subset, so this spec stays about the budget MECHANISM.
    // `analyseCycles` supplies the real price (a subset's total weld count),
    // and the dense-layout spec below is what pins that.
    const done = forEachConnectedSubset(nb, rank, 500, () => 1, () => {
      visits++;
    });
    expect(done).toBe(false);
    expect(visits).toBe(500);
  });

  it('reports completion when it finishes inside the budget', () => {
    const { complete, got } = collect([0b10, 0b01], 2, 1000);
    expect(complete).toBe(true);
    // {0}, {1}, {0,1}: all three are connected when the two share a piece.
    expect(got.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});

/**
 * The sharing graph, which decides which subsets the walk is allowed to reach.
 *
 * Value: protects=two fundamentals that share a piece are reported as
 * adjacent, so their combined subset stays reachable and the loop it
 * represents still gets checked
 * Value: fails_when=the piece-set intersection drops an edge, adds a
 * self-edge, or puts an edge on the wrong index
 * Value: why_new=this logic was UNREACHABLE from the rest of the suite. Made
 * to throw on finding a shared piece, all 405 specs passed at commit
 * `11dbfd5` (verified by checking it out and running it), because nothing
 * built a layout where two fundamentals share a piece.
 *
 * RE-RUN at HEAD, with the mutation named as an EDIT rather than as an
 * expression: change `return (mask & ~(1 << i)) >>> 0` to `return mask >>> 0`,
 * so a fundamental stays its own neighbour. FIVE specs fail -- all five in
 * this describe -- with `expected [ 1, 2 ] to deeply equal [ +0, +0 ]`,
 * `[ 3, 3 ]` vs `[ 2, 1 ]`, `[ 3, 7, 6 ]` vs `[ 2, 5, 2 ]`, `[ 7, 7, 7 ]`
 * vs `[ 6, 5, 3 ]` and `[ 1 ]` vs `[ +0 ]`. Going from zero failures to five
 * IS the hole closing.
 *
 * An earlier version of this record said NINE, and a reviewer re-measured it
 * as TEN; neither is reproducible, because what both quoted --
 * `(owners.get(id)! & ~(1 << i)) !== 0` -- is a fragment that names no
 * single edit. Two edits it could mean were run: clearing the own bit
 * per-id inside the loop leaves the whole suite green, and it must, since
 * `(a & m) | (b & m)` is `(a | b) & m`; gating the OR on that test is also
 * green. A mutation record has to be an edit someone can apply.
 *
 * The pre-review figure names its commit because that tree is frozen; the
 * current one names the edit and its messages because this tree is not.
 * Value: seam=`sharingGraph` takes welds and fundamentals as plain data, so
 * a shape the catalogue cannot build is still expressible here. The pieces
 * array is left empty on purpose: this function reads `graph.welds` and
 * nothing else.
 * Value: no_claim=nothing about whether the extra subsets then produce
 * cycles. `traceSimpleCycle` owns that and is tested above. This pins
 * REACHABILITY, which is the half that can silently lose a loop.
 *
 * WHY A MISSING EDGE IS THE DANGEROUS DIRECTION. An extra edge costs one
 * subset that `traceSimpleCycle` rejects. A missing edge makes a combined
 * subset unreachable, and that subset can be a loop the user actually built.
 * A loop never examined is a loop that never fails: a false pass, which is
 * the invariant this project says no task may weaken.
 */
describe('sharingGraph', () => {
  /** Welds as plain data, so a 3-weld piece is expressible. */
  const welds = (...pairs: readonly [string, string][]): Weld[] =>
    pairs.map(([a, b]) => ({ a: { pieceId: a, port: 1 }, b: { pieceId: b, port: 0 } }));
  const graph = (ws: Weld[]): Graph => ({ pieces: [], welds: ws, anchors: new Map() });

  /*
   * TODAY'S CATALOGUE. Every mask is 0, which is why the walk visits `rank`
   * subsets and not 2^rank - 1.
   *
   * MUTATION PROOF, run: delete the `& ~(1 << i)` that clears a
   * fundamental's own bit and all FIVE specs in this block fail, this one
   * with `expected [ 1, 2 ] to deeply equal [ +0, +0 ]`. A fundamental owns
   * every piece it touches, so without that clear each one claims itself as
   * a neighbour and nothing is ever disjoint.
   *
   * SECOND MUTATION PROOF, run: stop after the first piece (`break` inside
   * `for (const id of ids) mask |= owners.get(id)!`) and three specs fail,
   * the sharing case with `expected [ +0, 1 ] to deeply equal [ 2, 1 ]` --
   * a fundamental shares through ANY of its pieces, not just its first.
   */
  it('reports no edges when no two fundamentals share a piece', () => {
    const g = graph(welds(['a', 'b'], ['b', 'c'], ['d', 'e'], ['e', 'f']));
    expect(sharingGraph(g, [[0, 1], [2, 3]])).toEqual([0, 0]);
  });

  /*
   * THE BRANCH NOTHING ELSE REACHES: piece `c` is in both fundamentals, so
   * both directions of the edge must appear.
   *
   * MUTATION PROOF, run: in `sharingGraph`, OR the owner mask under the
   * fundamental's OWN bit instead of the neighbour's -- the inverted build's
   * equivalent of the old pairwise `mask |= 1 << j` becoming `1 << i` -- and
   * this
   * fails with `expected [ 1, 2 ] to deeply equal [ 2, 1 ]` -- each
   * fundamental then records ITSELF as the neighbour it found, so the edge
   * points at the wrong vertex and the walk still cannot cross it. The
   * no-edge spec above still PASSES under this mutation, which is why the
   * sharing case needs its own assertion rather than relying on that one.
   */
  it('reports both directions of an edge when two fundamentals share a piece', () => {
    const g = graph(welds(['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']));
    expect(sharingGraph(g, [[0, 1], [2, 3]])).toEqual([0b10, 0b01]);
  });

  /*
   * ADJACENCY IS PER PAIR, not all-or-nothing: 0 and 1 share `c`, 1 and 2
   * share `e`, and 0 and 2 share nothing. A mutation that collapses the inner
   * loop into "any sharing anywhere" would make all three mutually adjacent.
   */
  it('keeps unrelated fundamentals apart in a chain of three', () => {
    const g = graph(
      welds(['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'g']),
    );
    expect(sharingGraph(g, [[0, 1], [2, 3], [4, 5]])).toEqual([0b010, 0b101, 0b010]);
  });

  /*
   * A piece carrying three welds is the shape a switch introduces and the
   * reason this function exists. `b` is in all three fundamentals, so the
   * sharing graph is complete and every subset stays reachable.
   */
  it('reports a complete graph when one piece carries three welds', () => {
    const g = graph(welds(['a', 'b'], ['b', 'c'], ['b', 'd']));
    expect(sharingGraph(g, [[0], [1], [2]])).toEqual([0b110, 0b101, 0b011]);
  });

  it('is empty for an empty basis, and a lone fundamental has no neighbours', () => {
    expect(sharingGraph(graph(welds(['a', 'b'])), [])).toEqual([]);
    expect(sharingGraph(graph(welds(['a', 'b'], ['b', 'c'])), [[0, 1]])).toEqual([0]);
  });

  /*
   * THE CEILING IS COUPLED TO A 31-BIT MASK, and nothing else says so. Both
   * `sharingGraph` and `forEachConnectedSubset` carry subsets in an int32, so
   * raising `CYCLE_RANK_CEILING` past 31 would make `1 << j` wrap and hand
   * vertex 32 the bit belonging to vertex 0. This asserts the RELATIONSHIP,
   * not the value: the ceiling is free to move anywhere at or below 31.
   *
   * MUTATION PROOF, run: set `CYCLE_RANK_CEILING = 32` and exactly one spec
   * fails, this one, with `expected 32 to be less than or equal to 31`, and
   * every other spec stays green. That is the point of asserting the
   * relationship here:
   * nothing in the suite builds 32 fundamentals, so the two runtime guards
   * never fire and would not have caught the raised ceiling.
   */
  it('refuses a basis too large for the 31-bit mask it is carried in', () => {
    expect(CYCLE_RANK_CEILING).toBeLessThanOrEqual(SUBSET_MASK_BITS);
    const tooMany = Array.from({ length: 32 }, (_, i) => [i]);
    expect(() => sharingGraph(graph(welds(['a', 'b'])), tooMany)).toThrow(
      '32 fundamentals exceeds the 31-bit mask',
    );
    expect(() => forEachConnectedSubset(Array(32).fill(0), 32, 10, () => 1, () => {})).toThrow(
      'rank 32 outside 0..31',
    );
  });

  /*
   * THE ACCEPTED EDGE, which the refusal specs do not cover. Both guards are
   * pinned at 32, where they throw; 31 is the largest basis they are supposed
   * to LET THROUGH, and at rank 31 `(1 << rank) - 1` relies on `1 << 31`
   * being the sign bit and ToInt32 handing back 0x7FFFFFFF. If that reasoning
   * were wrong the walk would silently emit nothing, which is the
   * fail-smaller direction.
   *
   * MUTATION PROOF, run: change either guard to `>= SUBSET_MASK_BITS` and
   * this fails with `31 fundamentals exceeds the 31-bit mask` -- from
   * `sharingGraph`, because that is the first of the two assertions below.
   * The `forEachConnectedSubset` half reports `rank 31 outside 0..31` if you
   * change only its guard.
   */
  it('accepts the largest basis the 31-bit mask can carry', () => {
    const g = graph(welds(['a', 'b']));
    // One weld each; the shape does not matter here, only the count.
    const basis = Array.from({ length: SUBSET_MASK_BITS }, () => [0]);
    expect(sharingGraph(g, basis)).toHaveLength(SUBSET_MASK_BITS);

    const got: number[] = [];
    const complete = forEachConnectedSubset(
      Array<number>(SUBSET_MASK_BITS).fill(0),
      SUBSET_MASK_BITS,
      1 << 22,
      () => 1,
      (m) => got.push(m),
    );
    expect(complete).toBe(true);
    // An edgeless graph of 31 vertices: 31 singletons, the highest being
    // bit 30. A wrapped `allowed` mask would emit fewer, or none.
    expect(got).toHaveLength(SUBSET_MASK_BITS);
    expect(Math.max(...got)).toBe(1 << (SUBSET_MASK_BITS - 1));
  });

  /*
   * THE OTHER TWO GUARDS, which nothing reached: deleting either left the
   * whole suite green before this spec existed. What they protect against is
   * the silent-UNDERCOUNT direction the docblock measures -- `neighbours` of
   * length 2 at rank 4 emits 14 subsets instead of 15 and still reports a
   * complete walk. A missed subset is a missed loop.
   *
   * MUTATION PROOF, run: delete the `neighbours.length !== rank` check and
   * the first assertion fails with `expected [Function] to throw an error`.
   *
   * THE `rank < 0` ARM IS SHADOWED, and this spec only pins its MESSAGE.
   * Delete that half and the second assertion still fails, but with
   * `expected [Function] to throw error including 'rank -1 outside 0..31'
   * but got 'neighbours has 0 entries for rank -1'` -- the length guard
   * catches every negative rank first, because no array has a negative
   * length. Kept for the message, not for reachability.
   */
  it('refuses a neighbours array that does not match the rank, and a negative rank', () => {
    expect(() => forEachConnectedSubset([0, 0], 4, 10, () => 1, () => {})).toThrow(
      'neighbours has 2 entries for rank 4',
    );
    expect(() => forEachConnectedSubset([], -1, 10, () => 1, () => {})).toThrow(
      'rank -1 outside 0..31',
    );
  });
});

/**
 * THE DENSE SHARING GRAPH, which is where the freeze actually lived.
 *
 * Value: protects=a layout whose fundamentals all share pieces is answered or
 * refused inside a frame, at ANY piece count, and a legitimate large layout
 * is still answered in full
 * Value: fails_when=the budget goes back to counting subsets instead of work,
 * the truncation stops propagating out of analyseCycles, a truncated walk
 * reports cycles, or analyseCycles stops using the real sharing graph
 * Value: why_new=every timing spec above uses DISJOINT loops, whose sharing
 * graph is all zeros and whose walk visits exactly `rank` subsets. That is
 * the one topology where the walk is trivially cheap, so the cost was pinned
 * only where it could not fail. Measured on a dense graph at the same rank
 * ceiling, the first version of this fix took 6905ms at rank 14 and did not
 * truncate at all, because 2^14-1 = 16,383 subsets fell UNDER the old 20,000
 * subset cap: a seven-second frozen tab and then a normal verdict.
 * Value: seam=`bundle` builds the dense shape out of two-port catalogue parts
 * by welding the two hub pieces many times over. `loadGraph` used to accept
 * exactly this from storage, which is how it was reachable with no switch
 * part in the catalogue.
 * Value: no_claim=nothing about which cycles a dense layout SHOULD report
 * beyond reachability; the brute-force differential above owns that.
 *
 * MEASURED, before this fix and after, same graphs:
 *
 *   rank 14,  8402 pieces   6905ms, truncated=false  ->  22ms, truncated='work'
 *   rank 20,  6302 pieces   8875ms, truncated='work' ->  12ms, truncated='work'
 *   rank 20, 10000 pieces, DISJOINT (a legitimate layout)  ->  10ms, answered
 */
describe('a dense sharing graph is bounded by work, not by subset count', () => {
  /*
   * STEADY STATE IS 10-22ms; this bound is 250. The gap is deliberate.
   *
   * A 100ms bound flaked 2 runs in 8 on a loaded machine (measured 162ms and
   * 100.19ms), which is worse than no test: a pin that fails at random
   * teaches people to re-run rather than to look. The regression it has to
   * catch is not nearby -- charging the budget per subset again measures
   * 6834ms and 5000ms vitest timeouts, 27x past this bound -- so the
   * separation is kept in the headroom rather than in the tightness.
   */
  /*
   * 1,000ms, RAISED FROM 250 after measuring it under the run that actually
   * happens rather than file-isolated.
   *
   * Isolated this spec takes 15-22ms. Under the full parallel suite it was
   * measured at 21-57ms, and under ten CPU spinners on eight cores at 169ms
   * -- which is 1.5x of a 250ms bound, well inside flake range and below the
   * 6x this branch itself rejected as too thin when it sized the scan bound.
   * No mutation needs this clock: every one of them trips the `truncated`
   * assertions first, so the number buys regression cover against a future
   * change that stays correct and gets slow, and nothing else. At 1,000ms
   * that cover survives a loaded CI box.
   */
  const BOUND_MS = 1000;

  /**
   * `petals` parallel paths of `len` pieces between two hub pieces. Rank is
   * `petals - 1` and every fundamental runs through both hubs, so the sharing
   * graph is COMPLETE. Each hub carries `petals` welds on one port, which no
   * two-port part can physically do -- that is the point: it is the shape a
   * stored layout could claim.
   */
  const bundle = (petals: number, len: number): Graph => {
    const pieces: Piece[] = [
      { pieceId: 'L', partId: 'E', turn: 'left' },
      { pieceId: 'R', partId: 'E', turn: 'left' },
    ];
    const welds: Weld[] = [];
    for (let i = 0; i < petals; i++) {
      for (let j = 0; j < len; j++)
        pieces.push({ pieceId: `m${i}_${j}`, partId: 'E', turn: 'left' });
      welds.push({ a: { pieceId: 'L', port: 1 }, b: { pieceId: `m${i}_0`, port: 0 } });
      for (let j = 0; j + 1 < len; j++)
        welds.push({ a: { pieceId: `m${i}_${j}`, port: 1 }, b: { pieceId: `m${i}_${j + 1}`, port: 0 } });
      welds.push({ a: { pieceId: `m${i}_${len - 1}`, port: 1 }, b: { pieceId: 'R', port: 0 } });
    }
    return { pieces, welds, anchors: new Map() };
  };

  /*
   * MUTATION PROOF, run: charge the budget per subset again by replacing the
   * CALL's two arguments -- `CYCLE_WORK_BUDGET, costOf` becomes
   * `20_000, () => 1` -- and leaving the constant itself at 150_000. Stated
   * that precisely because an independent reviewer applied it by changing the
   * CONSTANT instead, which makes the shipped-budget spec fail instantly on
   * its own `expect(CYCLE_WORK_BUDGET).toBe(150_000)` rather than time out,
   * and reported this table as wrong. Both readings are mutations; only this
   * one produces the rows below. FOUR specs fail:
   *
   *   this one                            `602 pieces: expected false to be 'work'`
   *   reports no cycles and no worst      `Test timed out in 5000ms`
   *   spends the shipped budget           `Test timed out in 5000ms`
   *   refuses a big dense layout ...      `expected true to be false`
   *
   * The two timeouts belong to those two OTHER specs, not to this one's
   * larger iterations -- this spec's loop aborts on its 602-piece assertion
   * and never reaches them. That 602-piece failure is the instructive one:
   * 2^14-1 = 16,383 subsets falls UNDER a 20,000 subset cap, so the walk
   * does not truncate at all and simply takes as long as it takes. The
   * piece-count sweep is the point: a per-subset budget is flat in subsets
   * and LINEAR in pieces, so only varying pieces catches it.
   */
  it('refuses inside one frame at any piece count', () => {
    for (const [petals, len] of [
      [15, 40],
      [21, 300],
      [15, 560],
    ] as const) {
      const g = bundle(petals, len);
      const { space, ms } = timeAnalyse(g);
      expect(space.truncated, `${g.pieces.length} pieces`).toBe('work');
      expect(ms, `${g.pieces.length} pieces took ${ms.toFixed(0)}ms`).toBeLessThan(BOUND_MS);
    }
  });

  /*
   * THE OTHER DIRECTION, and the reason the budget is 150,000 and not 2,000:
   * a budget tight enough to refuse the dense case must still answer a large
   * ORDINARY layout in full. On today's catalogue the sharing graph has no
   * edges, so cost is the total weld count rather than a product.
   *
   * MUTATION PROOF, run: set CYCLE_WORK_BUDGET to 2_000 and TWO specs fail --
   * this one with `expected 'work' to be false`, because a 10,000-piece
   * layout of plain loops stops being answered at all, and the shipped-value
   * spec below with `expected 2000 to be 150000`. That pair is the point:
   * one guards the budget being too loose, this one guards it being too
   * tight.
   */
  it('still answers a legitimate 10,000-piece layout in full', () => {
    const g = loops(20, 500);
    const { space, ms } = timeAnalyse(g);
    expect(g.pieces).toHaveLength(10_000);
    expect(space.truncated).toBe(false);
    expect(space.cycles).toHaveLength(20);
    expect(ms, `took ${ms.toFixed(0)}ms`).toBeLessThan(BOUND_MS);
  });

  /*
   * analyseCycles MUST USE THE REAL ADJACENCY, and nothing else proved it did.
   *
   * MUTATION PROOF, run: replace the call with
   * `sharingGraph(graph, fundamentals).map(() => 0)` -- the exact "missing
   * edge" the docblock calls a false pass -- and this fails with
   * `expected [ { …(6) }, { …(6) } ] to have a length of 3 but got 2`.
   * Five specs fail in all. The combined loop stops being reachable and a
   * loop the user built is never checked.
   *
   * An earlier version of this record quoted that message BACKWARDS ("length
   * of 2 but got 3") and then corrected itself in prose with "in the other
   * direction", which is how a reversed quote survives review. The quote is
   * the measurement; prose cannot repair it.
   */
  it('reaches the combined subset when two fundamentals share pieces', () => {
    const a = analyse(bundle(3, 2));
    expect(a.truncated).toBe(false);
    expect(a.rank).toBe(2);
    // The two fundamentals plus their symmetric difference: three real loops.
    expect(a.cycles).toHaveLength(3);
  });

  /*
   * NOTHING TO MISTAKE FOR AN ANSWER, the same rule the rank ceiling follows.
   *
   * MUTATION PROOF, run: keep the cause but hand back the partial `cycles`
   * and a `worst` reduced over them (what this did before review) and this
   * is the ONLY spec that fails, with
   * `expected [ { …(6) }, { …(6) } ] to deeply equal []`. Only one, which is
   * exactly why it is here: nothing else looked.
   */
  it('reports no cycles and no worst when the budget stops it', () => {
    const a = analyse(bundle(21, 300));
    expect(a.truncated).toBe('work');
    expect(a.cycles).toEqual([]);
    expect(a.worst).toBeNull();
  });

  /*
   * THE SHIPPED CONSTANT, not a literal. The budget spec above passes its own
   * cost function and its own 500, so without this the value that actually
   * ships was pinned by nothing.
   *
   * MUTATION PROOF, run: set CYCLE_WORK_BUDGET to 20_000_000 and THREE specs
   * fail: this one with `expected 20000000 to be 150000`, the frame spec
   * above with `602 pieces: expected false to be 'work'`, and the
   * TOO_BIG_TO_CHECK verdict spec with `expected true to be false` --
   * because a budget that large stops bounding anything.
   */
  it('spends the shipped budget, which is what bounds the product', () => {
    expect(CYCLE_WORK_BUDGET).toBe(150_000);
    expect(analyse(bundle(21, 300)).truncated).toBe('work');
  });

  /*
   * WHAT THE PERSON READS, which is the only part of this they see.
   *
   * Both limits used to say "N independent loops is more than this can rank",
   * and `verdictAction` then advised "Break this into fewer loops". At rank 14
   * that sentence is simply untrue -- 14 is inside the ceiling of 20 -- and
   * the advice points at loops that are not the problem. The cause now picks
   * the reason, so the two refusals say different things.
   *
   * MUTATION PROOF, run: collapse the branch back to a single
   * `reason: 'TOO_MANY_LOOPS'` and this fails with
   * `expected 'TOO_MANY_LOOPS' to be 'TOO_BIG_TO_CHECK'`.
   */
  it('refuses a big dense layout as TOO_BIG_TO_CHECK, not as too many loops', () => {
    // 602 pieces, not 8402, because this spec is about the SENTENCE. The
    // overlap scan `solveGraph` also runs is cheap on a spread layout now,
    // but it is still quadratic in COINCIDENT ports and that is its own filed
    // P0 -- sizing this fixture by the sentence keeps the two apart.
    const g = bundle(15, 40);
    const r = solveGraph(g, ports, (id) => base(id), () => 0.8);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rank).toBeLessThanOrEqual(CYCLE_RANK_CEILING);
    expect(r.reason).toBe('TOO_BIG_TO_CHECK');
    expect(r.detail).toContain('would take too long');
    expect(r.detail).not.toContain('more than this can rank');
  });

  /**
   * THE NO-TRACED-CYCLES REFUSAL: its MISFIRE is pinned, its FIRING is not,
   * and that asymmetry is deliberate and worth stating.
   *
   * `solve.ts` refuses with NUMERIC when rank says there are loops and the
   * enumeration traced none, because `withinBound` is `every` over an empty
   * array and would otherwise read as "This works" in green. Replacing that
   * condition with `if (false as boolean)` leaves the whole suite green, so
   * nothing drives it -- and nothing CAN: every fundamental is a closing weld
   * plus a simple tree path, so each one has degree 2 everywhere and traces,
   * including a self-weld and a double edge. The one shape that defeats
   * `traceSimpleCycle` is a weld naming a piece the graph does not contain,
   * which `loadGraph` refuses and which throws inside `placeAll` before this
   * branch is reached (verified).
   *
   * So the firing is untestable without a seam, and this spec covers the
   * direction that can actually hurt a user: the guard must never refuse a
   * layout that is fine. A false FAILURE here would be invariant 3 broken the
   * other way round.
   *
   * MUTATION PROOF, run: change the condition to `space.cycles.length >= 0`
   * and this fails with
   * `one closed loop: expected 'NUMERIC' not to be 'NUMERIC'` -- the
   * assertion is `.not.toBe`, so that is how it reads -- because every
   * layout then refuses.
   */
  it('never refuses a layout whose cycles did trace', () => {
    const shapes: ReadonlyArray<readonly [string, Graph]> = [
      ['one closed loop', loops(1, 8)],
      ['twenty disjoint loops', loops(20, 8)],
      ['a long single loop', loops(1, 500)],
      ['two fundamentals sharing pieces', bundle(3, 2)],
      ['a dense bundle at the ceiling', bundle(21, 2)],
    ];
    for (const [name, g] of shapes) {
      const r = solveGraph(g, ports, (id) => base(id), () => 0.8);
      const reason = r.ok ? undefined : r.reason;
      expect(reason, name).not.toBe('NUMERIC');
    }
  });

  /* The rank ceiling keeps the OTHER sentence, so the two stay told apart. */
  it('still refuses a too-high rank as TOO_MANY_LOOPS', () => {
    const pieces: Piece[] = [{ pieceId: 'p', partId: 'E', turn: 'left' }];
    const welds = Array.from({ length: CYCLE_RANK_CEILING + 5 }, () => ({
      a: { pieceId: 'p', port: 1 },
      b: { pieceId: 'p', port: 0 },
    }));
    const r = solveGraph({ pieces, welds, anchors: new Map() }, ports, (id) => base(id), () => 0.8);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('TOO_MANY_LOOPS');
    expect(r.detail).toContain('more than this can rank');
  });
});
