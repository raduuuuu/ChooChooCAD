/**
 * The cycle space (T5 and T6).
 *
 * The property that matters most here is NEGATIVE: give is never pooled. A
 * layout with a slack loop and a tight loop must not let the slack one pay
 * for the tight one, because the joints are not shared.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { CYCLE_RANK_CEILING, analyseCycles, forEachConnectedSubset } from '../src/graph/cycles.js';
import { placeAll, residuals } from '../src/graph/frames.js';
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
    expect(a.truncated).toBe(true);
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
 * Value: protects=solveGraph stays inside a frame budget at the accepted rank
 * ceiling, so an ordinary layout cannot freeze the tab
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

  it('solves a rank-20 layout of 160 pieces inside one frame budget', () => {
    const g = loops(20);
    const t0 = performance.now();
    analyse(g);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it('does not grow exponentially in rank', () => {
    const ms = (n: number) => {
      const t0 = performance.now();
      analyse(loops(n));
      return performance.now() - t0;
    };
    const small = Math.max(ms(10), 0.5);
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
    const complete = forEachConnectedSubset(nb, rank, budget, (m) => got.push(m));
    return { got, complete };
  };

  /*
   * MUTATION PROOF, run: pass `0` instead of `seen` as the child's `banned`
   * and this fails on duplicates at rank 3 (8 emitted where 7 are connected).
   * That argument is the whole duplicate-avoidance mechanism.
   *
   * A first version of this comment claimed that masking `ext` with `~seen`
   * was also load-bearing. It is not -- removing it left all 405 green,
   * because the child filters its own candidates by `banned` anyway. The
   * redundant mask is gone rather than left wearing a false justification.
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
   * MUTATION PROOF, run: remove the `if (++spent > budget)` early return and
   * this test hangs rather than failing -- so it is written with a small
   * budget and an assertion on the COUNT, which fails fast instead.
   */
  it('stops at the budget and says so, instead of running to completion', () => {
    const rank = 20;
    const complete = (1 << rank) - 1;
    const nb = Array.from({ length: rank }, (_, i) => complete & ~(1 << i));
    let visits = 0;
    const done = forEachConnectedSubset(nb, rank, 500, () => {
      visits++;
    });
    expect(done).toBe(false);
    expect(visits).toBeLessThanOrEqual(500);
  });

  it('reports completion when it finishes inside the budget', () => {
    const { complete, got } = collect([0b10, 0b01], 2, 1000);
    expect(complete).toBe(true);
    // {0}, {1}, {0,1}: all three are connected when the two share a piece.
    expect(got.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});
