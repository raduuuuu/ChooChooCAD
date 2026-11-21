/**
 * THE CARGO CRANE AND THE ACTION TUNNEL STATION (owner's photos 2026-11-08):
 * track with its own decoration that works like no standard part.
 *
 * Value: protects=the crane's two short tracks 50 apart and the station's
 * 288 straight, each joining a straight at every end without its decoration
 * in the way; the crane's legs keep floor track out; the station's posts
 * meet its domed roof without piercing it, and the roof arches both ways
 * Value: fails_when=a seed's ends, its base's reach, the dome's surface or
 * the posts' height drift
 * Value: why_new=neither piece, nor the dome, existed
 * Value: seam=the real library, `renderGraph`, `findPlankOverlaps`, `buildScene`
 * Value: no_claim=how close the figures are to the real pieces (read off
 * photos, unverified), and how they look (the side-by-side renders in the PR)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, decorBoxesOf, makeResolver } from '../data/library.js';
import { CLEARANCE } from '../data/rampSeeds.js';
import { originOf, originUrl } from '../data/origins.js';
import { ACTION_TUNNEL_STATION, DOUBLE_ARCH_BRIDGE, GSTAAD_STATION, LAUSANNE_STATION } from '../data/trackDecorSeeds.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import { domeBarrel, domeTop } from '../src/parts/dome.js';
import type { DecorDome, DecorPrism, DecorSlab, DecorTruss, Part } from '../src/parts/schema.js';
import { buildScene } from '../src/view3d/mesh.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;
const at = (x: number, y: number, heading: number): Frame => ({ pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc, heading });

/** A piece at the origin, others welded to its ends or anchored; the pairs that clash. */
function clashes(main: string, joined: readonly (readonly [string, number])[], anchored: readonly (readonly [string, string, Frame])[] = []): string[] {
  const pieces = [{ pieceId: 'p', partId: main, turn: 'left' as const }, ...joined.map(([id], k) => ({ pieceId: `j${k}`, partId: id, turn: 'left' as const })), ...anchored.map(([pieceId, partId]) => ({ pieceId, partId, turn: 'left' as const }))];
  const welds: Weld[] = joined.map(([, port], k) => ({ a: { pieceId: 'p', port }, b: { pieceId: `j${k}`, port: port % 2 === 0 ? 1 : 0 } }));
  const g: Graph = { pieces, welds, anchors: new Map([['p', at(0, 0, 0)], ...anchored.map(([pieceId, , frame]) => [pieceId, frame] as const)]) };
  const placement = placeAll(g, ports);
  const r = renderGraph(g, ports, resolve, placement);
  return findPlankOverlaps(g, [...r.segments, ...r.bodies], half, connectorSites(g, ports, placement)).map((o) => [o.a, o.b].sort().join(' '));
}

describe('the cargo crane', () => {
  it('carries two short straights side by side, 50 apart, both socket to peg', () => {
    const cc = resolve('CC');
    if (cc.kind !== 'multi-road') throw new Error('CC is a multi-road part');
    expect(cc.roads.map((r) => r.shape)).toEqual([{ kind: 'straight', lengthMm: 108 }, { kind: 'straight', lengthMm: 108 }]);
    expect(cc.ports.map((p) => [p.polarity, p.at.pos[0], p.at.pos[4]])).toEqual([['socket', 0, 0], ['peg', 108, 0], ['socket', 0, -50], ['peg', 108, -50]]);
  });

  /*
   * MUTATION PROOF, run: the tracks 30 apart: `expected [ 'j0 j2', 'j1 j3' ]
   * to deeply equal []`. (The base lies beside the tracks, so the straights
   * joined to them never reach it.)
   */
  it('a straight joins each of its four ends, the two side by side clear of each other', () => {
    expect(clashes('CC', [['A', 0], ['A', 1], ['A', 2], ['A', 3]])).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the gantry's beam not solid: `expected [] to deeply equal [ 'p up' ]`.
   */
  it('raised track cannot cross its gantry\'s beam', () => {
    // One level up, along the tracks, over the cargo half under the beam (112 to 146).
    expect(clashes('CC', [], [['up', 'A', { ...at(-20, 100, 0), level: 1 }]])).toEqual(['p up']);
  });
});

describe('the cargo crane\'s gantry (owner, 2026-11-08: "check the crane again")', () => {
  /*
   * MUTATION PROOF, run: the legs straight up (their tops where their feet
   * are): `expected 150.5 to be greater than 165.5`.
   */
  it('each leg leans in to the beam: its foot further out from the middle than its top', () => {
    const legs = (resolve('CC').decor ?? []).filter((d): d is DecorPrism => d.kind === 'prism' && d.noun === 'gantry');
    expect(legs).toHaveLength(4);
    const mean = (ys: number[]) => ys.reduce((a, b) => a + b, 0) / ys.length;
    const foot = (leg: DecorPrism) => mean(leg.sectionMm.filter(([, z]) => z === 0).map(([y]) => y));
    const top = (leg: DecorPrism) => mean(leg.sectionMm.filter(([, z]) => z > 0).map(([y]) => y));
    // The middle between the two legs' feet.
    const middle = mean(legs.map(foot));
    for (const leg of legs) expect(Math.abs(foot(leg) - middle)).toBeGreaterThan(Math.abs(top(leg) - middle) + 15);
  });

  /*
   * MUTATION PROOF, run: drawPrism keeping each face as wound, not turned
   * outward: `expected [ [ [ 20, -30, +0 ], …(2) ], …(1) ] to have a length
   * of +0 but got 2`.
   */
  it('a sloping prism is drawn closed, every face turned outward', () => {
    const prism: DecorPrism = { kind: 'prism', fromMm: 20, toMm: 60, sectionMm: [[-30, 0], [10, 0], [0, 50], [-20, 50]], noun: 'gantry', paint: { fill: '--paint-green', line: '--ink' } };
    const part = { ...ACTION_TUNNEL_STATION, id: 'PX', decor: [prism], decorBody: decorBoxesOf('Part PX', [prism], CLEARANCE.riseMm) } as Part;
    const own = makeResolver([...BUILT_IN, part]);
    const ownPorts = (piece: Piece): readonly Port[] => portsOf(own(piece.partId), piece.turn);
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'PX', turn: 'left' }], welds: [], anchors: new Map([['p', at(0, 0, 0)]]) };
    const r = renderGraph(g, ownPorts, own, placeAll(g, ownPorts));
    const { solid, solidPaint, paints } = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => part, riseMm: CLEARANCE.riseMm, plankMm: 12 }).structures;
    const p = (v: number) => [solid.positions[v * 3]!, solid.positions[v * 3 + 1]!, solid.positions[v * 3 + 2]!] as const;
    type P = readonly [number, number, number];
    const tris: [P, P, P][] = [];
    for (let t = 0; t < solid.indices.length; t += 3) {
      const vs = [solid.indices[t]!, solid.indices[t + 1]!, solid.indices[t + 2]!];
      if (vs.every((v) => paints[solidPaint[v]!] === '--paint-green')) tris.push([p(vs[0]!), p(vs[1]!), p(vs[2]!)]);
    }
    expect(tris.length).toBeGreaterThan(0);
    const all = tris.flat();
    const centre = [0, 1, 2].map((k) => all.reduce((s, q) => s + q[k]!, 0) / all.length);
    // A face turned in: its normal, by its winding, pointing back toward the solid's middle.
    const inward = tris.filter(([a, b, c]) => {
      const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      return n[0]! * (a[0] - centre[0]!) + n[1]! * (a[1] - centre[1]!) + n[2]! * (a[2] - centre[2]!) < -1e-6;
    });
    expect(inward).toHaveLength(0);
  });
});

describe('the action tunnel station', () => {
  it('is a 288 straight, joining a straight at both ends clear of its base', () => {
    expect([ACTION_TUNNEL_STATION.lengthMm, ACTION_TUNNEL_STATION.ends]).toEqual([288, { start: 'socket', end: 'peg' }]);
    expect(clashes('AT', [['A', 0], ['A', 1]])).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the posts to the roof's underside, not 2 under it: `expected 0.16619305042232213 to be greater than or equal to 2`.
   */
  it('its posts meet the domed roof without piercing it', () => {
    const roof = ACTION_TUNNEL_STATION.decor!.find((d): d is DecorDome => d.kind === 'dome')!;
    const posts = ACTION_TUNNEL_STATION.decor!.filter((d): d is DecorSlab => d.kind === 'slab' && d.noun === 'post');
    expect(posts).toHaveLength(4);
    for (const p of posts) {
      const under = domeTop(roof, p.atMm[0] - 144, p.atMm[1]) - roof.thickMm;
      expect(under - p.topMm).toBeGreaterThanOrEqual(2);
      expect(under - p.topMm).toBeLessThan(3);
    }
  });

  /*
   * MUTATION PROOFS, run: each end's hood flat across (`acrossRiseMm: 0`):
   * `expected 112.66679382324219 to be greater than 122.66679382324219`;
   * the roof's two barrels added, not crossed: `expected 198.72000122070312
   * to be greater than 230`.
   */
  it('its roof is a groin vault: the arch rises between the posts, the hoods arch across, the arch stands full height at its sides', () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'AT', turn: 'left' }], welds: [], anchors: new Map([['p', at(0, 0, 0)]]) };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('AT'), riseMm: CLEARANCE.riseMm, plankMm: 12 });
    const { solid, solidPaint, paints } = s.structures;
    const p = solid.positions;
    const roof: [number, number, number][] = [];
    for (let v = 0; v < p.length / 3; v++) if (paints[solidPaint[v]!] === '--paint-orange') roof.push([p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!]);
    const topNear = (x: number, y: number) => Math.max(...roof.filter(([a, b]) => Math.abs(a - x) < 12 && Math.abs(b - y) < 12).map(([, , z]) => z));
    // Along the middle line: higher in the middle than over the hoods at the ends.
    expect(topNear(144, 0)).toBeGreaterThan(topNear(80, 0) + 10);
    // At an end, the hood: higher on the middle line than out at its sides.
    expect(topNear(80, 0)).toBeGreaterThan(topNear(80, 45) + 10);
    // Out at the sides in the middle, the arch's ends (the wings): as high as the crown, within 4.
    expect(topNear(144, 66)).toBeGreaterThan(topNear(144, 0) - 4);
  });

  /*
   * MUTATION PROOF, run: every window kept, none left out at the creases:
   * `expected [ [ -36, -18, 11, 11 ], …(7) ] to deeply equal []`.
   */
  it('each of its roof windows lies on one barrel, none across the X where they meet', () => {
    const windows = ACTION_TUNNEL_STATION.decor!.find((d): d is DecorDome => d.kind === 'dome' && d.patches !== undefined)!;
    const across = windows.patches!.filter(([a, c, l, w]) => new Set([-1, 1].flatMap((i) => [-1, 1].map((j) => domeBarrel(windows, a + (i * l) / 2, c + (j * w) / 2)))).size > 1);
    expect(across).toEqual([]);
    expect(windows.patches!.length).toBeGreaterThan(20);
  });
});

describe('the double-arch bridge', () => {
  /*
   * MUTATION PROOF, run: its length 216: `expected [ Array(2) ] to deeply
   * equal [ Array(2) ]`.
   */
  it('is a 240 straight, joining a straight at both ends clear of its sides', () => {
    expect([DOUBLE_ARCH_BRIDGE.lengthMm, DOUBLE_ARCH_BRIDGE.ends]).toEqual([240, { start: 'socket', end: 'peg' }]);
    expect(DOUBLE_ARCH_BRIDGE.deck).toBeUndefined();
    expect(clashes('DA', [['A', 0], ['A', 1]])).toEqual([]);
  });

  /*
   * MUTATION PROOFS, run: the cross bars 60 to 66 up: `expected 48 to be
   * greater than 55`; the sides 18 either side of the road: `expected -4 to
   * be greater than 0`.
   */
  it('a train passes under its cross bars and between its sides', () => {
    const slabs = DOUBLE_ARCH_BRIDGE.decor!.filter((d): d is DecorSlab => d.kind === 'slab');
    const bars = slabs.filter((s) => s.noun === 'cross bar');
    expect(bars).toHaveLength(2);
    for (const b of bars) expect(b.bottomMm - DOUBLE_ARCH_BRIDGE.plankThicknessMm).toBeGreaterThan(CLEARANCE.trainMm);
    for (const s of slabs.filter((x) => x.noun === 'side')) {
      expect(Math.abs(s.atMm[1]) - s.widthMm / 2 - DOUBLE_ARCH_BRIDGE.plankWidthMm / 2).toBeGreaterThan(0);
    }
  });
});

describe('the double-arch bridge\'s arches (issue #231)', () => {
  const trusses = DOUBLE_ARCH_BRIDGE.decor!.filter((d): d is DecorTruss => d.kind === 'truss');

  /*
   * MUTATION PROOF, run (2026-11-09): the half arches left out (as the issue
   * drew it): `expected [ [ 15, 158 ], [ 85, 228 ] ] to deeply equal [ [ 15, 158 ], [ 85, 228 ], …(2) ]`.
   * And run (2026-11-10): cut at the band's ends again, their crowns standing
   * past the big arches as horns: `expected [ [ 15, 158 ], [ 85, 228 ], …(2) ] to deeply equal [ [ 15, 158 ], [ 85, 228 ], …(2) ]`
   * (and the plate test in decorated.test.ts: `expected 16 to be +0`).
   */
  it('draws two whole arches and a half arch at each end, cut where it meets its big arch', () => {
    const drawn = trusses.map((t) => [t.drawnFromMm ?? t.fromMm, t.drawnToMm ?? t.toMm]);
    expect(drawn).toEqual([[15, 158], [85, 228], [50.75, 86.5], [156.5, 192.25]]);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): the cross bars drawn square again (their
   * slabs drawn): `expected [ true, true ] to deeply equal [ false, false ]`.
   */
  it('draws its cross bars round, over the boxes that collide', () => {
    const decor = DOUBLE_ARCH_BRIDGE.decor!;
    const bars = decor.filter((d): d is DecorSlab => d.kind === 'slab' && d.noun === 'cross bar');
    expect(bars.map((b) => b.drawn !== false)).toEqual([false, false]);
    const round = decor.filter((d) => d.kind === 'wheel' && d.noun === 'cross bar');
    expect(round.map((w) => w.kind === 'wheel' && [w.atMm[0], w.centreMm, w.diameterMm])).toEqual([[86.5, 121, 6], [156.5, 121, 6]]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the arches drawing only (no solid ribs
   * in library.ts): `expected [] to deeply equal [ 'over p' ]`.
   */
  it('track one level up across it runs into its arches, even near an end; three levels up clears them', () => {
    // The big arches stand upright from the band's ends, 15 and 228 along; level 3 starts at 183.
    expect(clashes('DA', [], [['over', 'A', { ...at(120, -72, 4), level: 1 }]])).toEqual(['over p']);
    expect(clashes('DA', [], [['end', 'A', { ...at(6, -72, 4), level: 1 }]])).toEqual(['end p']);
    expect(clashes('DA', [], [['high', 'A', { ...at(120, -72, 4), level: 3 }]])).toEqual([]);
  });
});

/**
 * THE TWO PRINTED STATIONS (2026-11-21): a long straight with a station on a
 * base beside it, read off the printable design's mesh.
 *
 * Value: protects=each is a 216 straight a train can pass (nothing above the
 * road's top closer than 24 to its middle), joined at both ends clear of its
 * own base; floor track cannot lie on the base, the far side of the road
 * stays free, raised track cannot cross the building; each links to its own
 * model page
 * Value: fails_when=a shape drifts over the road, the base or the walls stop
 * colliding, the station swaps sides, or a model number is wrong
 * Value: why_new=neither piece existed
 * Value: seam=the real library, `renderGraph`, `findPlankOverlaps`, `originOf`
 * Value: no_claim=how close the figures are to a printed one (unverified),
 * and how they look (the renders in the pull request)
 */
describe('the two printed stations', () => {
  const stations = [GSTAAD_STATION, LAUSANNE_STATION] as const;

  it('each is a 216 straight; Gstaad socket to peg, Lausanne a socket at both ends', () => {
    expect(stations.map((s) => [s.id, s.lengthMm, s.ends.start, s.ends.end])).toEqual([['GS', 216, 'socket', 'peg'], ['LS', 216, 'socket', 'socket']]);
  });

  /*
   * MUTATION PROOF, run: Gstaad's platform canopy from 20 across, not 26:
   * `GS: expected 20 to be greater than or equal to 24`.
   */
  it('nothing above the road\'s top stands closer than 24 to its middle, so a train passes', () => {
    for (const s of stations) {
      const nearest = Math.min(...s.decor!.flatMap((d) => {
        if (d.kind === 'slab') return d.topMm > 12 ? [d.atMm[1] - d.widthMm / 2] : [];
        if (d.kind === 'prism') return d.sectionMm.map(([y]) => y);
        throw new Error(`${s.id}: a ${d.kind} this test does not read`);
      }));
      expect(nearest, s.id).toBeGreaterThanOrEqual(24);
    }
  });

  /*
   * MUTATION PROOFS, run:
   * - none of the stations' shapes solid (`box`, `fir` and `prism`): `GS:
   *   expected [] to deeply equal [ 'on p' ]`. The base alone is not pinned:
   *   trees and walls stand everywhere a straight could lie on it.
   * - the station on the other side of the road (every across negated in
   *   `box`): `GS: expected [ 'far p' ] to deeply equal []`.
   * - Gstaad's walls, roof, chimneys and turret not solid: `GS: expected []
   *   to deeply equal [ 'over p' ]`.
   */
  it('floor track cannot lie on the base, the far side of the road is free, raised track cannot cross the building', () => {
    for (const s of stations) {
      expect(clashes(s.id, [['A', 0], ['A', 1]]), s.id).toEqual([]);
      // Along the road, 70 to its left: on the base, under the walls.
      expect(clashes(s.id, [], [['on', 'A', at(36, 70, 0)]]), s.id).toEqual(['on p']);
      // The same distance to its right: bare floor.
      expect(clashes(s.id, [], [['far', 'A', at(36, -70, 0)]]), s.id).toEqual([]);
      // One level up, along the middle of the building.
      expect(clashes(s.id, [], [['over', 'A', { ...at(36, 82, 0), level: 1 }]]), s.id).toEqual(['over p']);
    }
  });

  /*
   * MUTATION PROOF, run: the two model numbers swapped in origins.ts:
   * `expected [ …(2) ] to deeply equal [ …(2) ]`.
   */
  it('each links to its own model page', () => {
    expect(stations.map((s) => originUrl(originOf(resolve(s.id))!))).toEqual([
      'https://makerworld.com/en/models/3655001',
      'https://makerworld.com/en/models/3652791',
    ]);
  });
});
