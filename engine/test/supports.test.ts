/**
 * IS RAISED TRACK HELD UP (supports.ts; owner decisions 2026-11-06: a
 * warning naming the piece, dead ends not judged, a support counts when the
 * centre line crosses it turned roughly along).
 *
 * Value: protects=what holds track (a track support, a ramp's high end, a
 * structure's raised road), the span measured between them, open ends
 * reported and never judged, and the check staying off until F4 is read
 * Value: fails_when=a support stops counting, a turned or sideways support
 * starts counting, a stretch is measured wrong, or an open end is judged
 * Value: why_new=supports were never checked; the verdict said so
 * Value: seam=none (pure engine; solveGraph's own wiring is the last block)
 * Value: no_claim=the F4 figure itself, which is the owner's reading
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { MEASUREMENTS } from '../data/measurements.js';
import { SUPPORT_SPAN_MM } from '../data/supportSpan.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';
import { checkSupports, type SupportReport } from '../src/graph/supports.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const at = (x: number, y: number, heading: number): Frame => ({ pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc, heading });

/**
 * A run of pieces from the origin, heading +x, each welded to the next. A
 * ramp entered at its high end (1) comes down. Supports stand where told.
 *
 *   N up     216     then the pieces    N down
 *   0 ------ 216 ---- ... ------------- end
 */
function run(parts: readonly (readonly [string, 0 | 1])[], supports: readonly Frame[] = []): Graph {
  const pieces: Piece[] = [
    ...parts.map(([partId], i) => ({ pieceId: `p${i}`, partId, turn: 'left' as const })),
    ...supports.map((_, i) => ({ pieceId: `ts${i}`, partId: 'TS', turn: 'left' as const })),
  ];
  const welds: Weld[] = parts.slice(1).map((_, i) => ({
    a: { pieceId: `p${i}`, port: 1 - parts[i]![1] },
    b: { pieceId: `p${i + 1}`, port: parts[i + 1]![1] },
  }));
  return { pieces, welds, anchors: new Map([['p0', at(0, 0, 0)], ...supports.map((f, i) => [`ts${i}`, f] as const)]) };
}

function check(g: Graph, spanMm: number | null): SupportReport | null {
  const r = renderGraph(g, ports, resolve, placeAll(g, ports));
  const partOf = new Map(g.pieces.map((p) => [p.pieceId, p.partId]));
  return checkSupports(r.segments, r.bodies, (id) => resolve(partOf.get(id)!), spanMm);
}

/** Each stretch's length, to the millimetre. */
const unheld = (r: SupportReport | null) => r!.unheld.map((u) => Math.round(u.lengthMm));
const openEnds = (r: SupportReport | null) => r!.openEnds.map((o) => o.pieceId);

// Up, two medium straights, down: 288 of raised track between the ramps' high ends.
const BRIDGE: readonly (readonly [string, 0 | 1])[] = [['N', 0], ['A', 0], ['A', 0], ['N', 1]];
// The joint between the two straights.
const MIDDLE = 216 + 144;

describe('what holds raised track up', () => {
  /*
   * MUTATION PROOFS, run:
   * - the ramp's high end dropped from `anchors`: `expected [ 'p1', 'p2' ]
   *   to deeply equal []` (both straights become open ends).
   * - `held` never filled from `feet`: the support spec fails with
   *   `expected [ 288 ] to deeply equal []`.
   */
  it("a ramp's high end holds the track joined to it", () => {
    expect(unheld(check(run(BRIDGE), 300))).toEqual([]);
    expect(openEnds(check(run(BRIDGE), 300))).toEqual([]);
  });

  it('a stretch longer than F4 is named, by the piece at its middle', () => {
    expect(unheld(check(run(BRIDGE), 200))).toEqual([288]);
    // 144 then 216: the middle, 180 along, is 36 into the long straight.
    const r = check(run([['N', 0], ['A', 0], ['D', 0], ['N', 1]]), 200)!;
    expect(r.unheld.map((u) => [u.pieceId, Math.round(u.lengthMm), [...u.pieceIds].sort()])).toEqual([['p2', 360, ['p1', 'p2']]]);
    expect(r.unheld[0]!.at[0]).toBeCloseTo(216 + 180, 0);
  });

  it('a track support under the joint holds it: two 131.5 gaps, either side of its 25', () => {
    const r = check(run(BRIDGE, [at(MIDDLE, 0, 0)]), 200);
    expect(unheld(r)).toEqual([]);
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 0, 0)]), 131))).toEqual([132, 132]);
  });

  /*
   * MUTATION PROOFS, run:
   * - `diff <= ALONG_RAD` replaced by `true`: the square-on spec fails with
   *   `expected [] to deeply equal [ 288 ]`.
   * - the `across` test dropped from `holds`: the 30-sideways spec fails the
   *   same way.
   */
  it('turned one step it still holds; turned two steps or square on, it does not', () => {
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 0, 1)]), 200))).toEqual([]);
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 0, 2)]), 200))).toEqual([288]);
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 0, 4)]), 200))).toEqual([288]);
    // Turned end for end is the same support: it has no front.
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 0, 8)]), 200))).toEqual([]);
  });

  it('the centre line must cross its footprint: 20 to one side holds, 30 does not', () => {
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 20, 0)]), 200))).toEqual([]);
    expect(unheld(check(run(BRIDGE, [at(MIDDLE, 30, 0)]), 200))).toEqual([288]);
  });

  /*
   * MUTATION PROOF, run: the structure's raised road dropped from `anchors`:
   * `expected [ 'p1', 'p3' ] to deeply equal []`.
   */
  it("a riser holds the track joined to its deck, and its own road is not checked", () => {
    const r = check(run([['N', 0], ['D', 0], ['RS', 0], ['D', 0], ['N', 1]]), 220);
    expect(unheld(r)).toEqual([]);
    expect(openEnds(r)).toEqual([]);
  });
});

describe('raised track ending in mid-air', () => {
  /*
   * MUTATION PROOF, run: the `openEnds.push` dropped: `expected [] to
   * deeply equal [ 'p2' ]`.
   */
  it('is reported, never judged: F4 does not measure how far track sticks out', () => {
    const r = check(run([['N', 0], ['A', 0], ['A', 0]]), 200);
    expect(openEnds(r)).toEqual(['p2']);
    expect(unheld(r)).toEqual([]);
  });

  it('a support under its end holds it, and the span behind is checked', () => {
    const r = check(run([['N', 0], ['A', 0], ['A', 0]], [at(216 + 288 - 12, 0, 0)]), 200);
    expect(openEnds(r)).toEqual([]);
    expect(unheld(r)).toEqual([264]);
  });
});

describe('the check stays off until F4 is read', () => {
  it('with no figure there is no report, and nothing raised needs none', () => {
    expect(check(run(BRIDGE), null)).toBeNull();
    expect(check(run([['A', 0], ['A', 0]]), 200)).toBeNull();
  });

  it('the shipped figure is the sheet’s, never typed in', () => {
    expect(SUPPORT_SPAN_MM).toBe(MEASUREMENTS.f4.supportGapMm);
  });

  /*
   * MUTATION PROOF, run: `supports` hard-coded to null in solve.ts: `expected
   * null not to be null`.
   */
  it('solveGraph reports it on every raised layout, from the figure it is given', () => {
    const g = run(BRIDGE);
    const solved = solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports), undefined, undefined, undefined, 200);
    expect(solved.supports).not.toBeNull();
    expect(unheld(solved.supports)).toEqual([288]);
    const off = solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports), undefined, undefined, undefined, null);
    expect(off.supports).toBeNull();
  });
});
