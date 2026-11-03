/**
 * STATIONS, PIERS AND TUNNELS IN THE ENGINE (plan 2026-11-02; CEO S1, X1,
 * X3, C4 B, OV1, OV4, OV5; eng D1, E4, EO1).
 *
 * Value: protects=each row of the blocking table (station footprint and roof,
 * pier footprint, tunnel walls and roof), a station's deck one level up with
 * its footprint on the floor, a station joined straight onto floor track
 * raising that run, body against body, a body never let off as a welded
 * neighbour, bodies bending with their piece, a body under raised track not
 * counted as a bridge
 * Value: fails_when=bodies share one span per piece, a body is exempted with
 * a welded neighbour, bodies skip the bend, the deck stops lifting the
 * ports, or bodies count as bridges
 * Value: why_new=no wood that is not track existed
 * Value: seam=none (pure engine); the three pieces are estimates, so these
 * pin behaviour, not sizes
 * Value: no_claim=drawing them (the app PR) and the real pieces' sizes
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, isStructure, makeResolver, resolveLibrary } from '../data/library.js';
import { PIER, STATION, STRUCTURE_WORDS, TUNNEL } from '../data/structureSeeds.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { bendRender } from '../src/graph/bendPose.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { levelOf, portsOf, type Frame, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { findBridges, findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import { assemblyOrder } from '../src/graph/assembly.js';
import { solveGraph } from '../src/graph/solve.js';

const resolve = makeResolver([...BUILT_IN, STATION, PIER, TUNNEL]);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;

const at = (x: number, y: number, heading: number, level = 0): Frame => {
  const pos = add(fromInt(x), scale(zetaPow(4), y)) as Cyc;
  return level === 0 ? { pos, heading } : { pos, heading, level };
};

/** Lone pieces placed where they are told: each its own run, at its own level. */
function scene(items: readonly (readonly [string, string, Frame])[]): Graph {
  return {
    pieces: items.map(([pieceId, partId]) => ({ pieceId, partId, turn: 'left' as const })),
    welds: [],
    anchors: new Map(items.map(([pieceId, , frame]) => [pieceId, frame])),
  };
}

/** Every pair of pieces whose wood shares area on the same level, as "a b". */
function clashes(g: Graph): string[] {
  const placement = placeAll(g, ports);
  const r = renderGraph(g, ports, resolve, placement);
  return findPlankOverlaps(g, [...r.segments, ...r.bodies], half, connectorSites(g, ports, placement)).map((o) => `${o.a} ${o.b}`);
}

function bridges(g: Graph): number {
  const placement = placeAll(g, ports);
  const r = renderGraph(g, ports, resolve, placement);
  return findBridges(g, [...r.segments, ...r.bodies], half, connectorSites(g, ports, placement)).length;
}

// The station at the origin facing +x: deck from (0,0) to (144,0) one level up.
const ST = ['st', 'ST', at(0, 0, 0)] as const;

describe('the blocking table', () => {
  /*
   * MUTATION PROOF, run: one span per piece again (the quad's lo/hi taken
   * from the piece's last segment) fails with `expected [] to deeply equal [
   * 'floor st' ]`: the station's roof span hid its footprint.
   */
  it('floor track cannot run through a station footprint', () => {
    expect(clashes(scene([ST, ['floor', 'D', at(72, -100, 4)]]))).toEqual(['floor st']);
  });

  it('raised track cannot run through a station roof, beside its deck', () => {
    expect(clashes(scene([ST, ['up', 'A', at(0, 50, 0, 1)]]))).toEqual(['st up']);
  });

  it('raised track passes over a pier; floor track does not pass through one', () => {
    const pier = ['pier', 'PR', at(300, 0, 0)] as const;
    expect(clashes(scene([pier, ['up', 'D', at(300, -100, 4, 1)]]))).toEqual([]);
    expect(clashes(scene([pier, ['floor', 'D', at(300, -100, 4)]]))).toEqual(['floor pier']);
  });

  it("a tunnel's own road is free; its walls stop floor track and its roof stops raised track", () => {
    const tunnel = ['tun', 'TU', at(0, 300, 0)] as const;
    expect(clashes(scene([tunnel]))).toEqual([]);
    expect(clashes(scene([tunnel, ['beside', 'A', at(0, 340, 0)]]))).toEqual(['beside tun']);
    expect(clashes(scene([tunnel, ['over', 'D', at(72, 200, 4, 1)]]))).toEqual(['over tun']);
  });

  it('two piers in one place clash (OV4: body against body)', () => {
    expect(clashes(scene([['p1', 'PR', at(500, 0, 0)], ['p2', 'PR', at(510, 0, 0)]]))).toEqual(['p1 p2']);
  });

  /*
   * MUTATION PROOF, run: the body exemption dropped (welded pairs let off
   * wholesale again) fails with `expected [] to deeply equal [ 'st up' ]`.
   */
  it('a body is never let off as a welded neighbour (OV4)', () => {
    // Drawn apart, then checked as if welded: the exemption reads only the welds.
    const g = scene([ST, ['up', 'A', at(0, 50, 0, 1)]]);
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const welded: Graph = { ...g, welds: [{ a: { pieceId: 'st', port: 1 }, b: { pieceId: 'up', port: 0 } }] };
    const found = findPlankOverlaps(welded, [...r.segments, ...r.bodies], half, connectorSites(g, ports, placement));
    expect(found.map((o) => `${o.a} ${o.b}`)).toEqual(['st up']);
  });

  /*
   * MUTATION PROOF, run: the body check dropped from bridges fails with
   * `expected 1 to be +0`.
   */
  it('a body under raised track is not a bridge', () => {
    expect(bridges(scene([['pier', 'PR', at(300, 0, 0)], ['up', 'D', at(300, -100, 4, 1)]]))).toBe(0);
  });
});

describe("a station's height (C4 B)", () => {
  /*
   * MUTATION PROOF, run: the deck dropped from portsOf (model.ts) fails with
   * `expected 1 to be +0`: the station's frame rose instead of its deck.
   */
  it('after a ramp: the footprint sits on the floor and the deck one level up', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'a', partId: 'A', turn: 'left' }, { pieceId: 'n', partId: 'N', turn: 'left' }, { pieceId: 'st', partId: 'ST', turn: 'left' }],
      welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'n', port: 0 } }, { a: { pieceId: 'n', port: 1 }, b: { pieceId: 'st', port: 0 } }],
    };
    const p = placeAll(g, ports);
    expect(levelOf(p.frames.get('a')!)).toBe(0);
    expect(levelOf(p.frames.get('st')!)).toBe(0);
    const r = renderGraph(g, ports, resolve, p);
    expect(r.segments.filter((s) => s.pieceId === 'st').map((s) => s.level)).toEqual([1]);
    expect(r.bodies.filter((s) => s.body === 'footprint').map((s) => s.level ?? 0)).toEqual([0]);
  });

  it('joined straight onto floor track: that run rises, as a descending ramp raises a floor loop (OV1)', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'a', partId: 'A', turn: 'left' }, { pieceId: 'st', partId: 'ST', turn: 'left' }],
      welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'st', port: 0 } }],
    };
    const p = placeAll(g, ports);
    expect(levelOf(p.frames.get('a')!)).toBe(1);
    expect(levelOf(p.frames.get('st')!)).toBe(0);
  });
});

describe('bodies follow their piece', () => {
  /*
   * MUTATION PROOF, run: bodies left out of bendRender fails with
   * `expected +0 to be 10`.
   */
  it('a bent piece moves its body with it (OV5)', () => {
    const g = scene([ST]);
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const bent = bendRender(r, new Map([['st', [10, 0, 0] as const]]));
    expect(bent.bodies[0]!.from.x - r.bodies[0]!.from.x).toBe(10);
  });

  it('a pier has no ends and no road, only its body', () => {
    expect(portsOf(PIER)).toEqual([]);
    const g = scene([['pier', 'PR', at(0, 0, 0)]]);
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    expect(r.segments).toEqual([]);
    expect(r.bodies.map((b) => b.body)).toEqual(['footprint']);
  });
});

describe('a pier is not track', () => {
  /*
   * MUTATION PROOF, run: summariseRuns counting every run again fails with
   * `expected { count: 2, open: 1 } to deeply equal { count: 1, open: +0 }`.
   */
  it('a closed loop with a pier beside it is one closed run, not two (EO4)', () => {
    const ring = Array.from({ length: 8 }, (_, i) => ({ pieceId: `e${i}`, partId: 'E', turn: 'left' as const }));
    const g: Graph = {
      pieces: [...ring, { pieceId: 'pier', partId: 'PR', turn: 'left' }],
      welds: ring.map((_, i) => ({ a: { pieceId: `e${i}`, port: 1 }, b: { pieceId: `e${(i + 1) % 8}`, port: 0 } })),
      anchors: new Map([['pier', at(1000, 1000, 0)]]),
    };
    const r = solveGraph(g, ports, resolve, () => 0, placeAll(g, ports));
    if (!r.ok) throw new Error(`expected a verdict, got ${r.reason}`);
    expect({ count: r.runs.count, open: r.runs.open }).toEqual({ count: 1, open: 0 });
  });
});

describe('naming and ordering a building (design decisions 5, 6)', () => {
  /*
   * MUTATION PROOF, run: the overlap record's body dropped fails with
   * `expected undefined to deeply equal { pieceId: 'st', role: 'footprint' }`.
   */
  it('an overlap with a body says whose body and which part of it', () => {
    const g = scene([ST, ['floor', 'D', at(72, -100, 4)]]);
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const [o] = findPlankOverlaps(g, [...r.segments, ...r.bodies], half, connectorSites(g, ports, placement));
    expect(o!.body).toEqual({ pieceId: 'st', role: 'footprint' });
    const plain = scene([['a', 'A', at(0, 0, 0)], ['b', 'A', at(72, -100, 4)]]);
    const p2 = placeAll(plain, ports);
    const r2 = renderGraph(plain, ports, resolve, p2);
    expect(findPlankOverlaps(plain, r2.segments, half, connectorSites(plain, ports, p2))[0]!.body).toBeUndefined();
  });

  /*
   * MUTATION PROOF, run: standing pieces not started first fails with
   * `expected [ 'up', 'st' ] to deeply equal [ 'st', 'up' ]`: the raised
   * straight went down in mid-air before the station that holds it.
   */
  it('a station goes down before the raised track on its deck; a pier with the floor', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'up', partId: 'A', turn: 'left' }, { pieceId: 'st', partId: 'ST', turn: 'left' }, { pieceId: 'pier', partId: 'PR', turn: 'left' }],
      welds: [{ a: { pieceId: 'st', port: 1 }, b: { pieceId: 'up', port: 0 } }],
      anchors: new Map([['st', at(0, 0, 0)], ['pier', at(500, 500, 0)]]),
    };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const order = assemblyOrder(g, [...r.segments, ...r.bodies]);
    expect(order.filter((s) => s.pieceId !== 'pier').map((s) => s.pieceId)).toEqual(['st', 'up']);
    expect(order.find((s) => s.pieceId === 'pier')!.phase).toBe('floor');
  });
});

describe('"not a loop yet" counts track (eng EO4)', () => {
  /*
   * MUTATION PROOF, run: the run count read from every root again fails with
   * `expected '2 separate runs of track, none of the…' to be '1 piece, open
   * at both ends'`.
   */
  it('a pier beside a straight is one open piece of track, and a lone pier says it joins nothing', () => {
    const detail = (g: Graph) => {
      const r = solveGraph(g, ports, resolve, () => 0, placeAll(g, ports));
      return r.ok ? null : r.detail;
    };
    expect(detail(scene([['pier', 'PR', at(500, 500, 0)], ['a', 'A', at(0, 0, 0)]]))).toBe('1 piece, open at both ends');
    expect(detail(scene([['pier', 'PR', at(500, 500, 0)]]))).toBe('1 piece with no track connections');
  });
});

describe('the measured riser and tunnel with overpass (2026-11-03)', () => {
  /*
   * MUTATION PROOF, run: the riser's legs 4mm further in (y ±21) fails with
   * `expected [ 'rs under' ] to deeply equal []`: a 40mm plank no longer
   * fits between them.
   */
  /*
   * MUTATION PROOF, run: bodies held to the 100 mm² plank line again fails
   * with `expected [] to deeply equal [ 'rs short' ]`: one 8 by 8 leg shares
   * only 64 mm².
   */
  it('a short straight laid through one riser leg is caught', () => {
    expect(clashes(scene([['rs', 'RS', at(0, 0, 0)], ['short', 'A2', at(4, 0, 4)]]))).toEqual(['rs short']);
  });

  it('floor track passes under a riser both ways, between its legs', () => {
    expect(clashes(scene([['rs', 'RS', at(0, 0, 0)], ['under', 'A', at(29, -72, 4)]]))).toEqual([]);
    expect(clashes(scene([['rs', 'RS', at(0, 0, 0)], ['under', 'D', at(-79, 0, 0)]]))).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the tunnel's walls as one box across the whole
   * deck fails with `expected [ 'through to' ] to deeply equal []`.
   */
  it('floor track goes through the tunnel passage, and runs into a wall alongside the road', () => {
    expect(clashes(scene([['to', 'TO', at(0, 0, 0)], ['through', 'A', at(36, -72, 4)]]))).toEqual([]);
    expect(clashes(scene([['to', 'TO', at(0, 0, 0)], ['along', 'D', at(-72, 0, 0)]]))).toEqual(['along to']);
  });
});

describe('the stone arch bridge: a road up, over and down (bridges plan 2026-11-03)', () => {
  const sa = ['sa', 'SA', at(0, 0, 0)] as const;

  /*
   * MUTATION PROOF, run: the hump drawn as one floor straight (the render's
   * hump branch skipped) fails with `expected [ '0/0/false' ] to deeply
   * equal [ Array(3) ]`.
   */
  it('renders three stretches: up a level, along the top, and down (eng D1)', () => {
    const g = scene([sa]);
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    expect(r.segments.map((s) => `${s.level ?? 0}/${s.rise ?? 0}/${Boolean(s.highAtStart)}`)).toEqual(['0/1/false', '1/0/false', '0/1/true']);
    expect(r.segments.map((s) => s.alongMm)).toEqual([[0, 120], [120, 356], [356, 476]]);
  });

  /*
   * MUTATION PROOF, run: the first embankment's footprint lifted off the floor
   * (levels [5, 5]) fails with `expected [] to deeply equal [ 'floor sa' ]`:
   * floor track ran through the abutment.
   */
  it('floor track crosses under the arch square, offset or slantwise, and not through an abutment (eng D8)', () => {
    // Square under the middle, square near each abutment, and at 45 degrees through the middle.
    for (const [x, y, heading] of [[238, -72, 4], [180, -72, 4], [300, -72, 4], [187, -51, 2]] as const) {
      expect(clashes(scene([sa, ['under', 'A', at(x, y, heading)]])), `${x},${y} heading ${heading}`).toEqual([]);
    }
    // At 45 degrees but crossing near an abutment, the plank's corner reaches it.
    expect(clashes(scene([sa, ['under', 'A', at(238, -72, 2)]]))).toEqual(['sa under']);
    expect(clashes(scene([sa, ['floor', 'A', at(100, -72, 4)]]))).toEqual(['floor sa']);
    // Under the raised top but inside the abutment: only the footprint can catch it.
    expect(clashes(scene([sa, ['floor', 'A', at(141, -72, 4)]]))).toEqual(['floor sa']);
  });

  /*
   * MUTATION PROOF, run: the solver's `climbsAboveEnds` left at its default
   * fails with `expected [] to deeply equal [ 'sa' ]`.
   */
  it('laid on raised track, its top would reach a third level (eng D6)', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'n', partId: 'N', turn: 'left' }, { pieceId: 'sa', partId: 'SA', turn: 'left' }],
      welds: [{ a: { pieceId: 'n', port: 1 }, b: { pieceId: 'sa', port: 0 } }],
    };
    const r = solveGraph(g, ports, resolve, () => 0, placeAll(g, ports));
    expect(r.thirdLevels.map((t) => t.pieceId)).toEqual(['sa']);
  });

  /*
   * MUTATION PROOF, run: structures counted in `raised` again fails with
   * `expected true to be false`: the supports note appeared for a bridge.
   */
  it('a bridge carries its own road: no supports note, and the track under it is listed for its clearance (eng D3, D7)', () => {
    const g = scene([sa, ['under', 'A', at(238, -72, 4)]]);
    const r = solveGraph(g, ports, resolve, () => 0, placeAll(g, ports));
    expect(r.raised).toBe(false);
    expect(r.bridges).toEqual([]);
    expect(r.underBridges).toEqual([{ bridge: 'sa', under: 'under' }]);
  });

  it('every bridge seed adds up: up, top and down make its length (eng D10)', () => {
    for (const p of BUILT_IN) {
      if (p.kind !== 'straight' || !p.hump) continue;
      expect(p.hump.upMm + p.hump.topMm + p.hump.downMm, p.id).toBe(p.lengthMm);
    }
  });
});

describe('structures are built-in, and named (eng D4, D10)', () => {
  /*
   * MUTATION PROOF, run: `hump` left out of withRise fails with `expected {
   * upMm: 10, topMm: 124, …(4) } to be undefined`.
   */
  it('a stored correction cannot make a bridge', () => {
    const a = resolve('A');
    const forged = { ...a, id: 'X9', hump: { upMm: 10, topMm: 124, downMm: 10, profileMm: [], clearanceMm: 1, arch: { fromMm: 0, toMm: 1, riseMm: 1, depthMm: 1, baseMm: 0 } } };
    const lib = resolveLibrary([{ submissionId: 's', at: '2026-11-03T10:00:00Z', part: forged as never }]);
    const got = lib.find((p) => p.id === 'X9')!;
    expect(got.kind === 'straight' ? got.hump : null).toBeUndefined();
  });

  /*
   * MUTATION PROOF, run: SA's entry removed from STRUCTURE_WORDS fails with
   * `SA: expected false to be true`.
   */
  it('every structure has its words', () => {
    for (const p of BUILT_IN) if (isStructure(p)) expect(STRUCTURE_WORDS[p.id] !== undefined, p.id).toBe(true);
  });
});
