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

  /*
   * THREE LOOSE ENDS MEETING IS STILL AN INVITATION, and until this spec
   * existed that decision was pinned by NOTHING.
   *
   * MUTATION PROOF, run: change the per-place emit to
   * `site.welded || site.freePieces.length >= 3` and only this spec fails,
   * with `expected [ { ... } ] to deeply equal []`. Before it existed that
   * same mutation left the WHOLE SUITE GREEN -- verified by running it --
   * even though `feasible.ts` records the identical change flipping 84 of
   * 1,023 fixtures from fine to IMPOSSIBLE when it was tried for real. The
   * fixtures nearby cover two free ends (invitation), two pieces stacked
   * (pile-up) and a free end on a joint; none of them put THREE distinct
   * free ends in one place, which is the shape a user reaches by laying
   * three curves so their ends converge.
   *
   * The three far ends must stay apart. If two of them coincided, those two
   * pieces would share a SECOND place and the pile-up rule would report it
   * correctly, which would make this spec pass for the wrong reason.
   */
  it('three loose ends meeting at one point is still an invitation', () => {
    const straight = resolve('A');
    if (straight.kind !== 'straight') throw new Error('part A is no longer a straight');
    const len = straight.lengthMm;
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'A' },
        { pieceId: 'b', partId: 'A' },
        { pieceId: 'c', partId: 'A' },
      ],
      welds: [],
      // Port 1 of each lands on the origin; port 0 fans out to -len, -len*i
      // and +len, which are three distinct places holding one end each.
      anchors: new Map([
        ['a', { pos: scale(zetaPow(0), -len), heading: 0 }],
        ['b', { pos: scale(zetaPow(4), -len), heading: 4 }],
        ['c', { pos: scale(zetaPow(8), -len), heading: 8 }],
      ]),
    };
    expect(clashes(g)).toEqual([]);
  });

  /*
   * WHERE THE NEW RULE REPORTS MORE THAN THE OLD ONE, which the docblock in
   * `feasible.ts` used to claim could not happen.
   *
   * A piece whose own two ends are welded to each other is one VERTEX at two
   * POSITIONS. Two such pieces, unanchored, both fall to the identity, so the
   * same two vertices coincide at the origin AND at `len`. The old rule
   * deduped on the vertex PAIR across the whole layout, so it reported the
   * first place and silently dropped the second; this one reports per place,
   * so it reports both.
   *
   * The verdict is IMPOSSIBLE either way, so this is neither a new false
   * refusal nor a false pass -- only a count that went from 1 to 2, and the
   * second marker is now drawn where there is really something to see. Pinned
   * here because the equivalence argument the reformulation rests on is
   * otherwise stated only in prose, and stated too strongly.
   *
   * MUTATION PROOF, run: dedupe `clashes` on the sorted pair of pieceIds
   * before returning. THREE specs fail, not one -- this one, `reports two
   * places for a pile of loose pieces, not one per pair`, and `reports both
   * places, once each, and the welded one is not doubled` -- all three with
   * `expected [ { ...(3) } ] to have a length of 2 but got 1`. The first
   * draft of this record said one spec and quoted a message that never
   * appeared; it is written out here because the count and the text are the
   * two things this file's header forbids guessing.
   */
  /*
   * A PIECE WHOSE TWO FREE ENDS SHARE A PLACE IS ITS OWN PILE-UP.
   *
   * Not buildable from storage -- `looksLikePart` admits only straights and
   * curves, needs `lengthMm > 0`, and bounds `arcSteps` -- so this drives
   * `PortsOf` directly, which is a seam the specs above already use. The
   * span rule asks a piece for the PAIR of places it spans, and a piece with
   * both ends in one place names no pair, so it used to drop out of its own
   * pile-up and the overlap vanished from the sentence and the canvas.
   *
   * MUTATION PROOF, run: drop `|| site.selfPileUp` from the emit and this
   * fails with `expected [] to have a length of 1 but got +0`. Measured
   * against the code before the fix, the same fixture returned 0 records --
   * a false pass, which is the direction that is never acceptable here.
   */
  it('a piece with both free ends in one place is reported', () => {
    const zero: readonly Port[] = [
      { kind: 'end', at: { pos: fromInt(0), heading: 0 }, polarity: 'socket' },
      { kind: 'end', at: { pos: fromInt(0), heading: 8 }, polarity: 'peg' },
    ];
    const withZero = (piece: Piece): readonly Port[] =>
      piece.partId === 'ZERO' ? zero : ports(piece);
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'A' },
        { pieceId: 'z', partId: 'ZERO' },
      ],
      welds: [],
      anchors: new Map(),
    };
    const found = findVertexClashes(g, withZero, placeAll(g, withZero));
    expect(found).toHaveLength(1);
    expect(found[0]!.at.join(',')).toBe('0,0');
  });

  it('two self-welded pieces stacked report BOTH shared places, not one', () => {
    const straight = resolve('A');
    if (straight.kind !== 'straight') throw new Error('part A is no longer a straight');
    const len = straight.lengthMm;
    const g: Graph = {
      pieces: [
        { pieceId: 'u', partId: 'A' },
        { pieceId: 'v', partId: 'A' },
      ],
      welds: [
        { a: { pieceId: 'u', port: 0 }, b: { pieceId: 'u', port: 1 } },
        { a: { pieceId: 'v', port: 0 }, b: { pieceId: 'v', port: 1 } },
      ],
      anchors: new Map(),
    };
    const found = clashes(g);
    expect(found).toHaveLength(2);
    expect(found.map((c) => c.at.join(',')).sort()).toEqual(['0,0', `${len},0`]);
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
 * seconds by ten thousand, on a 1MB stored layout that still reported "ok"
 * -- the figures themselves live in the DONE entry in
 * `docs/plan/brio-TODOS.md`, so this docblock cannot drift from them.
 * A freeze is not a throw, so nothing caught it and every reload repeated it.
 * Value: seam=none
 * Value: no_claim=nothing about pieces crossing mid-span, which this never
 * checked and the verdict copy says out loud. Nothing either about three or
 * more LOOSE ends meeting in one place, which stays an invitation rather
 * than a clash. The all-coincident case used to be disclaimed here as
 * "quadratic in the coincidences, work proportional to the answer"; two
 * specs below now pin it by record count instead, so that disclaimer is
 * retired rather than merely stale.
 *
 * The clash SEMANTICS are unchanged and were held fixed while the cost
 * changed: 582 fixtures (every catalogue part at both turns as open chains
 * and closed loops, 400 random soups, the 16xE double circle and the 8L8R
 * tangent pair) produced byte-identical output before and after, 749 clash
 * records in all. The specs above are what pin the semantics; the four
 * below pin the cost, the one new assumption underneath it, and the
 * coincident case the two later ones were added for.
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
   * which is what a "spatial grid" usually means -- leaves the whole suite
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
   * THE CLOCK IS THE BACKSTOP HERE, not the primary assertion.
   *
   * What catches a regression in these two specs is the RECORD COUNT: the
   * pair walk produced 998,499 records for 4,000 lapped pieces where the
   * place rule produces 8, so the count fails by five orders of magnitude
   * before any timer is consulted. The bound exists so a future rule that
   * keeps the count small but walks the pairs anyway cannot pass.
   *
   * 1,000ms, RAISED FROM 300 after measuring it under the run that actually
   * happens. 300 was sized against the file-isolated steady state of 3-8ms,
   * but `vitest` runs files in parallel: measured that way the 4,000-piece
   * case reaches 53ms, and under ten CPU spinners on eight cores it reaches
   * 134ms, which is 2.2x of a 300ms bound. This branch has already flaked
   * two wall-clock specs by sizing against the measured pass rather than the
   * distance to the regression, and 300 was the third instance waiting to
   * happen. At 1,000ms the headroom is ~7x under load while the regression
   * below still overshoots by 15x, so both directions stay true.
   */
  const SCAN_BOUND_MS = 1000;
  /** The rings case has its own bound: a different shape and a different
   *  regression distance, named rather than left as a literal 110 lines on. */
  const RINGS_BOUND_MS = 500;

  /** An OPEN run of `n` Large curves. `E` turns 45 degrees, so eight close a
   *  circle and the run laps the same EIGHT places however long it gets. */
  const lappedRun = (n: number): Graph => {
    const pieces: Piece[] = [];
    const welds: Weld[] = [];
    for (let i = 0; i < n; i++) pieces.push({ pieceId: `l${i}`, partId: 'E', turn: 'left' });
    for (let i = 0; i + 1 < n; i++)
      welds.push({ a: { pieceId: `l${i}`, port: 1 }, b: { pieceId: `l${i + 1}`, port: 0 } });
    return { pieces, welds, anchors: new Map() };
  };

  /*
   * THE SHAPE THAT NO SPEC COVERED, and the one the whole P0 was about.
   *
   * Grouping ports by place made the SPREAD case linear and did nothing here,
   * because when ports coincide the group is the layout. The scan emitted one
   * record per PAIR of vertices in a place, so a lapped run put C(k,2) records
   * in eight places: MEASURED before the fix, 4,000 pieces gave 998,499
   * records in 825ms and 8,000 gave 3,996,999 in 5,907ms with 2.35GB
   * resident. 800 `add` actions through the real reducer reach 39,699 records.
   *
   * Counting per PIECE rather than per pair of pieces gives the identical set
   * of places in one pass. The record count becomes the number of places,
   * which is what `clashMarkers` draws.
   *
   * MUTATION PROOF, run: restore the pair walk (one record per vertex pair,
   * accumulated per piece-pair) and this fails on the RECORD COUNT, not the
   * clock: `1000 pieces, 62124 records: expected 62124 to be 8`, on the FIRST
   * iteration -- the loop aborts there and never reaches 4,000, where the
   * same mutation would be 998,499. The pile spec below fails the same way,
   * `expected [...] to have a length of 2 but got 999000`.
   */
  it('reports places, not pairs, when a run laps the same spots', () => {
    for (const n of [1000, 4000]) {
      const g = lappedRun(n);
      const place = placeAll(g, ports);
      const t0 = performance.now();
      const found = findVertexClashes(g, ports, place);
      const ms = performance.now() - t0;
      // Eight places, however long the run gets. The laps genuinely collide,
      // so this must still REPORT -- just once per place.
      expect(
        new Set(found.map((c) => c.at.join(','))).size,
        `${n} pieces, distinct places`,
      ).toBe(8);
      expect(found.length, `${n} pieces, ${found.length} records`).toBe(8);
      expect(ms, `${n} lapped pieces took ${ms.toFixed(0)}ms`).toBeLessThan(SCAN_BOUND_MS);
    }
  });

  /*
   * A PILE AT THE IDENTITY, the cheapest route to the same explosion: a
   * stored blob with no welds and no anchors, so `placeAll` puts every
   * component root at the identity and all of them stack. 1,000 pieces is a
   * 32KB blob -- 0.6% of a ~5MB quota -- and used to be 999,000 records in
   * 968ms. Two places now: one per end of the stack.
   */
  it('reports two places for a pile of loose pieces, not one per pair', () => {
    const n = 1000;
    const g: Graph = {
      pieces: Array.from({ length: n }, (_, i) => ({ pieceId: `s${i}`, partId: 'A' })),
      welds: [],
      anchors: new Map(),
    };
    const place = placeAll(g, ports);
    const t0 = performance.now();
    const found = findVertexClashes(g, ports, place);
    const ms = performance.now() - t0;
    expect(found).toHaveLength(2);
    expect(ms, `${n} stacked pieces took ${ms.toFixed(0)}ms`).toBeLessThan(SCAN_BOUND_MS);
  });

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
   * `RINGS_BOUND_MS` is 500, which is 30x the steady state. Only the
   * 10,000-piece case is timed, because it is the one that catches the
   * mutation decisively; the small case is kept for its CORRECTNESS
   * assertion, which is the other failure direction (a scan that invents a
   * clash where the rings are anchored apart).
   *
   * MUTATION PROOF, run: restore the all-pairs `for (let j = i + 1; ...)`
   * loop. This fails by one to one-and-a-half orders of magnitude: 4.8s
   * measured with the file run on its own, and 15.6-16.0s under the full
   * parallel suite, against the 500ms bound. An earlier version of this
   * record said "two orders of magnitude -- tens of seconds", which only the
   * loaded figure comes close to, and before that it quoted 8.3s as if a
   * single number were available. The spread across runs is 5x (8.3s, 17s,
   * 46s observed) and this record no longer offers a cause for it: it
   * previously blamed GC pressure from the clash records, but `ringsApart`
   * anchors its rings so that nothing coincides, so the mutation allocates
   * no records at all.
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
      // Timed only on the big case, identified by the loop's own k rather
      // than by re-deriving 20 * 500 as a literal.
      if (k === 500) {
        expect(ms, `${g.pieces.length} pieces took ${ms.toFixed(0)}ms`).toBeLessThan(
          RINGS_BOUND_MS,
        );
      }
    }
  });
});

/**
 * ONE PLACE CAN BE BOTH THINGS AT ONCE, and the reformulation has to answer
 * both questions about it.
 *
 * Value: protects=a place that holds a welded end AND two or more free ones is
 * reported once for being welded, and its free pieces still count toward the
 * pile-up that reports the OTHER place
 * Value: fails_when=the welded answer and the pile-up answer are conflated --
 * either by dropping a welded place's `freePieces`, which loses the place it
 * would have piled up with, or by dropping the already-reported guard, which
 * reports one place twice
 * Value: why_new=every clash fixture in this suite is a chain, a lapped run or
 * a pile of loose pieces, and none of them can produce this shape: piling up
 * needs two pieces whose free ends share two places, which needs four free
 * ends, and a chain has two. MEASURED over 1,037 fixture shapes -- every
 * catalogue part at both turns as open and closed chains of 1/2/3/4/8/9/16/17/
 * 24 pieces, 700 random mixed chains, piles of 2/3/5/10/60 loose pieces of one
 * and of mixed parts, and lapped open runs of 9/17/33 Large curves -- BOTH
 * mutations below produce byte-identical output to the shipped code, so
 * nothing in the suite could see either one.
 * Value: seam=none
 * Value: no_claim=nothing about the ORDER the two records come out in beyond
 * their being one per place, and nothing about three or more loose ends meeting
 * at one point, which the specs above own and which stays an invitation.
 *
 * THE SHAPE. `x` and `y` are two Medium straights with no welds and no
 * anchors, so `placeAll` stacks them on the identity frame and they share BOTH
 * their ends: that pair of places is the pile-up. `z0` is anchored one
 * straight-length behind the origin and welded to `z1`, so the weld's vertex
 * lands exactly on the first of those two places. That place is therefore
 * welded AND holds two free ends.
 *
 * MUTATION PROOF, run against a relocated copy of `feasible.ts` -- its
 * siblings unmodified -- because this audit may not write to `engine/src`:
 *
 *   drop a welded place's free pieces (`freeReps.length === reps.length` added
 *   to the `freePieces` condition): ONE record instead of two, and this fails
 *   with `expected [ { …(3) } ] to have a length of 2 but got 1`. The origin
 *   is still reported for being welded; the place it piles up with is lost.
 *
 *   drop the `!reportedPlaces.has(site.key)` guard on the pile-up emit: THREE
 *   records, the places coming out as `[[0,0],[0,0],[144,0]]`, and this fails
 *   with `expected [ { …(3) }, { …(3) }, …(1) ] to have a length of 2 but got
 *   3`. The verdict would count a place twice while `clashMarkers` drew it
 *   once, which is the disagreement the place rule exists to end.
 *
 * ONE SPEC FAILS under each of them -- this one. That count is not a guess:
 * it is the 1,037-shape comparison above, where neither mutation changed the
 * output of any shape this suite builds.
 */
describe('a place can be welded AND hold a pile-up, and it is one record either way', () => {
  const straightA = resolve('A');
  if (straightA.kind !== 'straight') throw new Error('part A is no longer a straight');
  const lenA = straightA.lengthMm;

  const g: Graph = {
    pieces: [
      { pieceId: 'x', partId: 'A' },
      { pieceId: 'y', partId: 'A' },
      { pieceId: 'z0', partId: 'A' },
      { pieceId: 'z1', partId: 'A' },
    ],
    welds: [{ a: { pieceId: 'z0', port: 1 }, b: { pieceId: 'z1', port: 0 } }],
    anchors: new Map([['z0', { pos: scale(zetaPow(0), -lenA), heading: 0 }]]),
  };

  it('reports both places, once each, and the welded one is not doubled', () => {
    const found = clashes(g);
    expect(found).toHaveLength(2);
    const places = found.map((c) => c.at.join(','));
    // The welded joint sits on the origin, where x and y also have a free end.
    expect(places).toContain('0,0');
    // The other end of the stacked pair, reported only because those two
    // pieces share this place as well.
    expect(places).toContain(`${lenA},0`);
    expect(new Set(places).size).toBe(2);
  });
});
