/**
 * THE DIFFERENTIAL HARNESS (task T7).
 *
 * The chain engine is correct, well tested and about to be replaced. The only
 * honest way to delete it is to run both engines over the same layouts and
 * require them to agree EXACTLY, not within a tolerance: both work in
 * Z[zeta16], so a disagreement of one unit is a real disagreement.
 *
 * The plan asks for the rank-1 fixtures. This goes further and enumerates
 * layouts rather than listing them, because a hand-written fixture list is
 * only as good as the cases someone thought of, and the interesting failures
 * in this engine have all been cases nobody thought of: the 20mm radius error
 * that six reviews missed, the tangency false pass, the seam exclusion.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { magnitude } from '../src/geom/cyclotomic.js';
import { placeAll, residuals } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Piece, type Port } from '../src/graph/model.js';
import type { Layout, Turn } from '../src/parts/schema.js';
import { computeResidual } from '../src/solver/residual.js';
import { solveLayout } from '../src/solver/result.js';
import { solveGraph } from '../src/graph/solve.js';
import type { Part } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

/** What the two engines must agree on for one layout. */
/*
 * Only CLOSED layouts are compared on gap.
 *
 * `computeResidual` returns end-minus-start for an open chain too: five
 * 144mm straights report a 720mm "gap". That is a displacement, not a gap,
 * and `solveLayout` discards it with NO_CYCLE before any verdict is made.
 * The graph engine has no cycle to report and says so. Comparing the two
 * numbers directly would be comparing two different questions, so open
 * layouts are checked on RANK instead: both engines must agree that there is
 * nothing to close.
 */
function viaChain(layout: Layout) {
  const r = computeResidual(layout, resolve);
  return { gapMm: r.gapMm, closes: r.closesExactly, heading: r.headingMismatchSteps };
}

function hasCycle(layout: Layout): boolean {
  return layout.closed && layout.placements.length > 0;
}

function viaGraph(layout: Layout) {
  const g = graphFromChain(layout);
  const rs = residuals(g, ports, placeAll(g, ports));
  if (rs.length === 0) return { gapMm: 0, closes: true, heading: 0 };
  // A chain has at most one cycle, so there is at most one residual to compare.
  const r = rs[0]!;
  return { gapMm: magnitude(r.gap), closes: r.closes, heading: r.headingSteps };
}

const BRIO = BUILT_IN.filter((p) => p.brand === 'BRIO').map((p) => p.id);

/** Deterministic, so a failure is reproducible from the seed alone. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function randomChain(rand: () => number, n: number, closed: boolean): Layout {
  const placements = Array.from({ length: n }, () => ({
    partId: BRIO[Math.floor(rand() * BRIO.length)]!,
    turn: (rand() < 0.5 ? 'left' : 'right') as Turn,
  }));
  return { placements, closed };
}

describe('both engines agree exactly', () => {
  const named: Array<[string, Layout]> = [
    ['8xE circle', { placements: Array(8).fill({ partId: 'E', turn: 'left' }), closed: true }],
    [
      'stadium',
      {
        placements: [
          ...Array(4).fill({ partId: 'E', turn: 'left' }),
          { partId: 'D' },
          ...Array(4).fill({ partId: 'E', turn: 'left' }),
          { partId: 'D' },
        ],
        closed: true,
      },
    ],
    [
      'near miss',
      {
        placements: [
          ...Array(4).fill({ partId: 'E', turn: 'left' }),
          { partId: 'D' },
          ...Array(4).fill({ partId: 'E', turn: 'left' }),
          { partId: 'A' },
        ],
        closed: true,
      },
    ],
    ['16xE double circle', { placements: Array(16).fill({ partId: 'E', turn: 'left' }), closed: true }],
    [
      '8L+8R figure eight',
      {
        placements: [
          ...Array(8).fill({ partId: 'E', turn: 'left' }),
          ...Array(8).fill({ partId: 'E', turn: 'right' }),
        ],
        closed: true,
      },
    ],
    ['open chain', { placements: Array(5).fill({ partId: 'A', turn: 'left' }), closed: false }],
    ['single piece, closed', { placements: [{ partId: 'E', turn: 'left' }], closed: true }],
    ['empty, closed', { placements: [], closed: true }],
  ];

  for (const [name, layout] of named) {
    it(name, () => {
      const g = graphFromChain(layout);
      const rank = placeAll(g, ports).forest.closing.length;
      expect(rank, 'cycle rank').toBe(hasCycle(layout) ? 1 : 0);
      if (!hasCycle(layout)) return;
      expect(viaGraph(layout)).toEqual(viaChain(layout));
    });
  }

  /*
   * 600 random chains. Enumeration rather than a fixture list, because every
   * defect this engine has actually shipped was a case nobody enumerated.
   * Mixed turns matter most: a single-radius-class layout cannot detect a
   * radius disagreement at all (the radius-difference invariant), so a
   * harness of circles and stadiums would pass with the two engines using
   * different radii.
   */
  it('600 random chains, 1 to 12 pieces, both turn directions', () => {
    const rand = lcg(20261010);
    const disagreements: string[] = [];
    for (let i = 0; i < 600; i++) {
      const n = 1 + Math.floor(rand() * 12);
      const layout = randomChain(rand, n, rand() < 0.7);
      if (!hasCycle(layout)) continue;
      const a = viaChain(layout);
      const b = viaGraph(layout);
      if (a.closes !== b.closes || a.heading !== b.heading || Math.abs(a.gapMm - b.gapMm) > 1e-9) {
        disagreements.push(
          `${layout.placements.map((p) => p.partId + (p.turn === 'right' ? 'R' : 'L')).join(' ')}` +
            ` closed=${layout.closed} chain=${JSON.stringify(a)} graph=${JSON.stringify(b)}`,
        );
      }
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
  });

  /*
   * The harness has to be able to FAIL. A differential test between two
   * engines that silently compares nothing is the circular pin all over
   * again, so this feeds the graph engine a deliberately wrong part and
   * checks the comparison notices.
   */
  it('the comparison is not vacuous', () => {
    const layout: Layout = {
      placements: Array(8).fill({ partId: 'E', turn: 'left' }),
      closed: true,
    };
    /*
     * Bends ONE radius class, E only.
     *
     * My first version bent every curve, and the mixed layout's gap did not
     * move at all: with both classes shifted by the same amount the
     * DIFFERENCE r1 - r2 is unchanged, and closure depends only on that
     * difference. That is the radius-difference invariant, and it is exactly
     * why a symmetric 20mm transcription error survived six review passes.
     * A harness that bent both radii would prove nothing.
     */
    const wrong = (piece: Piece): readonly Port[] => {
      const part = resolve(piece.partId);
      return portsOf(
        part.kind === 'curve' && part.id === 'E'
          ? { ...part, innerRadiusMm: part.innerRadiusMm + 1 }
          : part,
        piece.turn,
      );
    };
    const g = graphFromChain(layout);
    const rs = residuals(g, ports, placeAll(g, ports));
    const rsWrong = residuals(g, wrong, placeAll(g, wrong));
    // Single radius class, so closure is radius-independent: even a bent E
    // still closes. Stated here because it looks like a missing assertion
    // and is in fact the invariant.
    expect(rs[0]!.closes).toBe(true);
    expect(rsWrong[0]!.closes).toBe(true);

    const mixed: Layout = {
      placements: [
        ...Array(4).fill({ partId: 'E', turn: 'left' }),
        ...Array(4).fill({ partId: 'E1', turn: 'left' }),
      ],
      closed: true,
    };
    const mg = graphFromChain(mixed);
    const right = magnitude(residuals(mg, ports, placeAll(mg, ports))[0]!.gap);
    const bent = magnitude(residuals(mg, wrong, placeAll(mg, wrong))[0]!.gap);
    expect(bent).not.toBeCloseTo(right, 6);
  });
});

/*
 * THE FULL VERDICT, not just the gap.
 *
 * Agreeing on a number is necessary and not sufficient: the app shows a
 * verdict, and the verdict is where clashes override closure and where
 * rotation outranks give. This runs the same enumerated layouts through
 * `solveLayout` and `solveGraph` and requires the user-visible conclusion to
 * match. It is the gate for pointing the app at the graph engine.
 */
describe('both engines reach the same verdict', () => {
  const slop = (pieceId: string, layout: Layout): number => {
    const index = Number(pieceId.slice(1));
    return resolve(layout.placements[index]!.partId).slop.axialMm;
  };

  /** The conclusion a user would act on, reduced to something comparable. */
  function verdictOfChain(layout: Layout) {
    const r = solveLayout(layout, resolve);
    if (!r.ok) return { kind: r.reason === 'NO_CYCLE' ? 'NO_CYCLE' : r.reason };
    if (r.clashes.length > 0) return { kind: 'IMPOSSIBLE' };
    if (r.polarityViolations.length > 0) return { kind: 'IMPOSSIBLE' };
    if (r.closesExactly) return { kind: 'EXACT' };
    return { kind: r.withinBound ? 'NEEDS_GIVE' : 'EXCEEDS' };
  }

  function verdictOfGraph(layout: Layout) {
    const g = graphFromChain(layout);
    const r = solveGraph(
      g,
      ports,
      (id: string): Part => resolve(id),
      (pieceId) => slop(pieceId, layout),
    );
    if (!r.ok) return { kind: r.reason };
    if (r.clashes.length > 0) return { kind: 'IMPOSSIBLE' };
    if (r.polarityViolations.length > 0) return { kind: 'IMPOSSIBLE' };
    if (r.closesExactly) return { kind: 'EXACT' };
    return { kind: r.withinBound ? 'NEEDS_GIVE' : 'EXCEEDS' };
  }

  it('600 random chains reach the same user-visible verdict', () => {
    const rand = lcg(20261010);
    const disagreements: string[] = [];
    for (let i = 0; i < 600; i++) {
      const n = 1 + Math.floor(rand() * 12);
      const layout = randomChain(rand, n, rand() < 0.7);
      const a = verdictOfChain(layout);
      const b = verdictOfGraph(layout);
      if (a.kind !== b.kind) {
        disagreements.push(
          `${layout.placements.map((p) => p.partId + (p.turn === 'right' ? 'R' : 'L')).join(' ')}` +
            ` closed=${layout.closed} chain=${a.kind} graph=${b.kind}`,
        );
      }
    }
    expect(disagreements.slice(0, 6)).toEqual([]);
  });

  it('the two known false passes are IMPOSSIBLE in both', () => {
    const double: Layout = {
      placements: Array(16).fill({ partId: 'E', turn: 'left' }),
      closed: true,
    };
    const eight: Layout = {
      placements: [
        ...Array(8).fill({ partId: 'E', turn: 'left' }),
        ...Array(8).fill({ partId: 'E', turn: 'right' }),
      ],
      closed: true,
    };
    for (const l of [double, eight]) {
      expect(verdictOfGraph(l)).toEqual(verdictOfChain(l));
      expect(verdictOfGraph(l).kind).toBe('IMPOSSIBLE');
    }
  });
});
