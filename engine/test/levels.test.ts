/**
 * TWO LEVELS (docs/plan/2026-10-23-two-layers.md): levels worked out from
 * ramps, a loop that must come back down, a third level refused, track on
 * different levels crossing freely, and ends on different levels never
 * sharing a spot.
 *
 * Value: protects=the level walk (L1, A1, I1), the level residual (OV2), the
 * fault finder (D1, EOV1), the same-level overlap rule, the spot key, repair
 * never touching a ramp (D4), the rise coming from the built-in only (S1,
 * D5) and the frozen differential corpus (D3)
 * Value: fails_when=any of those regresses to the flat behaviour
 * Value: why_new=no level existed before
 * Value: seam=none (pure engine)
 * Value: no_claim=peg and socket in ramp loops (polarity is not what these
 * fixtures are about; classifyWelds is tested elsewhere) and real clearance
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver, resolveLibrary, type Submission } from '../data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { removePiece } from '../src/graph/edit.js';
import { connectorSites, findVertexClashes, landingOf } from '../src/graph/feasible.js';
import { findLevelFaults, placeAll, portFrame, residuals } from '../src/graph/frames.js';
import { levelOf, portsOf, type Frame, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { findBridges, findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;

/** A whole-mm position, a heading in sixteenths, and an optional level. */
const at = (x: number, y: number, heading: number, level = 0): Frame => {
  const pos = add(fromInt(x), scale(zetaPow(4), y)) as Cyc;
  return level === 0 ? { pos, heading } : { pos, heading, level };
};

/**
 * A closed loop of two-ended pieces. Each entry is a part, a turn, and which
 * end the walk ENTERS by: 0 forward, 1 reversed (a ramp entered at its high
 * end comes down). Piece i's exit is welded to piece i+1's entry; the last
 * weld closes the loop, so it is the residual these specs read.
 */
function loop(parts: readonly (readonly [string, 'left' | 'right', 0 | 1])[]): Graph {
  const pieces: Piece[] = parts.map(([partId, turn], i) => ({ pieceId: `p${i}`, partId, turn }));
  const welds: Weld[] = parts.map((_, i) => {
    const j = (i + 1) % parts.length;
    return {
      a: { pieceId: `p${i}`, port: 1 - parts[i]![2] },
      b: { pieceId: `p${j}`, port: parts[j]![2] },
    };
  });
  return { pieces, welds };
}

const E4 = (turn: 'left' | 'right' = 'left') => Array.from({ length: 4 }, () => ['E', turn, 0] as const);

describe('a loop comes back down to the level it left', () => {
  /*
   * MUTATION PROOFS, run:
   * - `levelSteps === 0` dropped from `closes` (frames.ts): the one-ramp spec
   *   fails with `expected true to be false`.
   * - `levelSteps` hard-coded to 0: the same spec fails with
   *   `expected +0 to be -1`, and the balanced spec still passes, which is
   *   why both exist.
   */
  it('up one ramp and down another: the stadium closes exactly', () => {
    const g = loop([...E4(), ['N', 'left', 0], ...E4(), ['N', 'left', 1]]);
    const [r] = residuals(g, ports, placeAll(g, ports));
    expect(r!.levelSteps).toBe(0);
    expect(r!.closes).toBe(true);
    expect(findLevelFaults(g, ports, placeAll(g, ports)).mismatches).toEqual([]);
  });

  it('up one ramp and never down: meets on the floor plan, not in level', () => {
    const g = loop([...E4(), ['N', 'left', 0], ...E4(), ['D', 'left', 0]]);
    const [r] = residuals(g, ports, placeAll(g, ports));
    expect(r!.gapMm).toBe(0);
    expect(r!.headingSteps).toBe(0);
    expect(r!.levelSteps).toBe(-1);
    expect(r!.closes).toBe(false);
    expect(findLevelFaults(g, ports, placeAll(g, ports)).mismatches.map((m) => m.weld)).toEqual([9]);
  });
});

describe('levels are relative to each run, with the floor at the bottom', () => {
  /*
   * MUTATION PROOF, run: the normalisation shift in `placeAll` disabled:
   * fails with `expected +0 to be 1` (the straight stays on the floor and the
   * ramp below it goes under the floor).
   */
  it('a ramp laid descending from a floor straight raises the straight', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 's', partId: 'A', turn: 'left' },
        { pieceId: 'r', partId: 'N', turn: 'left' },
      ],
      // The straight's exit meets the ramp's HIGH end: the ramp comes down.
      welds: [{ a: { pieceId: 's', port: 1 }, b: { pieceId: 'r', port: 1 } }],
    };
    const place = placeAll(g, ports);
    expect(levelOf(place.frames.get('s')!)).toBe(1);
    expect(levelOf(place.frames.get('r')!)).toBe(0);
  });

  it('a run with no ramp is on the floor, and writes no level at all (SC1)', () => {
    const g = loop([...E4(), ['D', 'left', 0], ...E4(), ['D', 'left', 0]]);
    for (const f of placeAll(g, ports).frames.values()) expect('level' in f).toBe(false);
  });
});

describe('a third level is refused, counted per ramp', () => {
  /*
   * MUTATION PROOFS, run:
   * - `LEVEL_COUNT` raised to 3: both specs fail with `expected [] to have a
   *   length of 1 but got +0`.
   * - the climbing-end filter removed (every port checked): the second spec
   *   fails with `expected [ …(2) ] to have a length of 1 but got 2` (the
   *   straight beyond the second ramp counted too).
   */
  it('an anchored raised run with a climbing ramp', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 's', partId: 'A', turn: 'left' },
        { pieceId: 'r', partId: 'N', turn: 'left' },
      ],
      welds: [{ a: { pieceId: 's', port: 1 }, b: { pieceId: 'r', port: 0 } }],
      anchors: new Map([['s', at(0, 0, 0, 1)]]),
    };
    const faults = findLevelFaults(g, ports, placeAll(g, ports));
    expect(faults.thirdLevels).toHaveLength(1);
    expect(faults.thirdLevels[0]!.pieceId).toBe('r');
  });

  it('two ramps climbing in a row, with track beyond them', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'r1', partId: 'N', turn: 'left' },
        { pieceId: 'r2', partId: 'N', turn: 'left' },
        { pieceId: 's', partId: 'A', turn: 'left' },
      ],
      welds: [
        { a: { pieceId: 'r1', port: 1 }, b: { pieceId: 'r2', port: 0 } },
        { a: { pieceId: 'r2', port: 1 }, b: { pieceId: 's', port: 0 } },
      ],
    };
    const faults = findLevelFaults(g, ports, placeAll(g, ports));
    expect(faults.thirdLevels).toHaveLength(1);
    expect(faults.thirdLevels[0]!.pieceId).toBe('r2');
  });
});

describe('track on different levels crosses freely; on one level it does not', () => {
  /*
   * A floor straight along x through the origin, and a straight across it,
   * anchored at the given level.
   *
   * MUTATION PROOF, run: the level filter removed from `planksSharingArea`
   * (overlap.ts): the bridge spec fails with `expected [ { a: 'f', b: 'u',
   * …(2) } ] to deeply equal []`, and so does the floor spec, from the
   * bridges side.
   */
  const crossing = (level: number): Graph => ({
    pieces: [
      { pieceId: 'f', partId: 'A', turn: 'left' },
      { pieceId: 'u', partId: 'A', turn: 'left' },
    ],
    welds: [],
    anchors: new Map([
      ['f', at(-72, 0, 0)],
      ['u', at(0, -72, 4, level)],
    ]),
  });
  const check = (g: Graph) => {
    const place = placeAll(g, ports);
    const segs = renderGraph(g, ports, resolve, place).segments;
    const sites = connectorSites(g, ports, place);
    return { overlaps: findPlankOverlaps(g, segs, half, sites), bridges: findBridges(g, segs, half, sites) };
  };

  it('raised over floor: a bridge, not an overlap', () => {
    const { overlaps, bridges } = check(crossing(1));
    expect(overlaps).toEqual([]);
    expect(bridges).toHaveLength(1);
  });

  it('both on the floor: an overlap, not a bridge', () => {
    const { overlaps, bridges } = check(crossing(0));
    expect(overlaps).toHaveLength(1);
    expect(bridges).toEqual([]);
  });

  it('a ramp clashes with track on either level', () => {
    const g: Graph = { ...crossing(1), pieces: [{ pieceId: 'f', partId: 'N', turn: 'left' }, { pieceId: 'u', partId: 'A', turn: 'left' }] };
    expect(check(g).overlaps).toHaveLength(1);
  });
});

describe('ends on different levels never share a spot (A1)', () => {
  /*
   * MUTATION PROOF, run: `spotKey` returning `latticeKey(pos)` alone
   * (feasible.ts): the clash spec fails with `expected [ { …(3) }, { …(3) } ]
   * to deeply equal []` and the landing spec with `expected 'joins' to be
   * 'clear'` (the raised end would join the floor end).
   */
  const stacked = (level: number): Graph => ({
    pieces: [
      { pieceId: 'f', partId: 'A', turn: 'left' },
      { pieceId: 'u', partId: 'A', turn: 'left' },
    ],
    welds: [],
    // The same straight twice, one on top of the other: two pieces sharing
    // both their end spots is what a clash is (feasible.ts counts per piece).
    anchors: new Map([
      ['f', at(0, 0, 0)],
      ['u', at(0, 0, 0, level)],
    ]),
  });

  it('a raised end above a floor end is no clash; on one level it is', () => {
    expect(findVertexClashes(stacked(1), ports, placeAll(stacked(1), ports))).toEqual([]);
    // One record per place, and the stacked straights share both of theirs.
    expect(findVertexClashes(stacked(0), ports, placeAll(stacked(0), ports))).toHaveLength(2);
  });

  it('a raised end lands clear over a free floor end', () => {
    const g: Graph = { pieces: [{ pieceId: 'f', partId: 'A', turn: 'left' }], welds: [], anchors: new Map([['f', at(0, 0, 0)]]) };
    const sites = connectorSites(g, ports, placeAll(g, ports));
    const floorStart = portFrame(placeAll(g, ports), ports, g.pieces[0]!, 0);
    // Facing it, as a joining end would, but one level up.
    const raised: Frame = { pos: floorStart.pos, heading: (floorStart.heading + 8) % 16, level: 1 };
    expect(landingOf(sites, raised, 'peg').kind).toBe('clear');
    expect(landingOf(sites, { pos: raised.pos, heading: raised.heading }, 'peg').kind).toBe('joins');
  });
});

describe('removing a piece from a loop that never comes back down moves nothing (OV2)', () => {
  /*
   * The closing weld meets on the floor plan but not in level. If `closes`
   * ignored level, deleting a piece would let that weld steer placement and
   * re-level the survivors.
   *
   * MUTATION PROOF, run: `levelSteps === 0` dropped from `closes`: fails with
   * `expected { …(3) } to deeply equal { …(2) }` (a survivor's frame gained a
   * level it did not have).
   */
  it('every surviving frame, level included, is unchanged', () => {
    const g = loop([...E4(), ['N', 'left', 0], ...E4(), ['D', 'left', 0]]);
    const before = placeAll(g, ports).frames;
    const after = removePiece(g, ports, 'p2');
    const now = placeAll(after, ports).frames;
    for (const [id, f] of now) expect(f).toEqual(before.get(id));
  });
});

describe('repair never adds or removes a ramp (D4)', () => {
  /*
   * A balanced bridge stadium with one D too many. Taking out a 216mm
   * straight closes it on the floor plan; taking out a RAMP would also close
   * it there, and break the loop's levels.
   *
   * MUTATION PROOF, run: `p.rise === undefined` removed from `isClean`
   * (repair.ts): fails with `expected 'N' to be 'D'` (the first ramp in the
   * walk was offered).
   */
  it('offers the flat straight', () => {
    const g = loop([['N', 'left', 0], ...E4(), ['D', 'left', 0], ['N', 'left', 1], ...E4(), ['D', 'left', 0], ['D', 'left', 0]]);
    const result = solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports), {
      parts: BUILT_IN,
      brandFit: () => ({ fit: 'joins' }) as never,
    });
    if (!result.ok) throw new Error('expected a solved loop');
    expect(result.repair?.part.id).toBe('D');
  });
});

describe('a part rises only because the built-in catalogue says so (S1, D5)', () => {
  const sub = (part: object, at = '2026-10-23T00:00:00Z'): Submission =>
    ({ part, at, corroborations: 0 }) as unknown as Submission;
  const n = BUILT_IN.find((p) => p.id === 'N')!;

  /*
   * MUTATION PROOFS, run:
   * - `withRise` returning the part unchanged: the stored-rise spec fails
   *   with `expected 1 to be undefined`.
   * - the kind check removed: the curve spec fails with `expected 'curve' to
   *   be 'straight'`.
   * - `withRise(s.part, undefined)` for every row: the correction spec fails
   *   with `expected undefined to be 1`. (The first mutation fails it the same
   *   way, since the corrected row then never gets the rise back.)
   */
  it('a stored straight carrying a rise loads flat', () => {
    const forged = { ...BUILT_IN.find((p) => p.id === 'D')!, id: 'X-RAMP', rise: 1 };
    const got = resolveLibrary([sub(forged)]).find((p) => p.id === 'X-RAMP')!;
    expect(got.kind === 'straight' ? got.rise : 'not a straight').toBe(undefined);
  });

  it('a correction turning the ramp into a curve is refused', () => {
    const curve = { ...BUILT_IN.find((p) => p.id === 'E')!, id: 'N', dimensions: { status: 'published', source: 'measured by me' } };
    expect(resolveLibrary([sub(curve)]).find((p) => p.id === 'N')!.kind).toBe('straight');
  });

  it('a better-sourced straight correction keeps the rise', () => {
    const { rise: _r, ...flat } = n as Extract<typeof n, { kind: 'straight' }>;
    const corrected = { ...flat, lengthMm: 206, dimensions: { status: 'published', source: 'measured by me' } };
    const got = resolveLibrary([sub(corrected)]).find((p) => p.id === 'N')!;
    expect(got.kind === 'straight' && got.lengthMm).toBe(206);
    expect(got.kind === 'straight' ? got.rise : undefined).toBe(1);
  });
});

describe('ramp loops, seeded: the level rules hold on random runs (T1 / D3)', () => {
  /*
   * Closed runs of E curves, D straights and ramps both ways round. Three
   * claims, each against a count made independently of the engine: the
   * closing weld's level residual is exactly the net climb, a run reaching
   * two levels above its lowest point has a third level, and swapping every
   * ramp for a D changes nothing the floor plan decides.
   *
   * MUTATION PROOF, run: `levelSteps` computed as `levelOf(a) - levelOf(b)`
   * (sign flipped): every seeded loop with a net climb fails with `expected
   * false to be true`, and the named one-ramp spec above with `expected 1 to
   * be -1`.
   */
  function lcg(seed: number) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  }
  const rand = lcg(20261023);
  for (let n = 0; n < 60; n++) {
    const len = 4 + Math.floor(rand() * 10);
    const parts = Array.from({ length: len }, () => {
      const r = rand();
      if (r < 0.2) return ['N', 'left', 0] as const;
      if (r < 0.4) return ['N', 'left', 1] as const;
      if (r < 0.6) return ['D', 'left', 0] as const;
      return ['E', rand() < 0.5 ? 'left' : 'right', 0] as const;
    });
    it(`run ${n}: ${parts.map(([p, , e]) => (p === 'N' ? (e === 0 ? 'U' : 'Dn') : p)).join(' ')}`, () => {
      const g = loop(parts);
      const place = placeAll(g, ports);
      const [r] = residuals(g, ports, place);
      let level = 0, lo = 0, hi = 0;
      for (const [p, , e] of parts) {
        if (p === 'N') level += e === 0 ? 1 : -1;
        lo = Math.min(lo, level);
        hi = Math.max(hi, level);
      }
      // The walk returns to the first piece's entry: the residual is the climb it never undid.
      expect(r!.levelSteps === -level).toBe(true);
      expect(findLevelFaults(g, ports, place).thirdLevels.length > 0).toBe(hi - lo >= 2);
      const flat = loop(parts.map(([p, t]) => (p === 'N' ? (['D', t, 0] as const) : ([p, t, 0] as const))));
      const [rf] = residuals(flat, ports, placeAll(flat, ports));
      // A reversed root turns the whole loop round, so compare the size of the gap, not its direction.
      expect(r!.gapMm).toBeCloseTo(rf!.gapMm, 9);
      expect(r!.headingSteps).toBe(rf!.headingSteps);
    });
  }
});

describe('coming down on N1 needs no adapter (N1, two pegs)', () => {
  /*
   * Raised medium straight, a two-socket C, the ramp entered at its HIGH end
   * (coming down), then a floor straight. With N1 every peg meets a socket;
   * with an N turned round, its low end is a socket meeting a socket.
   *
   * MUTATION PROOF, run: N1's ends set to N's ({ start: 'socket', end: 'peg' }):
   * the N1 spec fails with `expected [ { weld: 2, between: [ 'N1', 'A' ] } ]
   * to deeply equal []` (its low end a socket again: an adapter).
   */
  const down = (ramp: string): Graph => ({
    pieces: [
      { pieceId: 'a', partId: 'A', turn: 'left' },
      { pieceId: 'c', partId: 'C', turn: 'left' },
      { pieceId: 'r', partId: ramp, turn: 'left' },
      { pieceId: 'b', partId: 'A', turn: 'left' },
    ],
    welds: [
      { a: { pieceId: 'a', port: 1 }, b: { pieceId: 'c', port: 0 } },
      { a: { pieceId: 'c', port: 1 }, b: { pieceId: 'r', port: 1 } },
      { a: { pieceId: 'r', port: 0 }, b: { pieceId: 'b', port: 0 } },
    ],
  });
  const solve = (g: Graph) => solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports));

  it('N1: no polarity fault, no adapter, and the track before it is raised', () => {
    const r = solve(down('N1'));
    expect(r.polarityViolations).toEqual([]);
    expect(r.adapterJoints).toEqual([]);
    expect(levelOf(placeAll(down('N1'), ports).frames.get('a')!)).toBe(1);
    expect(levelOf(placeAll(down('N1'), ports).frames.get('b')!)).toBe(0);
  });

  it('an N turned round instead: buildable, with one male-male adapter', () => {
    const r = solve(down('N'));
    expect(r.polarityViolations).toEqual([]);
    expect(r.adapterJoints.map((j) => j.weld)).toEqual([2]);
  });
});

describe('a ramp flipped over comes down (owner, 2026-10-23: "flip in 3d")', () => {
  /*
   * BRIO track is double-sided. Turned over (turn 'right'), an ascending
   * track keeps its ends where they were but its high end is the entry, so a
   * loop climbs on one N and comes down on another, face down, with every peg
   * in a socket: no N1, no two-socket piece, no adapter.
   *
   * MUTATION PROOFS, run:
   * - `flippedRamp` always false (model.ts): the loop spec fails with
   *   `expected false to be true` (it climbs twice and never comes down),
   *   and the drawing spec with `expected +0 to be 1`.
   * - `highAtStart` never set (render.ts): the render spec fails with
   *   `expected undefined to be true`.
   */
  it('a stadium up one N and down another, flipped: exact, no fault, no adapter', () => {
    const g = loop([...E4(), ['N', 'left', 0], ...E4(), ['N', 'right', 0]]);
    const r = solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports));
    if (!r.ok) throw new Error('expected a solved loop');
    expect(r.closesExactly).toBe(true);
    expect(r.levelMismatches).toEqual([]);
    expect(r.polarityViolations).toEqual([]);
    expect(r.adapterJoints).toEqual([]);
  });

  it('the flipped ramp is high at its entry, and is drawn that way', () => {
    const g: Graph = { pieces: [{ pieceId: 'r', partId: 'N', turn: 'right' }], welds: [] };
    const place = placeAll(g, ports);
    const piece = g.pieces[0]!;
    expect(levelOf(portFrame(place, ports, piece, 0))).toBe(1);
    expect(levelOf(portFrame(place, ports, piece, 1))).toBe(0);
    expect(renderGraph(g, ports, resolve, place).segments[0]!.highAtStart).toBe(true);
  });
});
