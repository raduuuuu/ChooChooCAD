/**
 * THE ELEVATED STATION, READ OFF THE OWNER'S PHOTOS (2026-11-06), AND ITS
 * CURVED ROOF.
 *
 * Value: protects=the station's base on the floor beside the deck, the open
 * side of its deck, raised track joining both ends under the roof's high
 * eave, the roof colliding stretch by stretch at the levels it is at, the
 * canopy's seed checks, and the roof drawn to its measured heights with its
 * seams
 * Value: fails_when=the base or building moves to the wrong side, the roof
 * collides as one box (and stops the neighbour's road), a bad section loads,
 * or the drawing loses its lip or seams
 * Value: why_new=the station was round-number guesses; the canopy shape is new
 * Value: seam=none (pure engine)
 * Value: no_claim=the measured figures themselves, which are the photos'
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, decorBoxesOf, makeResolver } from '../data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import type { DecorCanopy } from '../src/parts/schema.js';
import { buildScene } from '../src/view3d/mesh.js';

const RISE = 61;
const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;
const at = (x: number, y: number, heading: number, level = 0): Frame => {
  const pos = add(fromInt(x), scale(zetaPow(4), y)) as Cyc;
  return level === 0 ? { pos, heading } : { pos, heading, level };
};
const scene = (items: readonly (readonly [string, string, Frame])[]): Graph => ({
  pieces: items.map(([pieceId, partId]) => ({ pieceId, partId, turn: 'left' as const })),
  welds: [],
  anchors: new Map(items.map(([pieceId, , frame]) => [pieceId, frame])),
});
const clashes = (g: Graph): string[] => {
  const placement = placeAll(g, ports);
  const r = renderGraph(g, ports, resolve, placement);
  return findPlankOverlaps(g, [...r.segments, ...r.bodies], half, connectorSites(g, ports, placement)).map((o) => [o.a, o.b].sort().join(' '));
};

// The station at the origin facing +x: its deck from (0,0) to (144,0), its building on the right (y < 0).
const ST = ['st', 'ST', at(0, 0, 0)] as const;

describe('the elevated station on the floor and one level up', () => {
  it('floor track cannot cross its base; floor track clear of the deck runs beside it', () => {
    expect(clashes(scene([ST, ['floor', 'A', at(0, -60, 0)]]))).toEqual(['floor st']);
    // The deck's frame hangs 20 past the base on the open side: a floor road 45 out clears it.
    expect(clashes(scene([ST, ['floor', 'A', at(0, 45, 0)]]))).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the canopy colliding as one box from its lowest
   * underside to its top (its draw box made solid): `expected [ 'a st', 'b
   * st' ] to deeply equal []`; the next block's count fails too.
   */
  it('raised track joins both ends of its deck, under the roof’s high eave', () => {
    expect(clashes(scene([ST, ['a', 'A', at(-144, 0, 0, 1)], ['b', 'A', at(144, 0, 0, 1)]]))).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the base's two ends solid again: `expected [ 'n st'
   * ] to deeply equal []`.
   */
  it('a ramp joins its deck directly, over the base’s end (owner, 2026-11-06)', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'n', partId: 'N', turn: 'left' }, { pieceId: 'st', partId: 'ST', turn: 'left' }],
      welds: [{ a: { pieceId: 'n', port: 1 }, b: { pieceId: 'st', port: 0 } }],
    };
    expect(clashes(g)).toEqual([]);
  });

  it('raised track cannot pass through its building, which reaches 129 across', () => {
    expect(clashes(scene([ST, ['up', 'D', at(72, -200, 4, 1)]]))).toEqual(['st up']);
    // The roof overhangs each end of the deck by 30; past that, raised track is free.
    expect(clashes(scene([ST, ['up', 'D', at(-60, -200, 4, 1)]]))).toEqual([]);
  });
});

describe('a curved roof collides where it is', () => {
  const roof = resolve('ST').decorBody!.filter((b) => b.role === 'roof');

  /*
   * MUTATION PROOF, run: the lip left out of the first stretch's underside:
   * `expected 176 to be 158 // Object.is equality`.
   */
  it('stretch by stretch: high over the deck at levels 2 and 3, down into level 1 only near its far eave', () => {
    // Two sections, one either side of the lift shaft, each ten stretches.
    const solid = roof.filter((b) => b.solid);
    expect(solid).toHaveLength(20);
    expect(solid[0]!.bottomMm).toBe(183 - 7 - 18);
    const levels = [[2, 3], [2, 3], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [1, 2], [1, 1]];
    expect(solid.map((b) => b.levels)).toEqual([...levels, ...levels]);
    // One more box each draws it, and never collides.
    expect(roof.filter((b) => !b.solid).map((b) => [b.draw, b.bottomMm, b.topMm])).toEqual([[true, 90, 184.5], [true, 90, 184.5]]);
  });

  /*
   * MUTATION PROOFS, run:
   * - the roof whole again (one canopy 204 long over the shaft): `expected [
   *   [ -30, 174 ] ] to deeply equal [ [ -30, 39.5 ], [ 104.5, 174 ] ]`.
   * - the car back down at 44 to 104: `expected [ 44, 104 ] to deeply equal
   *   [ 63, 147 ]`.
   */
  it('leaves the lift shaft open between its two sections, the car up at the platform (owner, 2026-11-07)', () => {
    const spans = roof.filter((b) => !b.solid).map((b) => [b.atMm[0] - b.lengthMm / 2, b.atMm[0] + b.lengthMm / 2]);
    expect(spans).toEqual([[-30, 39.5], [104.5, 174]]);
    const car = resolve('ST').decorBody!.find((b) => b.noun === 'lift')!;
    expect([car.bottomMm, car.topMm]).toEqual([63, 147]);
    expect([car.atMm[0] - car.lengthMm / 2, car.atMm[0] + car.lengthMm / 2]).toEqual([51.5, 92.5]);
  });

  const canopy = (over: Partial<DecorCanopy>): DecorCanopy => ({
    kind: 'canopy', alongMm: 0, lengthMm: 100, sectionMm: [[0, 100], [50, 90]], thickMm: 5, lipMm: 0, ...over,
  });

  /*
   * MUTATION PROOF, run: the one-way check dropped: `expected [Function] to
   * throw an error`.
   */
  it('refuses a section that doubles back, a single point, no thickness, or seams off the roof', () => {
    expect(() => decorBoxesOf('t', [canopy({})], RISE)).not.toThrow();
    expect(() => decorBoxesOf('t', [canopy({ sectionMm: [[0, 100], [50, 90], [20, 80]] })], RISE)).toThrow('one way across');
    expect(() => decorBoxesOf('t', [canopy({ sectionMm: [[0, 100]] })], RISE)).toThrow('two points');
    expect(() => decorBoxesOf('t', [canopy({ thickMm: 0 })], RISE)).toThrow('thickness');
    expect(() => decorBoxesOf('t', [canopy({ seamsMm: [60] })], RISE)).toThrow('seams');
  });
});

describe('the roof in 3D', () => {
  const alone = () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'ST', turn: 'left' }], welds: [], anchors: new Map([['p', at(0, 0, 0)]]) };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    return buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('ST'), riseMm: RISE, plankMm: 12 });
  };

  /*
   * MUTATION PROOFS, run:
   * - the seams not drawn: `expected +0 to be 40 // Object.is equality`.
   * - the lip not drawn: `expected 176 to be close to 158, received
   *   difference is 18, but expected 5e-7`.
   */
  it('stands as measured: its top at 184.5, its lip down to 158 over the deck, its four seams as detail', () => {
    const s = alone();
    expect(s.bounds.max[2]).toBeCloseTo(201, 6);
    const d = s.structures.detail;
    expect((d[0]?.positions.length ?? 0) / 6).toBe(40);
    const p = s.structures.solid.positions;
    let lip = Infinity;
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1]! + 16) < 1e-6) lip = Math.min(lip, p[i + 2]!);
    expect(lip).toBeCloseTo(158, 6);
  });
});
