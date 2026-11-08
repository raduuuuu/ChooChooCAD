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
import { BUILT_IN, decorBoxesOf, makeResolver, PAINT_TOKENS } from '../data/library.js';
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
    // Two sections, one either side of the lift shaft, each ten stretches; over the shaft, the front three.
    const solid = roof.filter((b) => b.solid && b.shape === undefined && b.noun === 'roof' && b.role === 'roof');
    expect(solid).toHaveLength(23);
    expect(solid[0]!.bottomMm).toBe(183 - 7 - 18);
    const levels = [[2, 3], [2, 3], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [2, 2], [1, 2], [1, 1]];
    expect(solid.map((b) => b.levels)).toEqual([...levels, ...levels, ...levels.slice(0, 3)]);
    // One more box each draws it, and never collides.
    expect(roof.filter((b) => !b.solid).map((b) => [b.draw, b.bottomMm, b.topMm])).toEqual([[true, 90, 184.5], [true, 90, 184.5], [true, 158, 184.5]]);
  });

  /*
   * MUTATION PROOFS, run:
   * - the front strip over the shaft running the whole section (open at
   *   the back no more): `expected [ -16, -129 ] to deeply equal [ -16, -63 ]`.
   * - the car back down at 44 to 104: `expected [ 44, 104 ] to deeply equal
   *   [ 63, 147 ]`.
   */
  it('leaves the lift shaft open at the back only, the car up at the platform (owner, 2026-11-07)', () => {
    const drawn = roof.filter((b) => !b.solid);
    const spans = drawn.map((b) => [b.atMm[0] - b.lengthMm / 2, b.atMm[0] + b.lengthMm / 2]);
    expect(spans).toEqual([[-30, 39.5], [104.5, 174], [39.5, 104.5]]);
    // Over the shaft, the roof runs from its front edge back to the clock, no further.
    const front = drawn[2]!;
    expect([front.atMm[1] + front.widthMm / 2, front.atMm[1] - front.widthMm / 2]).toEqual([-16, -63]);
    // The car: an open frame over its floor, together filling what the solid car did.
    const car = resolve('ST').decorBody!.filter((b) => b.noun === 'lift');
    expect([Math.min(...car.map((b) => b.bottomMm)), Math.max(...car.map((b) => b.topMm))]).toEqual([63, 147]);
    expect([Math.min(...car.map((b) => b.atMm[0] - b.lengthMm / 2)), Math.max(...car.map((b) => b.atMm[0] + b.lengthMm / 2))]).toEqual([51.5, 92.5]);
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

describe('the arched panel over the lift shaft (owner, 2026-11-07)', () => {
  /*
   * MUTATION PROOF, run: `acrossMm` ignored (the box back under the road):
   * `expected [ 72, +0, 132, 183, false ] to deeply equal [ 72, -107, 132,
   * 183, false ]`; the 3D spec fails too.
   */
  it('stands at the back of the shaft, from its springing to its flat top, drawn only', () => {
    const panel = resolve('ST').decorBody!.find((b) => b.shape?.kind === 'arch')!;
    expect([panel.atMm[0], panel.atMm[1], panel.bottomMm, panel.topMm, panel.solid]).toEqual([72, -107, 132, 183, false]);
  });

  /*
   * MUTATION PROOF, run: the top-over-crown check dropped: `expected
   * [Function] to throw an error`.
   */
  it('refuses a panel whose top is not over its crown', () => {
    const arch = { kind: 'arch', fromMm: 0, toMm: 60, baseMm: 100, riseMm: 20, depthMm: 0, widthMm: 6 } as const;
    expect(() => decorBoxesOf('t', [{ ...arch, fillToMm: 130 }], RISE)).not.toThrow();
    expect(() => decorBoxesOf('t', [{ ...arch, fillToMm: 115 }], RISE)).toThrow('over its crown');
  });

  /*
   * MUTATION PROOF, run: the panel drawn as a band again (`fill` always
   * null): `expected false to be true // Object.is equality`.
   */
  it('in 3D: open under its arch, crown at 154, filled to a flat top at 183', () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'ST', turn: 'left' }], welds: [], anchors: new Map([['p', at(0, 0, 0)]]) };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const p = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('ST'), riseMm: RISE, plankMm: 12 }).structures.solid.positions;
    // Points on the panel's back face, 3 behind its middle line, over the middle of the shaft.
    const onPanel: number[] = [];
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1]! + 110) < 1e-6 && Math.abs(p[i]! - 72) < 2) onPanel.push(p[i + 2]!);
    expect(Math.min(...onPanel)).toBeCloseTo(154, 0);
    expect(onPanel.some((z) => Math.abs(z - 183) < 1e-6)).toBe(true);
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
   * - the panel over the shaft left out: `expected Infinity to be close to
   *   142, received difference is Infinity, but expected 5e-7`.
   */
  it('stands as measured: its top at 184.5, its lip down to 158 over the deck, its four seams as detail; the panel over the shaft to 142', () => {
    const s = alone();
    expect(s.bounds.max[2]).toBeCloseTo(201, 6);
    const d = s.structures.detail;
    // The roof's 40 seam lines, and the crank's hub and knob: two rings of 12 on each face.
    expect((d[0]?.positions.length ?? 0) / 6).toBe(40 + 2 * 12 * 2);
    const p = s.structures.solid.positions;
    let lip = Infinity;
    // Along the deck clear of the shaft, where the panel between the posts hangs lower.
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1]! + 16) < 1e-6 && p[i]! < 30) lip = Math.min(lip, p[i + 2]!);
    expect(lip).toBeCloseTo(158, 6);
    let panel = Infinity;
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1]! + 16) < 1e-6 && p[i]! > 50 && p[i]! < 94) panel = Math.min(panel, p[i + 2]!);
    expect(panel).toBeCloseTo(142, 6);
  });
});

describe('the station’s paint in 3D (paint plan 2026-11-07: CEO R1-R3, design D6, eng X1/Q1)', () => {
  const sceneOf = (pieces: readonly (readonly [string, string, Frame, ('left' | 'right')?])[], opts: { buildMode?: boolean; highlight?: string } = {}) => {
    const g: Graph = {
      pieces: pieces.map(([pieceId, partId, , turn]) => ({ pieceId, partId, turn: turn ?? 'left' })),
      welds: [],
      anchors: new Map(pieces.map(([pieceId, , frame]) => [pieceId, frame])),
    };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const partOf = (id: string) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId);
    return buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf, riseMm: RISE, plankMm: 12, ...opts });
  };
  /** The paint token of every solid vertex inside a box (x, y, z ranges), counted. */
  const paintIn = (s: ReturnType<typeof sceneOf>, box: readonly [number, number, number, number, number, number]) => {
    const { solid, solidPaint, paints } = s.structures;
    const out = new Map<string, number>();
    for (let v = 0; v < solid.positions.length / 3; v++) {
      const [x, y, z] = [solid.positions[v * 3]!, solid.positions[v * 3 + 1]!, solid.positions[v * 3 + 2]!];
      if (x < box[0] || x > box[1] || y < box[2] || y > box[3] || z < box[4] || z > box[5]) continue;
      const t = paints[solidPaint[v]!]!;
      out.set(t, (out.get(t) ?? 0) + 1);
    }
    return [...out.keys()].sort();
  };
  const STATION = ['st', 'ST', at(0, 0, 0)] as const;

  /*
   * MUTATION PROOF, run: the paint dropped from the boxes (library.ts's
   * `noun` spread without `paint`): `expected [ '' ] to deeply equal [
   * '--paint-roof' ]`.
   */
  it('each part wears its paint: roof by the Pen, lift and base by the box path', () => {
    const s = sceneOf([STATION]);
    // The roof's end over the deck's edge side (a section has vertices only at its two ends).
    expect(paintIn(s, [-31, -29, -60, -20, 170, 190])).toEqual(['--paint-roof']);
    // The lift car between the posts (the posts' own vertices are at 12 and 187 only).
    expect(paintIn(s, [51, 93, -103.6, -63.4, 60, 150])).toEqual(['--paint-red']);
    // The base: beech underneath, dark only on its printed top (the skin's top face, 12.5 up). With the
    // skin left beech: `expected [ '--track-fill' ] to deeply equal [ '--paint-base' ]`.
    expect(paintIn(s, [-30, 175, -126, 2, -0.5, 0.5])).toEqual(['--track-fill']);
    expect(paintIn(s, [-30, 175, -126, 2, 12.4, 12.6])).toEqual(['--paint-base']);
  });

  it('every built-in paint is in the palette, fills and lines', () => {
    expect([...PAINT_TOKENS].sort()).toEqual(['--ink', '--ink-soft', '--paint-base', '--paint-grey', '--paint-metro', '--paint-orange', '--paint-red', '--paint-roof', '--paint-yellow', '--paper', '--track-fill']);
  });

  /*
   * MUTATION PROOF, run: the paint set only when a body has one (`if
   * (paint) fill = ...`): `expected [ '--paint-roof' ] to deeply equal [ ''
   * ]`: the riser drawn after the station took its last paint.
   */
  it('an unpainted structure drawn after the station keeps the house fill', () => {
    const s = sceneOf([STATION, ['rs', 'RS', at(400, 0, 0)]]);
    expect(paintIn(s, [395, 470, -40, 40, -1, 200])).toEqual(['']);
  });

  it('a flipped station keeps each part’s paint, on the other side', () => {
    const s = sceneOf([['st', 'ST', at(0, 0, 0), 'right']]);
    expect(paintIn(s, [51, 93, 63.4, 103.6, 60, 150])).toEqual(['--paint-red']);
    expect(paintIn(s, [-30, 175, -2, 126, -0.5, 0.5])).toEqual(['--track-fill']);
    expect(paintIn(s, [-30, 175, -2, 126, 12.4, 12.6])).toEqual(['--paint-base']);
  });

  /*
   * MUTATION PROOF, run: build mode's placed piece keeping its paint
   * (`placedInBuild` ignored): `expected [ '--paint-red' ] to deeply equal [
   * '' ]`.
   */
  it('in build mode a placed station is the house fill, the next one keeps its paint', () => {
    const placed = sceneOf([STATION, ['other', 'A', at(500, 0, 0)]], { buildMode: true, highlight: 'other' });
    expect(paintIn(placed, [51, 93, -103.6, -63.4, 60, 150])).toEqual(['']);
    const next = sceneOf([STATION], { buildMode: true, highlight: 'st' });
    expect(paintIn(next, [51, 93, -103.6, -63.4, 60, 150])).toEqual(['--paint-red']);
  });

  /*
   * MUTATION PROOF, run: a box's outline straight into the body edges again
   * (`edgeLoop` pushing to `bodyEdges`): `expected 600 to be +0 // Object.is
   * equality`: the next station's boxes were outlined as placed wood.
   */
  it('as the next piece, its boxes are outlined with its shapes, base included (eng X1)', () => {
    const s = sceneOf([STATION], { buildMode: true, highlight: 'st' });
    const p = s.nextBuilding!.positions;
    let baseEdges = 0;
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 2]! - 12) < 1e-6 && p[i + 1]! < -100) baseEdges++;
    expect(baseEdges).toBeGreaterThan(0);
    expect(s.structures.edges.positions.length).toBe(0);
  });

  /*
   * MUTATION PROOF, run: every line drawn in the house line (`line` left 0):
   * `expected [ '' ] to deeply equal [ '--paper' ]`.
   */
  it('each paint’s outline is in its own line colour (design D6): paper on the base, ink on the roof', () => {
    const s = sceneOf([STATION]);
    const { edges, edgePaint, paints } = s.structures;
    const tokensWhere = (test: (x: number, y: number, z: number) => boolean) => {
      const out = new Set<string>();
      for (let v = 0; v < edges.positions.length / 3; v++) {
        if (test(edges.positions[v * 3]!, edges.positions[v * 3 + 1]!, edges.positions[v * 3 + 2]!)) out.add(paints[edgePaint[v]!]!);
      }
      return [...out].sort();
    };
    // The base's printed top's edge, 12.5 up, beyond the posts; the beech under it in its own soft ink.
    expect(tokensWhere((_x, y, z) => Math.abs(z - 12.5) < 1e-6 && y < -120)).toEqual(['--paper']);
    expect(tokensWhere((_x, y, z) => Math.abs(z) < 1e-6 && y < -120)).toEqual(['--ink-soft']);
    // The roof's end section lines, over the deck's edge side.
    expect(tokensWhere((x, y, z) => x < -29 && z > 175 && y < -20 && y > -60)).toEqual(['--ink']);
  });

  describe('the crank, the lift car and the base as the photos show them (owner, 2026-11-07)', () => {
    /*
     * MUTATION PROOF, run: the wheel's box solid: `expected [ [ true, true,
     * 'wheel', 31, …(3) ] ] to deeply equal [ [ false, true, 'wheel', 31,
     * …(3) ] ]`.
     */
    it('the crank is a wheel drawn only: 31 across round its hub at 171, 10 deep, never colliding', () => {
      const crank = resolve('ST').decorBody!.filter((b) => b.noun === 'crank');
      expect(crank.map((b) => [b.solid, b.draw, b.shape?.kind, b.lengthMm, b.widthMm, b.bottomMm, b.topMm])).toEqual([[false, true, 'wheel', 31, 10, 155.5, 186.5]]);
    });

    /*
     * MUTATION PROOF, run: every quad drawn as handed over (`out` never
     * turning one round): `expected 32 to be +0 // Object.is equality`: one
     * face showed its back and would be culled.
     */
    it('the wheel is round, every face turned outward so none is culled', () => {
      const { positions: p, indices } = sceneOf([STATION]).structures.solid;
      const v = (k: number) => [p[k * 3]!, p[k * 3 + 1]!, p[k * 3 + 2]!] as const;
      // The wheel's own vertices: on one of its faces, 111 +- 5 across, each on the rim or at the hub.
      const onWheel = (k: number) => {
        const [x, y, z] = v(k);
        const r = Math.hypot(x - 72, z - 171);
        // Float32 positions: a thousandth of a millimetre.
        return Math.abs(Math.abs(y + 111) - 5) < 1e-3 && (Math.abs(r - 15.5) < 1e-3 || r < 1e-3);
      };
      let triangles = 0, inward = 0;
      for (let t = 0; t < indices.length; t += 3) {
        const [a, b, c] = [v(indices[t]!), v(indices[t + 1]!), v(indices[t + 2]!)];
        if (![indices[t]!, indices[t + 1]!, indices[t + 2]!].every(onWheel)) continue;
        const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
        if (Math.hypot(...n) < 1e-9) continue; // the fan's spare half of each face quad
        triangles++;
        const m = [(a[0] + b[0] + c[0]) / 3 - 72, (a[1] + b[1] + c[1]) / 3 + 111, (a[2] + b[2] + c[2]) / 3 - 171];
        if (n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]! <= 0) inward++;
      }
      // The rim's 32 quads, and 32 slices on each face.
      expect(triangles).toBe(32 * 2 + 32 * 2);
      expect(inward).toBe(0);
    });

    /*
     * MUTATION PROOF, run: the car one solid block again: `expected [] to
     * deeply equal [ '--paint-red' ]`: a block has corners only at its
     * outside, none round an opening.
     */
    it('the lift car is an open frame: its opening has corners, where the posts meet its floor and its top bars', () => {
      const s = sceneOf([STATION]);
      // The opening in its back face runs from 54.5 to 89.5 along and from 71 to 144 up (the posts and bars 3 square).
      for (const x of [54.5, 89.5]) {
        for (const z of [71, 144]) expect(paintIn(s, [x - 0.01, x + 0.01, -105.1, -101.9, z - 0.01, z + 0.01])).toEqual(['--paint-red']);
      }
    });
  });
});
