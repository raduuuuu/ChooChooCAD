/**
 * DECORATED PIECES (decorated-pieces plan 2026-11-03, task T2): a base part's
 * track, unchanged, plus decoration whose collision boxes and 3D come from
 * one list of measured shapes. No decorated piece ships yet, so these tests
 * build one from a fixture spec through the library's own derivation.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, decorLevels, deriveDecorated, isStructure, makeResolver, resolveLibrary } from '../data/library.js';
import type { DecoratedSpec } from '../data/decoratedSeeds.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import { buildScene } from '../src/view3d/mesh.js';
import type { DimensionSource, Part } from '../src/parts/schema.js';

const RISE = 61;
const FIXTURE_SOURCE: DimensionSource = { status: 'unverified', source: 'a test fixture', note: 'Not a real piece.' };

/** A medium straight with a platform on one side; on the other, a raised sign and a thin barrier, both clear of the track. */
const PLATFORM: DecoratedSpec = {
  id: 'DX-PLATFORM', name: 'Platform straight', base: 'A', dimensions: FIXTURE_SOURCE,
  decor: [
    { kind: 'slab', atMm: [72, 40], lengthMm: 120, widthMm: 40, bottomMm: 0, topMm: 20, noun: 'platform' },
    { kind: 'slab', atMm: [72, -50], lengthMm: 40, widthMm: 40, bottomMm: 70, topMm: 90, noun: 'sign' },
    { kind: 'slab', atMm: [20, -50], lengthMm: 4, widthMm: 40, bottomMm: 30, topMm: 34, solid: false, noun: 'barrier' },
  ],
};

const DERIVED = deriveDecorated([PLATFORM], BUILT_IN, RISE);
const resolve = makeResolver([...BUILT_IN, ...DERIVED]);
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

/** Everything a piece's track is made of: what a decorated piece must take from its base unchanged (plan F3). */
const track = (p: Part) => ({ ports: portsOf(p), kind: p.kind, slop: p.slop, plank: p.plankWidthMm, ...(p.kind === 'straight' ? { lengthMm: p.lengthMm, ends: p.ends, rise: p.rise } : {}) });

describe('a decorated piece takes its track from its base (eng D2, plan F3)', () => {
  it('every decorated piece, built in or fixture, has exactly its base part\'s track', () => {
    const decorated = [...BUILT_IN, ...DERIVED].filter((p) => p.decoratedFrom !== undefined);
    expect(decorated.length).toBeGreaterThan(0);
    for (const p of decorated) expect(track(p), p.id).toEqual(track(resolve(p.decoratedFrom!)));
  });

  /*
   * MUTATION PROOF, run: the base's catalogue number carried over fails with
   * `expected [ 'Platform straight', 'A', …(2) ] to deeply equal [ … ]`; the
   * decoration put in `body` fails with `expected true to be false`.
   */
  it('keeps its own name, id and provenance, never the base\'s catalogue number, and is not a structure', () => {
    const p = resolve('DX-PLATFORM');
    expect([p.name, p.decoratedFrom, p.dimensions.status, p.partNumber]).toEqual(['Platform straight', 'A', 'unverified', undefined]);
    expect(resolve('A').partNumber).toBe('33335');
    expect(isStructure(p)).toBe(false);
  });

  it('a seed with no base, a taken id or a shape with no height is refused when the library loads', () => {
    expect(() => deriveDecorated([{ ...PLATFORM, base: 'NOPE' }], BUILT_IN, RISE)).toThrow(/no built-in part NOPE/);
    expect(() => deriveDecorated([{ ...PLATFORM, id: 'A' }], BUILT_IN, RISE)).toThrow(/already a built-in part/);
    const flat = { ...PLATFORM.decor[0]!, topMm: 0 };
    expect(() => deriveDecorated([{ ...PLATFORM, decor: [flat] }], BUILT_IN, RISE)).toThrow(/needs a height/);
  });

  /*
   * MUTATION PROOF, run: decoration not stripped from stored parts fails with
   * `expected [ 'A', …(2) ] to deeply equal [ undefined, undefined, undefined ]`.
   */
  it('a stored correction cannot carry a decoration', () => {
    const forged = { ...resolve('A'), id: 'X6', decoratedFrom: 'A', decor: PLATFORM.decor, decorBody: resolve('DX-PLATFORM').decorBody };
    const got = resolveLibrary([{ submissionId: 's', at: '2026-11-03T10:00:00Z', part: forged as never }]).find((p) => p.id === 'X6')!;
    expect([got.decoratedFrom, got.decor, got.decorBody]).toEqual([undefined, undefined, undefined]);
  });
});

describe('a decoration blocks the levels its height reaches (eng D9)', () => {
  /*
   * MUTATION PROOF, run: a range ending on a line rounded into the next level
   * fails with `expected [ +0, 1 ] to deeply equal [ +0, +0 ]`.
   */
  it('reads each level as [n x rise, (n+1) x rise): a range ending on a line stays below it', () => {
    expect(decorLevels(0, 20, RISE)).toEqual([0, 0]);
    expect(decorLevels(0, 61, RISE)).toEqual([0, 0]);
    expect(decorLevels(0, 61.5, RISE)).toEqual([0, 1]);
    expect(decorLevels(61, 70, RISE)).toEqual([1, 1]);
    expect(decorLevels(70, 90, RISE)).toEqual([1, 1]);
    expect(decorLevels(30, 140, RISE)).toEqual([0, 2]);
  });

  it('derives one box per shape, at those levels, solid unless marked', () => {
    expect(resolve('DX-PLATFORM').decorBody!.map((b) => [b.noun, b.levels, b.solid])).toEqual([
      ['platform', [0, 0], true],
      ['sign', [1, 1], true],
      ['barrier', [0, 0], false],
    ]);
  });
});

describe('decoration collides like wood, as measured (eng D4, D9)', () => {
  const p = ['p', 'DX-PLATFORM', at(0, 0, 0)] as const;

  /*
   * MUTATION PROOF, run: decoration not rendered with the bodies fails with
   * `expected [] to deeply equal [ 'into p' ]`.
   */
  it('floor track into the platform clashes; clear of it does not', () => {
    // The platform: 12 to 132 along, 20 to 60 across; the piece's own plank ends at 20 across.
    expect(clashes(scene([p, ['into', 'A', at(72, 25, 4)]]))).toEqual(['into p']);
    expect(clashes(scene([p, ['clear', 'A', at(72, 100, 0)]]))).toEqual([]);
  });

  it('floor track runs under the raised sign; raised track there clashes with it', () => {
    // The sign: 52 to 92 along, -70 to -30 across, 70 to 90mm up (level 1).
    expect(clashes(scene([p, ['under', 'A', at(0, -50, 0)]]))).toEqual([]);
    expect(clashes(scene([p, ['raised', 'A', at(0, -50, 0, 1)]]))).toEqual(['p raised']);
  });

  /*
   * MUTATION PROOF, run: non-solid decoration let collide fails with
   * `expected [ 'p through' ] to deeply equal []`.
   */
  it('a barrier that is not solid never collides', () => {
    // The barrier: 18 to 22 along, -70 to -30 across; this floor straight crosses it and nothing else.
    expect(clashes(scene([p, ['through', 'A', at(20, -170, 4)]]))).toEqual([]);
  });
});

describe('decoration in 3D is drawn as measured (eng O4)', () => {
  /*
   * MUTATION PROOF, run: decoration drawn as tall as its levels fails with
   * `expected [ +0, 61, 122 ] to deeply equal [ +0, 20, 30, 34, 70, 90 ]`.
   */
  it('the platform stands 20mm, the sign from 70 to 90mm, never a level-tall block', () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'DX-PLATFORM', turn: 'left' }], welds: [] };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('DX-PLATFORM'), riseMm: RISE, plankMm: 12 });
    const zs = new Set<number>();
    const pos = s.structures.solid.positions;
    for (let i = 2; i < pos.length; i += 3) zs.add(Math.round(pos[i]! * 10) / 10);
    expect([...zs].sort((a, b) => a - b)).toEqual([0, 20, 30, 34, 70, 90]);
  });
});

describe('every piece draws within its 3D budget (eng D8)', () => {
  /*
   * MUTATION PROOF, run: the limit set to 500 fails with `T: expected 530 to be
   * less than or equal to 500`: the test counts real triangles.
   */
  it('no built-in part, drawn alone, has more than 3,000 triangles', () => {
    const all = makeResolver([...BUILT_IN]);
    const portsAll = (piece: Piece) => portsOf(all(piece.partId), piece.turn);
    for (const part of BUILT_IN) {
      const g: Graph = { pieces: [{ pieceId: 'p', partId: part.id, turn: 'left' }], welds: [] };
      const r = renderGraph(g, portsAll, all, placeAll(g, portsAll));
      const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => part, riseMm: RISE, plankMm: 12 });
      let triangles = 0;
      const count = (o: unknown): void => {
        if (!o || typeof o !== 'object') return;
        if ('indices' in o && o.indices instanceof Uint32Array) { triangles += o.indices.length / 3; return; }
        for (const v of Object.values(o)) count(v);
      };
      count(s);
      expect(triangles, part.id).toBeLessThanOrEqual(3000);
    }
  });
});

describe('the level crossing, the first decorated piece (plan T3)', () => {
  const lc = ['lc', 'LC', at(0, 0, 0)] as const;

  /*
   * MUTATION PROOF, run: decorated ids left out of the fixed set fails with
   * `expected 'Not a level crossing' to be 'Level crossing'`.
   */
  it('is built in only: a stored submission with its id is refused (eng O5)', () => {
    const forged = { ...resolve('HP'), id: 'LC', name: 'Not a level crossing' };
    const lib = resolveLibrary([{ submissionId: 's', at: '2026-11-03T10:00:00Z', part: forged as never }]);
    expect(lib.find((p) => p.id === 'LC')!.name).toBe('Level crossing');
  });

  /*
   * MUTATION PROOF, run: the posts marked not solid fails with `expected [] to
   * deeply equal [ 'into lc' ]`.
   */
  it('works like the printed crossing, and its posts are wood: track into one clashes, track past them does not', () => {
    expect(resolve('LC').decoratedFrom).toBe('HP');
    // A post stands at 113 along, 36.5 across (108 to 118, 31.5 to 41.5); a 54 straight
    // coming down at 120 along covers 100 to 140 by 26 to 80, clear of both roads.
    expect(clashes(scene([lc, ['into', 'A2', at(120, 80, 12)]]))).toEqual(['into lc']);
    expect(clashes(scene([['hp', 'HP', at(0, 0, 0)], ['into', 'A2', at(120, 80, 12)]]))).toEqual([]);
    expect(clashes(scene([lc, ['past', 'A', at(150, 60, 0)]]))).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the arms dropped from the seed fails with `expected [
   * [ 'barrier post', true ], …(1) ] to deeply equal [ …(3) ]`.
   */
  it('its arms are drawn but never collide', () => {
    const decor = resolve('LC').decorBody!;
    expect(decor.map((b) => [b.noun, b.solid])).toEqual([
      ['barrier post', true], ['barrier post', true], ['barrier', false], ['barrier', false],
    ]);
  });
});

describe('the station straight: a one-sided decoration (plan T4, eng D5, design 5A)', () => {
  const side = (turn: 'left' | 'right') => {
    const g: Graph = { pieces: [{ pieceId: 's', partId: 'SS', turn }], welds: [] };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const platform = r.bodies.find((b) => b.decor?.noun === 'platform')!;
    return { ys: Math.sign(platform.from.y), ends: r.ports.map((q) => [q.x, q.y, q.polarity]) };
  };

  /*
   * MUTATION PROOF, run: the flip words not derived from `oneSided` fails with
   * `expected [ 'A', undefined ] to deeply equal [ 'A', { label: 'Other side', …(2) } ]`.
   */
  it('works like a medium straight, and says what F does to it', () => {
    const p = resolve('SS');
    expect([p.decoratedFrom, p.flip]).toEqual(['A', {
      label: 'Other side', verb: 'put the platform on the other side', after: 'Platform on the other side.',
    }]);
  });

  /*
   * MUTATION PROOF, run: decoration not mirrored with the piece fails with
   * `expected [ -1, -1 ] to deeply equal [ -1, 1 ]`.
   */
  it('F puts the platform on the other side and leaves both ends where they were', () => {
    const left = side('left'), right = side('right');
    expect([left.ys, right.ys]).toEqual([-1, 1]);
    expect(right.ends).toEqual(left.ends);
  });

  it('its platform is wood: track along its platform side clashes, along the other side does not', () => {
    // The platform runs 20 to 124 across on its side (y negative turned left).
    const beside = (turn: 'left' | 'right', y: number) => clashes({
      pieces: [{ pieceId: 's', partId: 'SS', turn }, { pieceId: 'n', partId: 'A', turn: 'left' }],
      welds: [],
      anchors: new Map([['s', at(0, 0, 0)], ['n', at(0, y, 0)]]),
    });
    expect(beside('left', -70)).toEqual(['n s']);
    expect(beside('left', 70)).toEqual([]);
    expect(beside('right', 70)).toEqual(['n s']);
  });
});

describe('the tunnel straight: a vault over a long straight (plan T5, eng D10)', () => {
  const pair = (partId: string, y: number, level = 0) => clashes({
    pieces: [{ pieceId: 't', partId, turn: 'left' }, { pieceId: 'n', partId: 'D', turn: 'left' }],
    welds: [],
    anchors: new Map([['t', at(0, 0, 0)], ['n', level === 0 ? at(0, y, 0) : at(108, y, 4, level)]]),
  });

  it('works like a long straight; its vault yields two walls and a roof, and one box to draw it', () => {
    const p = resolve('TT');
    expect(p.decoratedFrom).toBe('D');
    expect(p.decorBody!.map((b) => [b.role, b.solid, b.draw, b.levels])).toEqual([
      ['wall', true, false, [0, 0]],
      ['wall', true, false, [0, 0]],
      ['roof', true, false, [0, 1]],
      ['footprint', false, true, [0, 1]],
    ]);
  });

  /*
   * MUTATION PROOF, run: the roof built from the floor fails with `roof at 0:
   * expected false to be true`.
   */
  it('leaves the passage open: no solid box fills the space between its walls under the arch', () => {
    for (const b of resolve('TT').decorBody!.filter((d) => d.solid)) {
      const innerEdge = Math.abs(b.atMm[1]) - b.widthMm / 2;
      expect(innerEdge >= 19.5 || b.bottomMm >= 60, `${b.role} at ${b.atMm[1]}`).toBe(true);
    }
  });

  /*
   * MUTATION PROOF, run: the roof dropped fails with `expected [ [], [] ] to deeply
   * equal [ [ 'n t' ], [] ]`; the walls not solid fails the box list above.
   */
  it('its walls stand in the way of track alongside, and its roof of raised track over it', () => {
    // A long straight 44 across: its plank reaches 24 across, into the wall (19.5 to 25.5).
    expect([pair('TT', -44), pair('D', -44)]).toEqual([['n t'], []]);
    // Raised track crossing square over the middle: the roof reaches 85.5mm, into level 1.
    expect([pair('TT', -100, 1), pair('D', -100, 1)]).toEqual([['n t'], []]);
  });
});

/*
 * THE STATION BUILDING, MEASURED AND DETAILED (station detail pilot,
 * docs/plan/2026-11-05-rich-graphics.md: owner B1; eng E-A1, O4, X1, X2, Y1;
 * design DR1, DR2, DR6, DR7). Tests 1-4, 6, 8 and 10 of the plan.
 */
describe('the station building, measured and detailed (detail pilot)', () => {
  const sceneOf = (turn: 'left' | 'right', heading = 0, extra: { buildMode?: boolean; highlight?: string } = {}) => {
    const g: Graph = { pieces: [{ pieceId: 's', partId: 'SS', turn }], welds: [], anchors: new Map([['s', at(0, 0, heading)]]) };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    return buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('SS'), riseMm: RISE, plankMm: 12, ...extra });
  };
  const points = (a: Float32Array) => Array.from({ length: a.length / 3 }, (_, i) => [a[3 * i]!, a[3 * i + 1]!, a[3 * i + 2]!] as const);

  /*
   * 1. THE BOXES ARE THE MEASURED MODEL (owner B1; replaces O2's "identical"):
   * every collision box, field by field, role included (X2). The hall now
   * reaches 76mm, into the raised level (61mm and up), so raised track over
   * the station's hall clashes, as it would on the floor.
   * MUTATION PROOF, run: the hall's top changed to 77 in the seed (`topMm:
   * 77`): `expected [ …(8) ] to deeply equal [ …(8) ]`. (Back to 61 fails
   * sooner: the library refuses the seed, its openings now above the wall.)
   */
  it('collides as the measured station: hall, roof, tower and cap, every field', () => {
    const boxes = resolve('SS').decorBody!.filter((b) => b.solid).map((b) => [b.role, b.atMm, b.lengthMm, b.widthMm, b.bottomMm, b.topMm, b.levels, b.draw, b.noun]);
    expect(boxes).toEqual([
      ['footprint', [72, -72], 144, 104, 0, 16, [0, 0], true, 'platform'],
      ['footprint', [72, -135], 79, 22, 0, 14, [0, 0], true, 'stairs'],
      ['footprint', [72, -85], 140, 69, 16, 76, [0, 1], false, 'station building'],
      ['footprint', [72, -85], 144, 78, 76, 123, [1, 2], false, 'roof'],
      ['footprint', [72, -66], 40, 40, 81, 136, [1, 2], false, 'clock tower'],
      ['footprint', [72, -66], 50, 50, 131, 139, [2, 2], false, 'clock tower'],
      ['footprint', [72, -66], 40, 40, 139, 144, [2, 2], false, 'clock tower'],
      ['footprint', [72, -66], 30, 30, 144, 151, [2, 2], false, 'clock tower'],
    ]);
  });

  /*
   * 2. IMPOSSIBLE NUMBERS ARE REFUSED WHEN THE LIBRARY LOADS (eng E-A1).
   * MUTATION PROOF, run: the opening check removed: `expected [Function] to
   * throw an error`.
   */
  it('refuses a station whose opening runs into its end wall, or whose clock is wider than its tower', () => {
    const ss = resolve('SS').decor!.find((d) => d.kind === 'station')!;
    if (ss.kind !== 'station') throw new Error('no station');
    const spec = (station: typeof ss): DecoratedSpec => ({ id: 'DX-ST', name: 'x', base: 'A', dimensions: FIXTURE_SOURCE, decor: [station] });
    expect(() => deriveDecorated([spec({ ...ss, openings: [{ side: 1, fromMm: -69, toMm: 0, topMm: 64 }] })], BUILT_IN, RISE)).toThrow(/opening must lie between its end walls/);
    expect(() => deriveDecorated([spec({ ...ss, clock: { ...ss.clock, sizeMm: 45 } })], BUILT_IN, RISE)).toThrow(/clock must fit on its tower/);
  });

  /*
   * 3. A TURNED STATION IS REFLECTED, NOT ONLY MOVED (CEO O4; eng X1): every
   * detail point of the turned piece is the plain one's point reflected across
   * the piece's axis, at a rotated placement too. The box alone moving would
   * leave the clock facing the street.
   * MUTATION PROOF, run: the `* m` removed from ShapeFrame's `at` in mesh.ts:
   * `expected false to be true // Object.is equality`.
   */
  it('turned, its detail is the plain detail reflected across the piece, at any heading', () => {
    for (const heading of [0, 3]) {
      const h = (heading * Math.PI) / 8;
      const u = [Math.cos(h), Math.sin(h)] as const;
      const plain = points(sceneOf('left', heading).structures.detail[0]!.positions);
      const turned = points(sceneOf('right', heading).structures.detail[0]!.positions);
      const reflected = plain.map(([x, y, z]) => {
        const d = x * u[0] + y * u[1];
        return [2 * d * u[0] - x, 2 * d * u[1] - y, z] as const;
      });
      // Float32 buffers: equal to a thousandth of a millimetre.
      expect(turned.length).toBe(reflected.length);
      expect(turned.every((p, i) => p.every((v, k) => Math.abs(v - reflected[i]![k]!) < 1e-3))).toBe(true);
    }
  });

  /*
   * 4. THE DRAWING IS FINITE AND STAYS WITHIN ITS OWN BOX.
   * MUTATION PROOF, run: the vents' base given `z0 + Math.sqrt(-1)`: `expected
   * false to be true // Object.is equality`.
   */
  it('every vertex of the drawing is finite, on the floor or up to the cap at 151mm', () => {
    const s = sceneOf('left');
    const zs = points(s.structures.solid.positions).map((p) => p[2]);
    expect(zs.every((z) => Number.isFinite(z) && z >= 0 && z <= 151)).toBe(true);
    expect(s.bounds.max[2]).toBeCloseTo(151, 6);
  });

  /*
   * 6 and 10. DETAIL IS ITS OWN GROUP, AND ONLY WHAT THE MODEL HAS (DR1, DR6,
   * DR7): the square clock (4) and its two hands, the sign (4) and the
   * platform line (4), as lines apart from the outline's edges. No ring.
   * MUTATION PROOF, run: `pen.detail` routed into the edges (`detail: (a, b) =>
   * edgeTo.push(...a, ...b)`): three tests fail, the first with `expected []
   * to deeply equal [ 's' ]`.
   */
  it('draws 14 detail lines in one group for the piece, apart from the edges', () => {
    const d = sceneOf('left').structures.detail;
    expect(d.map((g) => g.pieceId)).toEqual(['s']);
    expect((d[0]?.positions.length ?? 0) / 6).toBe(14);
  });

  /*
   * 8. BUILD MODE (DR2, eng Y1, E-B3): a station already down draws no
   * detail on any build-mode screen; as the next piece, its detail stays and
   * its building's outline goes in its own buffer.
   * MUTATION PROOF, run: the build-mode check dropped from `detailTo`:
   * `expected [ 's' ] to deeply equal []`.
   */
  it('in build mode: no detail once down, even with no next piece; as the next piece, detail and its own outline', () => {
    expect(sceneOf('left', 0, { buildMode: true }).structures.detail.map((g) => g.pieceId)).toEqual([]);
    expect(sceneOf('left', 0, { buildMode: true, highlight: 'other' }).structures.detail.map((g) => g.pieceId)).toEqual([]);
    const next = sceneOf('left', 0, { buildMode: true, highlight: 's' });
    expect([next.structures.detail.map((g) => g.pieceId), next.nextBuilding !== null]).toEqual([['s'], true]);
    expect(sceneOf('left').nextBuilding).toBeNull();
  });
});
