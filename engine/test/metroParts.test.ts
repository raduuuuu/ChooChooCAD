/**
 * THE METRO TUNNEL AND THE METRO STATION (owner's photos 2026-11-07): two
 * long straights with their decoration, read off seven photos.
 *
 * Value: protects=each is a long straight with its ends unchanged; the two
 * portals stand 203 apart outside and the train clears both the tube and the
 * portals; the station stands wholly on its right, its round ends collide
 * and show in 2D but are drawn only by their discs, each disc cut flat where
 * its portal stands; the tunnel's roof collar lies flat on the roof; an M
 * sign stands on each side of the tunnel
 * Value: fails_when=a seed or a shape option (a wheel's axis or chord, a
 * slab drawn by another shape) is lost or misread
 * Value: why_new=neither piece, nor those shape options, existed
 * Value: seam=the real library and `buildScene`
 * Value: no_claim=how close the figures are to the real piece (read off
 * photos, unverified), and how it looks (the side-by-side renders in the PR)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { CLEARANCE } from '../data/rampSeeds.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { drawnFlat, renderGraph } from '../src/graph/render.js';
import type { DecorVault, DecorWheel, StraightPart } from '../src/parts/schema.js';
import { buildScene } from '../src/view3d/mesh.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const at = (x: number, y: number): Frame => ({ pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc, heading: 0 });

/** One piece alone at the origin, facing +x: the scene's solid vertices. */
function solidOf(partId: string) {
  const g: Graph = { pieces: [{ pieceId: 'p', partId, turn: 'left' }], welds: [], anchors: new Map([['p', at(0, 0)]]) };
  const r = renderGraph(g, ports, resolve, placeAll(g, ports));
  const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve(partId), riseMm: CLEARANCE.riseMm, plankMm: 12 });
  const { solid, solidPaint, paints } = s.structures;
  const p = solid.positions;
  return {
    bodies: r.bodies,
    vertices: Array.from({ length: p.length / 3 }, (_, v) => [p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!] as const),
    paintOf: (v: number) => paints[solidPaint[v]!]!,
  };
}

const decorOf = (id: string) => resolve(id).decor ?? [];
const wheels = (id: string) => decorOf(id).filter((d): d is DecorWheel => d.kind === 'wheel');

describe('the metro pieces are long straights', () => {
  it('each works like D: same length and ends, its decoration added', () => {
    const d = resolve('D') as StraightPart;
    for (const id of ['MT', 'MS']) {
      const p = resolve(id) as StraightPart;
      expect([p.decoratedFrom, p.lengthMm, p.ends]).toEqual(['D', d.lengthMm, d.ends]);
    }
  });

  /*
   * MUTATION PROOF, run: the tube 66 tall (`topMm: 66`): `expected 63 to be
   * greater than or equal to 67`.
   */
  it('the portals stand 203 apart outside, and the train clears the tube and the portals', () => {
    for (const id of ['MT', 'MS']) {
      const vaults = decorOf(id).filter((d): d is DecorVault => d.kind === 'vault');
      const portals = vaults.filter((v) => v.noun === 'portal');
      expect(portals.map((v) => [v.atMm[0] - v.lengthMm / 2, v.atMm[0] + v.lengthMm / 2])).toEqual([[6.5, 24.5], [191.5, 209.5]]);
      // Each opening's top, inside: the outer top less the wall.
      for (const v of vaults) expect(v.topMm - v.wallMm).toBeGreaterThanOrEqual(12 + CLEARANCE.trainMm);
    }
  });
});

describe('the metro station', () => {
  /*
   * MUTATION PROOF, run: the platform reaching the track (`flat(108, -70,
   * …, 106, …)`): `expected [ -17 ] to deeply equal []`.
   */
  it('stands wholly on the right of its track, clear of its plank', () => {
    const intoTrack = (resolve('MS').decorBody ?? []).filter((b) => b.noun !== 'portal' && b.atMm[1] + b.widthMm / 2 > -20).map((b) => b.atMm[1] + b.widthMm / 2);
    expect(intoTrack).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the slab's `drawn: false` ignored (`draw: true`
   * always): `expected [ [ true, true, true ], …(1) ] to deeply equal [ [
   * true, false, true ], …(1) ]`.
   */
  it('its round ends collide and show in 2D, but only their discs draw them in 3D', () => {
    const { bodies } = solidOf('MS');
    const ends = bodies.filter((b) => b.decor?.noun === 'station' && b.decor.topMm === 106 && b.decor.shape === undefined);
    expect(ends.map((b) => [b.decor!.solid, b.decor!.draw, drawnFlat(b)])).toEqual([[true, false, true], [true, false, true]]);
  });

  /*
   * MUTATION PROOF, run: the chord ignored in `drawWheel` (`c` undefined):
   * `expected -29 to be less than or equal to -40.999`.
   */
  it('each round end is cut flat where its portal stands, 41 from the track', () => {
    const { vertices, paintOf } = solidOf('MS');
    // The discs' vertices: the only beech above the plank.
    const disc = vertices.filter(([, , z], v) => paintOf(v) === '--track-fill' && z > 12);
    const reach = Math.max(...disc.map(([, y]) => y));
    expect(reach).toBeLessThanOrEqual(-40.999);
    expect(reach).toBeGreaterThanOrEqual(-41.001);
  });
});

describe('the metro station from above (owner, 2026-11-07)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the two slots left out: `expected [] to deeply equal [ [ 55.2 ], [ 55.2 ] ]`.
   * - the frame a flat box again (its top level, 104): `expected [] to deeply equal [ [ 55 ] ]`.
   * - the outer signs left out: `expected [] to deeply equal [ [ 44, 'across', 58, 22 ], …(1) ]`.
   * - a sign laid on the roof's top again: `expected [ { kind: 'wheel', axis: 'up', …(6) } ] to deeply equal []`.
   */
  it('has the opening in its roof over the doors, a frame on the slope round two dark slots, and an M sign upright on the back on each side of the doors', () => {
    const decor = decorOf('MS');
    // The frame and its slots lie on the roof's circle (52 round (-82, 53)), 3 and 3.2 proud of it: they follow its slope.
    const onSlope = (d: (typeof decor)[number]) =>
      d.kind === 'canopy' ? [...new Set(d.sectionMm.map(([y, z]) => Math.round(Math.hypot(y + 82, z - 53) * 10) / 10))] : null;
    const frame = decor.filter((d) => d.noun === 'roof' && d.kind === 'canopy' && 'paint' in d && d.paint?.fill === '--paint-metro' && d.lengthMm === 70);
    expect(frame.map(onSlope)).toEqual([[55]]);
    const slots = decor.filter((d) => 'paint' in d && d.paint?.fill === '--ink');
    expect(slots.map(onSlope)).toEqual([[55.2], [55.2]]);
    const outside = wheels('MS').filter((w) => w.noun === 'sign' && w.paint?.fill === '--paint-red' && w.atMm[1] < -130);
    expect(outside.map((w) => [w.atMm[0], w.axis ?? 'across', w.centreMm, w.diameterMm])).toEqual([[44, 'across', 58, 22], [168, 'across', 58, 22]]);
    // Nothing lies on the roof's top (owner, 2026-11-07).
    expect(wheels('MS').filter((w) => w.axis === 'up')).toEqual([]);
  });
});

describe('the metro station’s door windows (owner, 2026-11-07)', () => {
  /*
   * MUTATION PROOF, run: the windows left out: `expected [] to deeply equal [ [ 'slab', '--paper' ], …(3) ]`.
   */
  it('a window in each leaf, inside on the back wall and outside on the curved panel, seen through so paper', () => {
    const windows = decorOf('MS').filter((d) => d.noun === 'window');
    expect(windows.map((d) => [d.kind, 'paint' in d ? d.paint?.fill : undefined])).toEqual([['slab', '--paper'], ['canopy', '--paper'], ['slab', '--paper'], ['canopy', '--paper']]);
    const along = windows.map((d) => (d.kind === 'slab' ? d.atMm[0] : d.kind === 'canopy' ? d.alongMm : NaN));
    expect(along).toEqual([90.5, 90.5, 117.5, 117.5]);
  });
});

describe('the metro tunnel', () => {
  /*
   * MUTATION PROOF, run: `axis: 'up'` drawn standing (its `at` for `up`
   * removed): `expected false to be true`.
   */
  it('its roof collar lies flat on the roof, round the hole, 38 across', () => {
    const { vertices } = solidOf('MT');
    const rim = vertices.filter(([x, y]) => Math.abs(Math.hypot(x - 108, y) - 19) < 1e-3);
    expect(rim.length > 0 && rim.every(([, , z]) => Math.abs(z - 67) < 1e-3 || Math.abs(z - 75) < 1e-3)).toBe(true);
  });

  /*
   * MUTATION PROOF, run: the dark disc left out: `expected -Infinity to be close to 15, received difference is Infinity, but expected 0.0005`.
   */
  it('the hole in its collar is dark, 30 across, on the collar’s top', () => {
    const { vertices, paintOf } = solidOf('MT');
    const dark = vertices.filter((_, v) => paintOf(v) === '--ink');
    expect(Math.max(...dark.map(([x, y]) => Math.hypot(x - 108, y)))).toBeCloseTo(15, 3);
    expect(Math.min(...dark.map(([, , z]) => z))).toBeGreaterThanOrEqual(75 - 1e-3);
  });

  it('an M sign stands on each side, 6 proud of the tube', () => {
    const signs = wheels('MT').filter((w) => w.noun === 'sign' && w.paint?.fill === '--paint-red');
    expect(signs.map((w) => [w.atMm[1], w.thickMm]).sort()).toEqual([[-36, 6], [36, 6]]);
  });
});
