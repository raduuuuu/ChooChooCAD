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
import { BUILT_IN, makeResolver } from '../data/library.js';
import { CLEARANCE } from '../data/rampSeeds.js';
import { ACTION_TUNNEL_STATION } from '../data/trackDecorSeeds.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import { domeTop } from '../src/parts/dome.js';
import type { DecorDome, DecorSlab } from '../src/parts/schema.js';
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
   * MUTATION PROOF, run: the dome flat across (`acrossRiseMm: 0`): `expected 138 to be greater than 148`.
   */
  it('its roof arches along the track and across it, highest in its middle', () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'AT', turn: 'left' }], welds: [], anchors: new Map([['p', at(0, 0, 0)]]) };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('AT'), riseMm: CLEARANCE.riseMm, plankMm: 12 });
    const { solid, solidPaint, paints } = s.structures;
    const p = solid.positions;
    const roof: [number, number, number][] = [];
    for (let v = 0; v < p.length / 3; v++) if (paints[solidPaint[v]!] === '--paint-orange') roof.push([p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!]);
    const topNear = (x: number, y: number) => Math.max(...roof.filter(([a, b]) => Math.abs(a - x) < 12 && Math.abs(b - y) < 12).map(([, , z]) => z));
    // Along the middle line: higher in the middle than toward the ends; across the middle: higher on the line than out at the sides.
    expect(topNear(144, 0)).toBeGreaterThan(topNear(80, 0) + 10);
    expect(topNear(144, 0)).toBeGreaterThan(topNear(144, 80) + 10);
  });
});
