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
import { portsOf, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { CYCLE_RANK_CEILING } from '../src/graph/cycles.js';
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

/*
 * Two-ended parts only. The chain engine refuses a multi-road piece by design
 * (pose.ts `refuseMultiRoad`), so a switch or a crossing in the pool would
 * compare a throw with a verdict rather than two verdicts. They are the graph
 * engine's alone.
 *
 * And FLAT parts only (eng decision D3 of the two-layer review): the chain
 * engine has no levels, so a ramp would compare a level-blind verdict with a
 * level-aware one, and adding the ramp to this list would also change
 * `BRIO.length` and with it every seeded layout below, so the promise that
 * existing verdicts are unchanged would be tested on a different corpus.
 * Ramps get their own seeded enumeration in levels.test.ts.
 */
const BRIO = BUILT_IN.filter(
  (p) => p.brand === 'BRIO' && (p.kind === 'straight' || p.kind === 'curve') && !(p.kind === 'straight' && p.rise),
).map((p) => p.id);

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

describe('the corpus is the one the engines agreed on before levels', () => {
  /*
   * MUTATION PROOF, run: the `rise` filter removed from `BRIO`: fails with
   * `expected [ 'A2', 'A1', 'A', 'D', 'A3', …(9) ] to deeply equal [ 'A2',
   * 'A1', 'A', 'D', 'A3', …(8) ]`. Every seeded layout below draws from this list by
   * index, so a part added to it changes every one of them.
   */
  it('draws from the flat, two-ended BRIO parts only', () => {
    expect(BRIO).toEqual(['A2', 'A1', 'A', 'D', 'A3', 'B2', 'C2', 'B', 'C', 'B1', 'C1', 'E', 'E1']);
  });
});

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
    if (!r.ok) return { kind: r.reason };
    if (r.clashes.length > 0) return { kind: 'IMPOSSIBLE' };
    /*
     * PEGS ONLY. Since 2026-10-23 two sockets meeting is buildable with a
     * male-male adapter, and the user-visible verdict only refuses two pegs.
     * The legacy chain engine still lists a socket pair as a violation, a
     * documented disagreement (docs/plan/2026-10-23-socket-adapter.md, NOT in
     * scope), so the reduction to "what the user sees" applies the app's rule
     * here rather than changing the legacy engine.
     *
     * MUTATION PROOF, run: count every chain violation again (drop the
     * filter): fails with `expected [ …(6) ] to deeply equal []`, first entry
     * "A3L C1R closed=true chain=IMPOSSIBLE graph=EXCEEDS".
     */
    if (r.polarityViolations.some((v) => v.polarity === 'peg')) return { kind: 'IMPOSSIBLE' };
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
      placeAll(g, ports),
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

/*
 * Value: protects=solveGraph's failure translations no chain can reach: the run-count detail, the rank ceiling, a non-finite give, and clashes reported with no loop
 * Value: fails_when=the detail reverts to restating the headline, a truncated or non-finite cycle space still returns a verdict, or clashes are dropped from the !ok branch
 * Value: why_new=the harness above compares the two engines over single-run chains, which reach none of these; cycles.test.ts stops at analyseCycles' own flags
 * Value: seam=none
 * Value: no_claim=nothing about the sentence the UI renders (verdictView.ts owns that and has no test at all) and nothing about which loop a user should fix first
 *
 * Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
 */
describe('what only the graph engine can say, which is the boundary of the comparison above', () => {
  const slopOf = (g: Graph) => (pieceId: string) => {
    const piece = g.pieces.find((p) => p.pieceId === pieceId)!;
    return resolve(piece.partId).slop.axialMm;
  };
  const solve = (g: Graph, slop = slopOf(g)) =>
    solveGraph(g, ports, (id: string): Part => resolve(id), slop, placeAll(g, ports));

  /** A straight run of `ids`, open at both ends. */
  const chain = (ids: string[], closed: boolean): Layout => ({
    placements: ids.map((partId) => ({ partId, turn: 'left' as Turn })),
    closed,
  });

  /** Two chains on the table with nothing joining them: not expressible as one. */
  function twoRuns(): Graph {
    const a = graphFromChain(chain(['A', 'A'], false));
    const b = graphFromChain(chain(['E', 'E'], false));
    return {
      pieces: [...a.pieces, ...b.pieces.map((p) => ({ ...p, pieceId: `q${p.pieceId}` }))],
      welds: [
        ...a.welds,
        ...b.welds.map((w) => ({
          a: { ...w.a, pieceId: `q${w.a.pieceId}` },
          b: { ...w.b, pieceId: `q${w.b.pieceId}` },
        })),
      ],
      anchors: new Map([['qp0', { pos: [900, 0, 0, 0, 0, 0, 0, 0] as never, heading: 0 }]]),
    };
  }

  it('counts the separate RUNS on the table, which is the fact a chain could not hold', () => {
    /*
     * MUTATION (run): making the detail unconditional on `runs` ("N pieces,
     * open at both ends") drops the run count, and the empty-canvas copy goes
     * back to restating its own headline. Two runs of two is four pieces, and
     * "4 pieces, open at both ends" is false about both of them.
     */
    const two = solve(twoRuns());
    expect(two.ok).toBe(false);
    if (two.ok) throw new Error('unreachable');
    expect(two.reason).toBe('NO_CYCLE');
    expect(two.detail).toBe('2 separate runs of track, none of them a loop');
    expect(two.rank).toBe(0);
  });

  it('says piece, singular, for one piece, and pieces for several', () => {
    const one = solve(graphFromChain(chain(['A'], false)));
    const three = solve(graphFromChain(chain(['A', 'A', 'A'], false)));
    expect(one.ok || three.ok).toBe(false);
    expect((one as Extract<typeof one, { ok: false }>).detail).toBe('1 piece, open at both ends');
    expect((three as Extract<typeof three, { ok: false }>).detail).toBe('3 pieces, open at both ends');
  });

  it('counts the open ends of a run with a switch, which has three, not two', () => {
    /*
     * MUTATION (run): restoring the unconditional "open at both ends" fails
     * with `expected '1 piece, open at both ends' to be '1 piece, 3 open ends'`.
     * The second case pins the weld subtraction: dropping `2 * welds` fails
     * with `'2 pieces, 5 open ends'`.
     */
    const one = solve({ pieces: [{ pieceId: 's', partId: 'L' }], welds: [] });
    const fed: Graph = {
      pieces: [{ pieceId: 's', partId: 'L' }, { pieceId: 'a', partId: 'A' }],
      welds: [{ a: { pieceId: 's', port: 1 }, b: { pieceId: 'a', port: 0 } }],
    };
    expect((one as Extract<typeof one, { ok: false }>).detail).toBe('1 piece, 3 open ends');
    const two = solve(fed);
    expect((two as Extract<typeof two, { ok: false }>).detail).toBe('2 pieces, 3 open ends');
  });

  it('an overlap is reported with NO loop, because where the pieces ARE is already a fact', () => {
    // Two unwelded pieces in the same place. MUTATION (run): moving `clashes`
    // back onto the ok branch only returns [] here, and the user is told the
    // one thing that is not wrong while two runs sit on top of each other.
    const stacked: Graph = {
      pieces: [
        { pieceId: 'p0', partId: 'A', turn: 'left' },
        { pieceId: 'p1', partId: 'A', turn: 'left' },
      ],
      welds: [],
    };
    const r = solve(stacked);
    expect(r.ok).toBe(false);
    expect(r.clashes.length).toBeGreaterThan(0);
  });

  it('refuses to rank more loops than it can search, instead of answering about some of them', () => {
    // MUTATION (run): dropping solveGraph's `space.truncated` branch returns
    // ok:true with gapMm 0 and withinBound true -- a PASS for a layout whose
    // cycle space was never searched.
    const pieces: Piece[] = [{ pieceId: 'p', partId: 'E', turn: 'left' }];
    const welds = Array.from({ length: CYCLE_RANK_CEILING + 5 }, () => ({
      a: { pieceId: 'p', port: 1 },
      b: { pieceId: 'p', port: 0 },
    }));
    const r = solve({ pieces, welds });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('TOO_MANY_LOOPS');
    expect(r.rank).toBeGreaterThan(CYCLE_RANK_CEILING);
  });

  it('a non-finite give is a refusal, never a gap verdict carrying NaN', () => {
    /*
     * A part whose slop figure came out non-finite -- a submitted measurement
     * is the live route to one. The circle still closes exactly, so this is
     * the dangerous shape: every geometric figure is right and only the give
     * is unusable. MUTATION (run): dropping the `Number.isFinite` sweep
     * returns ok:true with EXACT, so a layout judged against a give of NaN
     * reads as a definite yes.
     */
    const g = graphFromChain(chain(Array(8).fill('E'), true));
    const r = solve(g, () => Number.NaN);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('NUMERIC');
  });
});
