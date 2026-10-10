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
import { placeAll, portFrame, residuals, closesExactly } from '../src/graph/frames.js';
import {
  portsOf,
  weldGiveMm,
  weldHasPolarity,
  type Graph,
  type Piece,
  type Port,
} from '../src/graph/model.js';
import { displacement } from '../src/geom/pose.js';
import type { Part, SwitchPart } from '../src/parts/schema.js';

const base = makeResolver(BUILT_IN);
const A1 = base('A1'); // 108mm straight
const E = base('E');

/* A switch whose straight road is one A1 and whose diverging road is one E. */
const SW: SwitchPart = {
  id: 'TEST-SWITCH',
  brand: 'BRIO',
  kind: 'switch',
  name: 'Test switch',
  throughLengthMm: 108,
  arcSteps: E.kind === 'curve' ? E.arcSteps : 2,
  innerRadiusMm: E.kind === 'curve' ? E.innerRadiusMm : 182,
  dimensions: A1.dimensions,
  slop: A1.slop,
  ends: A1.ends,
  heightMm: 0,
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

describe('T8: the heel gets all three treatments', () => {
  const heel = portsOf(SW)[0]!;
  const end = portsOf(SW)[1]!;

  it('donates no give', () => {
    expect(weldGiveMm(heel, end, 0.8, 0.8)).toBe(0);
    // An ordinary pair still does, and takes the MAX because the bound is a
    // necessary condition and give must be an upper estimate.
    expect(weldGiveMm(end, end, 0.8, 1.2)).toBe(1.2);
  });

  it('is exempt from polarity', () => {
    expect(weldHasPolarity(heel, end)).toBe(false);
    expect(weldHasPolarity(end, end)).toBe(true);
  });

  /*
   * The third treatment: still counted in the coincident-vertex check. The
   * heel is a real place on the table, so another piece cannot be there,
   * even though it donates nothing and has no polarity. A heel that was
   * simply excluded from everything would let a layout stack track on it.
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
