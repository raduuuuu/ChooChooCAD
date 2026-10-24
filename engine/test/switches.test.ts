/**
 * SWITCHES (task T8, on T2's model).
 *
 * A chain cannot express a branch: every element has one predecessor and one
 * successor. This is the test that says the graph can, and that the switch
 * heel gets all three of the treatments the architecture review found C6 had
 * collapsed into one.
 *
 * The switch here is DECLARED LOCALLY, not taken from the catalogue. Nobody
 * publishes BRIO's switch geometry in a citable form, and this project does
 * not write down a dimension it cannot source. These numbers are chosen to
 * make the arithmetic exact and claim nothing about real track; the point
 * under test is the model, not the millimetres.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { spanningForest } from '../src/graph/forest.js';
import { placeAll, portFrame, residuals } from '../src/graph/frames.js';
import { classifyWelds, findWeldPolarityViolations } from '../src/graph/feasible.js';
import { solveGraph } from '../src/graph/solve.js';
import {
  portsOf,
  weldGiveMm,
  type Graph,
  type Piece,
  type Port,
} from '../src/graph/model.js';
import { displacement } from '../src/geom/pose.js';
import type { Part, SwitchPart } from '../src/parts/schema.js';

const base = makeResolver(BUILT_IN);
const A1 = base('A1');
const E = base('E');

/*
 * Throws rather than falling back. The first version of this read
 * `A1.kind === 'straight' ? A1.lengthMm : 0`, and a 0 there would have built a
 * zero-length switch whose specs fail far from the cause. The narrowing exists
 * for the type checker, not as a real branch: if A1 ever stops being a straight
 * this fixture is meaningless and should say so at the point of breakage.
 */
const a1Length = (): number => {
  if (A1.kind !== 'straight') {
    throw new Error(`fixture needs A1 to be a straight, got ${A1.kind}`);
  }
  return A1.lengthMm;
};

/*
 * Same guard for E, added 2026-10-20. The docblock below claimed every field
 * was derived while `arcSteps` and `innerRadiusMm` still fell back to the
 * literals 2 and 182, and that 182 was the same hard-coded radius this task
 * removed from `trustBoundary.test.ts`. Falling back silently also contradicted
 * the reasoning written directly above for `a1Length`.
 */
const eCurve = (): { arcSteps: number; innerRadiusMm: number } => {
  if (E.kind !== 'curve') {
    throw new Error(`fixture needs E to be a curve, got ${E.kind}`);
  }
  return { arcSteps: E.arcSteps, innerRadiusMm: E.innerRadiusMm };
};

/*
 * A switch whose straight road is one A1 and whose diverging road is one E.
 *
 * Every DIMENSIONAL field below is derived from those two catalogue parts, with
 * no written dimension and no silent fallback. The identity fields (`id`,
 * `brand`, `kind`, `name`) are literals, as a fixture's identity should be; an
 * earlier version of this sentence said "every field", which was false for
 * those four. `throughLengthMm` used to be the literal
 * 108, and the spec it feeds claims the switch's straight road matches "a plain
 * straight of the same length" -- a claim that must hold for whatever length A1
 * is, not only for 108. Pinning the number here meant a dimension change in
 * `brio.ts` failed this file too, which is the collateral noise task K2 set out
 * to remove: the catalogue is pinned in `engine/test/sources.test.ts` and
 * nowhere else.
 */
const SW: SwitchPart = {
  id: 'TEST-SWITCH',
  brand: 'BRIO',
  kind: 'switch',
  name: 'Test switch',
  throughLengthMm: a1Length(),
  arcSteps: eCurve().arcSteps,
  innerRadiusMm: eCurve().innerRadiusMm,
  dimensions: A1.dimensions,
  slop: A1.slop,
  ends: A1.ends,
  heightMm: A1.heightMm,
  gaugeWidthMm: A1.gaugeWidthMm,
  plankWidthMm: A1.plankWidthMm,
  plankThicknessMm: A1.plankThicknessMm,
};

const resolve = (id: string): Part => (id === SW.id ? SW : base(id));
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

describe('a switch is three ports', () => {
  it('has a heel and two roads', () => {
    const p = portsOf(SW);
    expect(p).toHaveLength(3);
    expect(p[0]!.kind).toBe('heel');
    expect(p[1]!.kind).toBe('end');
    expect(p[2]!.kind).toBe('end');
  });

  it('its straight road matches a plain straight of the same length', () => {
    expect(portsOf(SW)[1]!.at).toEqual(portsOf(A1)[1]!.at);
  });

  it('its diverging road matches a plain curve of the same radius', () => {
    expect(portsOf(SW)[2]!.at).toEqual(portsOf(E)[1]!.at);
  });

  it('mirrors with turn, so one part serves both hands', () => {
    expect(portsOf(SW, 'right')[2]!.at).not.toEqual(portsOf(SW, 'left')[2]!.at);
    expect(portsOf(SW, 'right')[1]!.at).toEqual(portsOf(SW, 'left')[1]!.at);
  });
});

/*
 * THE HEEL IS A CONNECTOR.
 *
 * T8 once exempted the heel from give and from polarity, on the reading that
 * it was a point inside the piece with no plug and no socket. Port 0 is the
 * plank's end face, and the reproduction switches carry an 18mm peg or a
 * socket there (`switchSeeds.ts`). These specs drive the real paths, the
 * solver and the weld scan, rather than the predicates, so they fail if the
 * exemption comes back anywhere on the way.
 */
describe('the heel is an ordinary connector', () => {
  const slopOf = (pieceId: string): number =>
    resolve(pieceId === 'sw' ? SW.id : 'E').slop.axialMm;

  /** The diverging road plus seven E is a full circle, closed onto the heel. */
  const loopThroughHeel = (): Graph => ({
    pieces: [
      { pieceId: 'sw', partId: SW.id },
      ...Array.from({ length: 7 }, (_, i) => ({ pieceId: `e${i}`, partId: 'E' })),
    ],
    welds: [
      { a: { pieceId: 'sw', port: 2 }, b: { pieceId: 'e0', port: 0 } },
      ...Array.from({ length: 6 }, (_, i) => ({
        a: { pieceId: `e${i}`, port: 1 },
        b: { pieceId: `e${i + 1}`, port: 0 },
      })),
      { a: { pieceId: 'e6', port: 1 }, b: { pieceId: 'sw', port: 0 } },
    ],
  });

  /*
   * MUTATION PROOF, run: in cycles.ts `giveOfWeld`, return 0 when either port
   * is a heel. Fails with `expected 5.6 to be close to 6.4`: the loop loses
   * the heel joint's give.
   */
  it('donates give like any joint, so a loop through it counts every weld', () => {
    const g = loopThroughHeel();
    const r = solveGraph(g, ports, resolve, slopOf, placeAll(g, ports));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    const perWeld = A1.slop.axialMm;
    expect(r.totalGiveMm).toBeCloseTo(8 * perWeld, 9);
    // The give rule itself: the larger of the two, because the bound is a
    // necessary condition and give must be an upper estimate.
    expect(weldGiveMm(0.8, 1.2)).toBe(1.2);
  });

  /*
   * REWRITTEN 2026-10-23 (socket adapter plan, regression contract): a socket
   * heel meeting a socket used to be a violation; it is now an adapter joint.
   *
   * MUTATION PROOFS, run:
   * - in `classifyWelds`, skip the weld when either port is a heel: fails
   *   with `expected [] to have a length of 1` (the adapter is not listed).
   * - socket pairs filed as violations again: fails with `expected [ { weld:
   *   +0, …(2) } ] to deeply equal []`.
   */
  it('is checked for polarity: a socket heel meeting a socket is an adapter joint', () => {
    expect(SW.ends.start).toBe('socket');
    const weldOnto = (partId: string): Graph => ({
      pieces: [
        { pieceId: 'sw', partId: SW.id },
        { pieceId: 'x', partId },
      ],
      welds: [{ a: { pieceId: 'x', port: 1 }, b: { pieceId: 'sw', port: 0 } }],
    });
    // C2 is two sockets: its far end against the socket heel needs a male-male adapter.
    const { violations, adapters } = classifyWelds(weldOnto('C2'), resolve, ports);
    expect(violations).toEqual([]);
    expect(adapters).toHaveLength(1);
    expect(adapters[0]!.between).toEqual(['C2', SW.id]);
    // A's far end is a peg, which is what a socket heel takes.
    expect(findWeldPolarityViolations(weldOnto('A'), resolve, ports)).toEqual([]);
  });

  /*
   * Unchanged from T8: the heel is a real place on the table, so another
   * piece cannot be there.
   */
  it('still occupies a position, so it can still collide', () => {
    const g: Graph = {
      pieces: [{ pieceId: 's', partId: SW.id }],
      welds: [],
    };
    const place = placeAll(g, ports);
    const heelAt = portFrame(place, ports, g.pieces[0]!, 0);
    expect(heelAt.pos).toBeDefined();
    // Distinct from both road ends: three real, separate places.
    const road = portFrame(place, ports, g.pieces[0]!, 1);
    const diverge = portFrame(place, ports, g.pieces[0]!, 2);
    expect(heelAt.pos).not.toEqual(road.pos);
    expect(heelAt.pos).not.toEqual(diverge.pos);
    expect(road.pos).not.toEqual(diverge.pos);
  });
});

describe('a branching layout', () => {
  /*
   * The shape a chain cannot hold: a switch with BOTH roads rejoining, so
   * there are two independent loops through one piece.
   *
   *        .--- 4xE (diverging) ---.
   *   switch                        join
   *        '--- A1 + 3xE ----------'
   *
   * Cycle rank is what proves the branch is real: a chain of n pieces can
   * only ever reach rank 1.
   */
  it('a switch with both roads used gives a graph a chain cannot express', () => {
    const pieces: Piece[] = [
      { pieceId: 'sw', partId: SW.id },
      ...Array.from({ length: 4 }, (_, i) => ({
        pieceId: `d${i}`,
        partId: 'E',
        turn: 'left' as const,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        pieceId: `t${i}`,
        partId: 'E',
        turn: 'left' as const,
      })),
    ];
    const welds = [
      // diverging road out of port 2, then four curves
      { a: { pieceId: 'sw', port: 2 }, b: { pieceId: 'd0', port: 0 } },
      { a: { pieceId: 'd0', port: 1 }, b: { pieceId: 'd1', port: 0 } },
      { a: { pieceId: 'd1', port: 1 }, b: { pieceId: 'd2', port: 0 } },
      { a: { pieceId: 'd2', port: 1 }, b: { pieceId: 'd3', port: 0 } },
      // straight road out of port 1, then four curves
      { a: { pieceId: 'sw', port: 1 }, b: { pieceId: 't0', port: 0 } },
      { a: { pieceId: 't0', port: 1 }, b: { pieceId: 't1', port: 0 } },
      { a: { pieceId: 't1', port: 1 }, b: { pieceId: 't2', port: 0 } },
      { a: { pieceId: 't2', port: 1 }, b: { pieceId: 't3', port: 0 } },
      // and the two roads meet
      { a: { pieceId: 'd3', port: 1 }, b: { pieceId: 't3', port: 1 } },
    ];
    const g: Graph = { pieces, welds };
    const f = spanningForest(g);

    // 9 welds, 9 pieces, 1 component: rank = 9 - 9 + 1 = 1.
    expect(f.roots).toHaveLength(1);
    expect(f.closing).toHaveLength(welds.length - pieces.length + f.roots.length);
    expect(f.closing).toHaveLength(1);

    // Every piece placed, nothing orphaned by the branch.
    const place = placeAll(g, ports);
    expect(place.frames.size).toBe(pieces.length);
    // And it has a residual to report, which is the whole point.
    expect(residuals(g, ports, place)).toHaveLength(1);
  });

  it('the heel is where the two roads actually diverge', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'sw', partId: SW.id },
        { pieceId: 'straightOn', partId: 'A2' },
        { pieceId: 'branch', partId: 'A2' },
      ],
      welds: [
        { a: { pieceId: 'sw', port: 1 }, b: { pieceId: 'straightOn', port: 0 } },
        { a: { pieceId: 'sw', port: 2 }, b: { pieceId: 'branch', port: 0 } },
      ],
    };
    const place = placeAll(g, ports);
    expect(place.forest.closing).toHaveLength(0);
    const a = portFrame(place, ports, g.pieces[1]!, 1);
    const b = portFrame(place, ports, g.pieces[2]!, 1);
    // Two pieces fed by ONE piece, ending in different places and headings.
    expect(a.pos).not.toEqual(b.pos);
    expect(a.heading).not.toBe(b.heading);
  });
});

describe('the chain engine refuses a switch instead of guessing', () => {
  /*
   * Widening PartKind opened a silent path: pose.ts tests for 'straight' and
   * treats everything else as a curve, and a SwitchPart carries arcSteps and
   * an inner radius, so a switch would have been walked as its diverging road
   * with no error raised anywhere.
   */
  it('throws, naming the part', () => {
    expect(() => displacement(SW, 0)).toThrowError(/switch/);
  });
});
