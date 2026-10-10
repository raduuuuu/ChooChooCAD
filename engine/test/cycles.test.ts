/**
 * The cycle space (T5 and T6).
 *
 * The property that matters most here is NEGATIVE: give is never pooled. A
 * layout with a slack loop and a tight loop must not let the slack one pay
 * for the tight one, because the joints are not shared.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { CYCLE_RANK_CEILING, analyseCycles } from '../src/graph/cycles.js';
import { placeAll, residuals } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port } from '../src/graph/model.js';
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
