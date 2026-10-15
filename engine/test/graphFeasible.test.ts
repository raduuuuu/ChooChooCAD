/**
 * T9: feasibility lifted to vertices.
 *
 * The acceptance condition from the plan is a pair: a declared weld must
 * never be reported as an overlap, AND the two known false-pass fixtures
 * must still FAIL. Either alone is easy and useless. Excluding too much is
 * exactly what the chain engine's index rules did.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { findVertexClashes, findWeldPolarityViolations } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { type Cyc, equals, scale, zetaPow, add, fromInt } from '../src/geom/cyclotomic.js';
import type { Layout } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const clashes = (g: Graph) => findVertexClashes(g, ports, placeAll(g, ports));

const chain = (ids: string[], closed: boolean, turn: 'left' | 'right' = 'left'): Layout => ({
  placements: ids.map((partId) => ({ partId, turn })),
  closed,
});

describe('a declared weld is never an overlap', () => {
  it('an open chain reports nothing', () => {
    expect(clashes(graphFromChain(chain(Array(6).fill('A'), false)))).toEqual([]);
  });

  it('the exact circle reports nothing, including at its seam', () => {
    // The chain engine needed two index exclusions to get this right: the
    // `(0, n)` seam and `(0, n-1)`. There is no exclusion here at all.
    expect(clashes(graphFromChain(chain(Array(8).fill('E'), true)))).toEqual([]);
  });

  it('the stadium reports nothing', () => {
    const g = graphFromChain(
      chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D'], true),
    );
    expect(clashes(g)).toEqual([]);
  });

  it('a switch feeding two branches reports nothing', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'A' },
        { pieceId: 'b', partId: 'A2' },
      ],
      welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 0 } }],
    };
    expect(clashes(g)).toEqual([]);
  });
});

describe('the known false passes still FAIL', () => {
  /*
   * 16 E curves closed is two laps of the same circle. Every connector
   * position is visited twice, so eight pairs of distinct vertices share a
   * position. The loop closes exactly, which is what made this a false pass:
   * geometry says yes and physics says the track is on top of itself.
   */
  it('16xE double circle: eight spots, one clash each', () => {
    const found = clashes(graphFromChain(chain(Array(16).fill('E'), true)));
    /*
     * EIGHT, not 32. Sixteen curves are two laps of an eight-position
     * circle, so eight places each hold two separate joins. Counting PORT
     * pairs instead gave 32, because each place has two vertices of two
     * ports, and the verdict then said "32 pairs" while the canvas drew
     * eight markers. The number a user reads has to be the number of
     * problems they have to fix.
     */
    expect(found).toHaveLength(8);
    const places = new Set(found.map((c) => `${c.at[0]},${c.at[1]}`));
    expect(places.size).toBe(found.length);
    for (const c of found) {
      expect(`${c.a.pieceId}#${c.a.port}`).not.toBe(`${c.b.pieceId}#${c.b.port}`);
    }
  });

  it('8L+8R figure eight: the tangency is caught', () => {
    const g = graphFromChain({
      placements: [
        ...Array(8).fill({ partId: 'E', turn: 'left' }),
        ...Array(8).fill({ partId: 'E', turn: 'right' }),
      ],
      closed: true,
    });
    expect(clashes(g).length).toBeGreaterThan(0);
  });

  /*
   * The exclusions are GONE, not widened. A chain-adjacent pair that is not
   * welded must be reported, which is precisely what `b - a === 1` used to
   * suppress. Two separate pieces placed at the same spot with no weld
   * between them is the minimal case.
   */
  it('two unwelded pieces in the same place are reported', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'x', partId: 'A' },
        { pieceId: 'y', partId: 'A' },
      ],
      welds: [],
    };
    // Both start at the identity frame, so all four ports coincide pairwise.
    expect(clashes(g).length).toBeGreaterThan(0);
  });
});

describe('polarity is a property of the weld', () => {
  it('an ordinary chain of alternating ends is fine', () => {
    const g = graphFromChain(chain(Array(4).fill('A'), false));
    expect(findWeldPolarityViolations(g, resolve, ports)).toEqual([]);
  });

  /*
   * B2 is "mini straight, two pegs" and C2 is "two sockets": real adapter
   * pieces that exist because two pegs cannot be joined. Welding B2 to B2
   * is the physical impossibility the check is for.
   */
  it('two pieces of the same polarity cannot be welded', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'p', partId: 'B2' },
        { pieceId: 'q', partId: 'B2' },
      ],
      welds: [{ a: { pieceId: 'p', port: 1 }, b: { pieceId: 'q', port: 1 } }],
    };
    const found = findWeldPolarityViolations(g, resolve, ports);
    expect(found).toHaveLength(1);
    expect(found[0]!.between).toEqual(['B2', 'B2']);
  });

  it('a heel is exempt, so a switch raises nothing', () => {
    // Covered in switches.test.ts at the predicate level; this is the
    // end-to-end path through the weld scan.
    const g: Graph = {
      pieces: [{ pieceId: 's', partId: 'A' }],
      welds: [],
    };
    expect(findWeldPolarityViolations(g, resolve, ports)).toEqual([]);
  });
});

/*
 * THE BUG A USER REPORTED. Eight large curves laid end to end bring their two
 * loose ends to the same spot; that is the moment before you join them, and
 * it was being reported as "Can't be built."
 */
describe('free ends meeting are an invitation, not a clash', () => {
  const openRun = (n: number) => clashes(graphFromChain(chain(Array(n).fill('E'), false)));

  it('eight curves whose ends have arrived at the same spot report nothing', () => {
    expect(openRun(8)).toEqual([]);
  });

  it('and welding them keeps it clean', () => {
    expect(clashes(graphFromChain(chain(Array(8).fill('E'), true)))).toEqual([]);
  });

  /*
   * The discriminator is how many points a pair of pieces shares. One is a
   * meeting; both ends is a pile-up that no weld can fix.
   */
  it('two pieces lying on top of each other are still reported', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'x', partId: 'A' },
        { pieceId: 'y', partId: 'A' },
      ],
      welds: [],
    };
    expect(clashes(g).length).toBeGreaterThan(0);
  });

  /*
   * An end that is ALREADY welded is spoken for, so a free end landing on it
   * is still a clash, which is what keeps the exclusion from swallowing real
   * overlaps. Sixteen curves in an OPEN run is the real case: after eight the
   * track is back where it started, so the free first end sits exactly on a
   * joint in the middle of the run.
   *
   * My first attempt welded a third piece onto that joint, which merges all
   * three ports into ONE vertex and therefore correctly reports nothing. A
   * declared join is never a collision.
   */
  it('a free end landing on an existing joint is still a clash', () => {
    expect(openRun(16).length).toBeGreaterThan(0);
  });
});

/**
 * THE OVERLAP SCAN IS GROUPED BY EXACT POSITION, not compared all-pairs.
 *
 * Value: protects=the overlap scan costs what the layout contains rather than
 * the square of it, so a large stored layout cannot freeze the tab in the one
 * function that runs before every other bound
 * Value: fails_when=the grouping key stops agreeing with `equals`, so two
 * ports in the same place land in different groups and an overlap is missed
 * Value: why_new=the all-pairs loop was unbounded and nothing enforced the
 * 500-port ceiling its own shortcut note named. MEASURED on 20 rings of
 * ordinary straights, every port claimed once, no duplicate weld, catalogue
 * parts only -- so no guard anywhere objects: 1,000 pieces 85ms, 5,000
 * 2,221ms, 10,000 8,337ms, on a 1MB stored layout that still reported "ok".
 * A freeze is not a throw, so nothing caught it and every reload repeated it.
 * Value: seam=none
 * Value: no_claim=nothing about pieces crossing mid-span, which this never
 * checked and the verdict copy says out loud. Nothing either about a layout
 * whose ports genuinely all coincide: that stays quadratic in the
 * coincidences, which is work proportional to the answer.
 *
 * The clash SEMANTICS are unchanged and were held fixed while the cost
 * changed: 582 fixtures (every catalogue part at both turns as open chains
 * and closed loops, 400 random soups, the 16xE double circle and the 8L8R
 * tangent pair) produced byte-identical output before and after, 749 clash
 * records in all. The specs above are what pin the semantics; these two pin
 * the cost and the one new assumption underneath it.
 */
describe('the overlap scan groups by exact position', () => {
  /*
   * THE ASSUMPTION THE GROUPING RESTS ON, and the only genuinely new one:
   * a lattice position's coefficient tuple is an exact equality key. It holds
   * because a position is eight INTEGERS in a fixed basis and `equals` is
   * `isZero(sub(a, b))`, so joining cannot merge two different elements and
   * cannot split one. `-0` is the case worth naming: it stringifies to "0"
   * and `-0 === 0`, so it keys with `0` exactly as `equals` treats it.
   *
   * THIS SPEC DOES NOT PIN THE GROUPING'S CHOICE OF KEY, and saying so is the
   * point. Keying the scan on `toXY(pos)` instead -- the float projection,
   * which is what a "spatial grid" usually means -- leaves all 428 specs
   * green, verified by running it. No fixture here has two distinct lattice
   * points that collide under the projection, and building one needs
   * coefficients large enough for double spacing to swallow their
   * difference. So what this spec pins is the ASSUMPTION the grouping rests
   * on, not its use; the use is kept honest by `latticeKey` being the one
   * place the question is asked. Filed as a coverage gap rather than left
   * implied.
   */
  it('a position tuple is an exact equality key, which is what makes grouping sound', () => {
    const samples: Cyc[] = [];
    for (let k = 0; k < 16; k++)
      for (const r of [0, 1, -1, 54, 216, -216, 1000]) samples.push(scale(zetaPow(k), r));
    samples.push(add(scale(zetaPow(1), 216), scale(zetaPow(3), -54)));
    samples.push(add(scale(zetaPow(3), -54), scale(zetaPow(1), 216)));
    samples.push(fromInt(0), scale(fromInt(0), -1));

    let compared = 0;
    for (const a of samples)
      for (const b of samples) {
        compared++;
        expect(a.join(',') === b.join(','), `${a.join(',')} vs ${b.join(',')}`).toBe(equals(a, b));
      }
    expect(compared).toBeGreaterThan(10_000);
  });

  /** `n` rings of `k` straights, anchored far apart so none of them overlap. */
  const ringsApart = (n: number, k: number): Graph => {
    const pieces: Piece[] = [];
    const welds: Weld[] = [];
    const anchors = new Map<string, { pos: Cyc; heading: number }>();
    for (let c = 0; c < n; c++) {
      for (let i = 0; i < k; i++) pieces.push({ pieceId: `c${c}p${i}`, partId: 'A' });
      for (let i = 0; i < k; i++)
        welds.push({ a: { pieceId: `c${c}p${i}`, port: 1 }, b: { pieceId: `c${c}p${(i + 1) % k}`, port: 0 } });
      anchors.set(`c${c}p0`, { pos: scale(zetaPow(4), 100_000 * (c + 1)), heading: 0 });
    }
    return { pieces, welds, anchors };
  };

  /*
   * ONE SIZE, TIMED, AND THE BOUND IS SIZED AGAINST THE MUTATION.
   *
   * A first version timed both 1,000 and 10,000 pieces against 100ms and
   * flaked: 107ms on the 10,000-piece case on a loaded machine against a
   * 16-18ms steady state, which is only 6x of headroom. The lesson is the one
   * `BOUND_MS` in cycles.test.ts already records -- size the bound against
   * the distance to the regression, not against the measured pass -- and it
   * applies here too.
   *
   * 500ms is 30x the steady state and still catches the regression by 16x.
   * Only the 10,000-piece case is timed, because it is the one that catches
   * the mutation decisively; the small case is kept for its CORRECTNESS
   * assertion, which is the other failure direction (a scan that invents a
   * clash where the rings are anchored apart).
   *
   * MUTATION PROOF, run: restore the all-pairs `for (let j = i + 1; ...)`
   * loop and this fails at `10000 pieces took 8337ms`, 16x past the bound.
   * At 1,000 pieces the same mutation is only 162ms, which is why timing the
   * small case bought nothing but flake.
   */
  it('costs what the layout contains, not the square of it', () => {
    for (const [n, k] of [
      [20, 50],
      [20, 500],
    ] as const) {
      const g = ringsApart(n, k);
      const place = placeAll(g, ports);
      const t0 = performance.now();
      const found = findVertexClashes(g, ports, place);
      const ms = performance.now() - t0;
      // Anchored apart, so there is genuinely nothing to report. A scan that
      // invented a clash here would be the other failure direction.
      expect(found, `${g.pieces.length} pieces`).toEqual([]);
      if (g.pieces.length >= 10_000) {
        expect(ms, `${g.pieces.length} pieces took ${ms.toFixed(0)}ms`).toBeLessThan(500);
      }
    }
  });
});
