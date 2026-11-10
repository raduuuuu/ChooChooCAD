/**
 * DECORATED PIECES (decorated-pieces plan 2026-11-03, task T2): a base part's
 * track, unchanged, plus decoration whose collision boxes and 3D come from
 * one list of measured shapes. No decorated piece ships yet, so these tests
 * build one from a fixture spec through the library's own derivation.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, decorBoxesOf, decorLevels, deriveDecorated, isStructure, makeResolver, resolveLibrary } from '../data/library.js';
import type { DecoratedSpec } from '../data/decoratedSeeds.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import { drawShape, type P3, type Pen } from '../src/view3d/decor.js';
import { buildScene } from '../src/view3d/mesh.js';
import type { DecorTruss, DimensionSource, Part } from '../src/parts/schema.js';
import { trussBandUnderside, trussChord } from '../src/parts/truss.js';
import { DOUBLE_ARCH_BRIDGE } from '../data/trackDecorSeeds.js';

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
/** One piece alone at the origin, built into a 3D scene. */
const aloneScene = (partId: string) => {
  const g: Graph = { pieces: [{ pieceId: 'p', partId }], welds: [], anchors: new Map([['p', at(0, 0, 0)]]) };
  const r = renderGraph(g, ports, resolve, placeAll(g, ports));
  return buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve(partId), riseMm: RISE, plankMm: 12 });
};
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
   * THE BOXES ARE THE MEASURED MODEL (owner, detail plan 2026-11-05): each
   * barrier collides as its round base (a 20 square, floor to track height)
   * and its post (10 square, 3.8 further out, from the base to 31); one box,
   * not solid, draws it, its arm up to 123.8.
   * MUTATION PROOF, run: the seed's base 18 across instead of 20: `expected [
   * Array(6) ] to deeply equal [ Array(6) ]`.
   */
  it('collides as each base and post at their measured sizes; the arm is drawn only', () => {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const decor = resolve('LC').decorBody!;
    expect(decor.map((b) => [b.noun ?? null, b.solid, ...b.atMm.map(r2), r2(b.lengthMm), r2(b.widthMm), b.bottomMm, r2(b.topMm)])).toEqual([
      ['barrier post', true, 113, 36.5, 20, 20, 0, 12],
      ['barrier post', true, 116.8, 36.5, 10, 10, 12, 31],
      [null, false, 113, 36.5, 21.3, 20, 0, 123.8],
      ['barrier post', true, 37, -36.5, 20, 20, 0, 12],
      ['barrier post', true, 33.2, -36.5, 10, 10, 12, 31],
      [null, false, 37, -36.5, 21.3, 20, 0, 123.8],
    ]);
  });

  /*
   * The round base is wood the old 10 square post missed: a straight whose
   * plank edge passes 2.5 inside the base (44 across; the base reaches 46.5,
   * the old post 41.5) now clashes with the crossing, never with its track.
   * MUTATION PROOF, run: the base's box sized as the post (`post.sizeMm`):
   * `expected [] to deeply equal [ 'lc near' ]`.
   */
  it('track brushing a barrier\'s base clashes, though it clears the post above it', () => {
    expect(clashes(scene([lc, ['near', 'A2', at(100, 64, 0)]]))).toEqual(['lc near']);
    expect(clashes(scene([['hp', 'HP', at(0, 0, 0)], ['near', 'A2', at(100, 64, 0)]]))).toEqual([]);
  });

  /*
   * DETAIL IS ONLY WHAT THE MODEL HAS: each arm's stripes, ten slanting
   * edges on each of its two wide faces, as lines apart from the edges.
   * MUTATION PROOF, run: stripes on one face only: `expected 20 to be 40 //
   * Object.is equality`.
   */
  it('draws 40 stripe lines in one group for the piece', () => {
    const d = aloneScene('LC').structures.detail;
    expect(d.map((g) => g.pieceId)).toEqual(['p']);
    expect((d[0]?.positions.length ?? 0) / 6).toBe(40);
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

  /*
   * ITS STONEWORK, EVERY JOINT (owner, detail plan 2026-11-05): 15 rings of
   * 14 lines around the shell, 11 courses up each wall and 13 around the
   * arch, all detail, none of it outline.
   * MUTATION PROOF, run: `drawStones` never called: `expected [] to deeply
   * equal [ 'p' ]`.
   */
  it('draws 245 joint lines in one group for the piece', () => {
    const d = aloneScene('TT').structures.detail;
    expect(d.map((g) => g.pieceId)).toEqual(['p']);
    expect((d[0]?.positions.length ?? 0) / 6).toBe(15 * 14 + 2 * 11 + 13);
  });

  /*
   * Every joint stands just off the shell's outside: on a wall face 25.8
   * across below the spring at 60, or 25.8 from the arch's centre above it,
   * and along the shell (8 to 208), never inside the passage.
   * MUTATION PROOF, run: `JOINT_LIFT_MM` 0, the joints on the faces: `expected [
   * '16.1,-25.5,0.0', …(489) ] to deeply equal []`.
   */
  it('every joint lies 0.3 off the outside of the shell, along its length', () => {
    const pos = aloneScene('TT').structures.detail[0]!.positions;
    const off: string[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = [pos[i]!, pos[i + 1]!, pos[i + 2]!];
      const r = z <= 60 ? Math.abs(y) : Math.hypot(y, z - 60);
      if (Math.abs(r - 25.8) > 1e-3 || x < 8 - 1e-3 || x > 208 + 1e-3) off.push(`${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`);
    }
    expect(off).toEqual([]);
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

describe('a truss arch cut at a piece\'s end (the double-arch bridge, 2026-11-09)', () => {
  // A parabolic arch from -71.5 to 71.5, centred on a piece's start: only its inner half, 0 on, is drawn.
  const half: DecorTruss = { kind: 'truss', fromMm: -71.5, toMm: 71.5, springMm: 23, crownMm: 126, innerCrownMm: 116, sideMm: 28.6, hangers: 0, parabolic: true, braced: false, drawnFromMm: 0 };
  const drawn = (t: DecorTruss) => {
    const pts: P3[] = [], edges: [P3, P3][] = [];
    const pen: Pen = { quad: (...q) => pts.push(...q), edge: (a, b) => { edges.push([a, b]); pts.push(a, b); }, detail: () => {}, grow: () => {} };
    drawShape(t, { at: (a, y, z) => [a, y, z], lengthMm: 0, floorMm: 0, roadTop: () => 12, plankMm: 12 }, pen);
    return { pts, edges };
  };

  /*
   * MUTATION PROOF, run (2026-11-09): the cut ignored (every step drawn):
   * `expected -71.5 to be greater than or equal to -0.001`.
   */
  it('draws nothing past the cut, and reaches its crown at the cut', () => {
    const { pts } = drawn(half);
    // The box starts at the cut, so drawn points run 0 to 71.5 along it.
    expect(Math.min(...pts.map((p) => p[0]))).toBeGreaterThanOrEqual(-0.001);
    expect(Math.max(...pts.map((p) => p[0]))).toBeCloseTo(71.5, 6);
    expect(Math.max(...pts.map((p) => p[2]))).toBeCloseTo(126, 6);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): no line across the cut: `expected [] to have a length of 2 but got +0`.
   */
  it('closes the cut with a line across its chords, one each side', () => {
    const across = drawn(half).edges.filter(([a, b]) => Math.abs(a[0]) < 1e-9 && Math.abs(b[0]) < 1e-9 && a[2] !== b[2]);
    expect(across).toHaveLength(2);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the box over the whole arch:
   * `expected 143 to be 71.5 // Object.is equality`.
   */
  it('takes up only the stretch drawn, and refuses a stretch outside the arch', () => {
    const box = decorBoxesOf('test', [half], 61).find((b) => b.draw);
    expect(box!.lengthMm).toBe(71.5);
    expect(box!.atMm[0]).toBeCloseTo(35.75, 9);
    expect(() => decorBoxesOf('test', [{ ...half, drawnToMm: 80 }], 61)).toThrow(/drawn stretch must lie within the arch/);
  });
});

describe('a truss arch blocks raised track where it rises past one level (owner, 2026-11-09)', () => {
  const RISE = 61;
  const tall: DecorTruss = { kind: 'truss', fromMm: 15, toMm: 158, springMm: 23, crownMm: 126, innerCrownMm: 116, sideMm: 28.6, hangers: 0, parabolic: true, braced: false };
  const ribs = (t: DecorTruss) => decorBoxesOf('test', [t], RISE).filter((b) => b.solid);

  /*
   * MUTATION PROOF, run (2026-11-09): the ribs left out (drawing only, as
   * before): `expected 0 to be greater than 0`.
   */
  it('is solid on both ribs from the ramp\'s height up, only where its chord is past it', () => {
    const solid = ribs(tall);
    expect(solid.length).toBeGreaterThan(0);
    expect(new Set(solid.map((b) => b.atMm[1]))).toEqual(new Set([28.6, -28.6]));
    for (const b of solid) {
      expect(b.bottomMm).toBe(RISE);
      expect(b.levels[0]).toBe(1);
    }
    // The low ends are not solid: the parabola passes 61 this far from each springing (14.7),
    // and the first solid step starts no more than one step (12) before that.
    const past = 71.5 * (1 - Math.sqrt(1 - (RISE - 23) / (126 - 23)));
    const along = solid.map((b) => [b.atMm[0] - b.lengthMm / 2, b.atMm[0] + b.lengthMm / 2]);
    const first = Math.min(...along.map(([a]) => a!)), last = Math.max(...along.map(([, z]) => z!));
    expect(first).toBeGreaterThan(15);
    expect(first).toBeGreaterThan(15 + past - 12);
    expect(last).toBeLessThan(158);
    expect(last).toBeLessThan(158 - past + 12);
    expect(Math.max(...solid.map((b) => b.topMm))).toBe(126);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the ribs solid from where the arch
   * springs, whatever its height: `expected [ { role: 'wall', …(8) }, …(23) ]
   * to deeply equal []`.
   */
  it('a low arch, under one level, never collides', () => {
    expect(ribs({ ...tall, crownMm: 55, innerCrownMm: 50 })).toEqual([]);
  });

  it('a cut arch is solid only over the stretch drawn', () => {
    for (const b of ribs({ ...tall, drawnFromMm: 86.5 })) expect(b.atMm[0] - b.lengthMm / 2).toBeGreaterThanOrEqual(86.5 - 1e-9);
  });
});

describe('a truss arch drawn as one solid band (the double-arch bridge, 2026-11-09)', () => {
  const band: DecorTruss = { kind: 'truss', fromMm: 15, toMm: 158, springMm: 23, crownMm: 126, innerCrownMm: 116, sideMm: 28.6, hangers: 0, parabolic: true, braced: false, band: true };
  const drawn = (t: DecorTruss) => {
    const quads: P3[][] = [], edges: [P3, P3][] = [];
    const pen: Pen = { quad: (...q) => quads.push(q), edge: (a, b) => edges.push([a, b]), detail: () => {}, grow: () => {} };
    drawShape(t, { at: (a, y, z) => [a, y, z], lengthMm: 0, floorMm: 0, roadTop: () => 12, plankMm: 12 }, pen);
    return { quads, edges };
  };

  /*
   * MUTATION PROOF, run (2026-11-09): `band` ignored (drawn as a truss):
   * `expected 22 to be +0 // Object.is equality`, its verticals between the chords.
   */
  it('has no verticals between its chords, only lines along them', () => {
    const across = drawn(band).edges.filter(([p, q]) => Math.abs(p[0] - q[0]) < 1e-9);
    expect(across.length).toBe(0);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the two faces left out (top and
   * underside only): `expected false to be true // Object.is equality`.
   */
  /*
   * MUTATION PROOF, run (2026-11-09): the band down to the inner chord (which
   * meets the outer at the springings): `expected 1.5972222222222143 to be
   * close to 10`, near a springing.
   */
  it('is as deep all along as at its crown, down to where it springs', () => {
    const faces = drawn(band).quads.filter((q) => new Set(q.map((p) => p[1])).size === 1 && new Set(q.map((p) => p[0])).size === 2);
    for (const q of faces) {
      for (const a of new Set(q.map((p) => p[0]))) {
        const zs = q.filter((p) => p[0] === a).map((p) => p[2]);
        if (Math.min(...zs) > 23 + 1e-9) expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(10, 9);
      }
    }
    expect(faces.length).toBeGreaterThan(40);
  });

  it('fills each face from the inner chord up to the outer, 116 to 126 at the crown', () => {
    // The box starts where the arch springs, 15 along: its crown, 86.5 along, is 71.5 into it.
    const atCrown = (q: P3[]) => q.some((p) => Math.abs(p[0] - 71.5) < 1e-9);
    const face = drawn(band).quads.some((q) => atCrown(q) && q.some((p) => Math.abs(p[2] - 126) < 1e-9) && q.some((p) => Math.abs(p[2] - 116) < 1e-9) && new Set(q.map((p) => p[1])).size === 1);
    expect(face).toBe(true);
  });
});

describe('an elliptical arch (the double-arch bridge, 2026-11-10)', () => {
  const ell: DecorTruss = { kind: 'truss', fromMm: 15, toMm: 158, springMm: 23, crownMm: 126, innerCrownMm: 110, sideMm: 28.6, hangers: 0, elliptical: true, braced: false, band: true };

  /*
   * MUTATION PROOF, run (2026-11-10): `elliptical` ignored (circular):
   * `expected 76.36650485436893 to be close to 23`, the circle's formula
   * failing when the arch is taller than half its span.
   */
  it('stands upright at its springings and reaches its crown at the middle', () => {
    const outer = trussChord(ell, ell.crownMm);
    expect(outer(15)).toBeCloseTo(23, 9);
    expect(outer(86.5)).toBeCloseTo(126, 9);
    // 1mm in from a springing it is already 17 up; a parabola would be 3.
    expect(outer(16)).toBeGreaterThan(40);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): the band as deep all along as at the
   * crown (its legs meet the outer chord at the springing):
   * `expected 62.0223767647162 to be close to 23`.
   */
  it('keeps a band\'s legs as thick across as the arch shrunk to its inner crown leaves them', () => {
    const under = trussBandUnderside(ell);
    expect(under(86.5)).toBeCloseTo(110, 9);
    // Shrunk by 87/103 about the middle, the opening springs 71.5 x 16/103 = 11.1 in from each springing.
    const leg = (71.5 * 16) / 103;
    expect(under(15 + leg - 0.05)).toBeCloseTo(23, 9);
    expect(under(15 + leg + 0.5)).toBeGreaterThan(23 + 5);
    expect(under(158 - leg + 0.05)).toBeCloseTo(23, 9);
  });
});

describe('overlapping band arches draw as one plate (the double-arch bridge, 2026-11-10)', () => {
  const trusses = DOUBLE_ARCH_BRIDGE.decor!.filter((d): d is DecorTruss => d.kind === 'truss');
  const drawn = (t: DecorTruss, siblings?: readonly DecorTruss[]) => {
    const edges: [P3, P3][] = [];
    const pen: Pen = { quad: () => {}, edge: (a, b) => edges.push([a, b]), detail: () => {}, grow: () => {} };
    // Points come back along the piece, not the box: the box starts at the drawn stretch's start.
    const lo = t.drawnFromMm ?? t.fromMm;
    drawShape(t, { at: (a, y, z) => [a + lo, y, z], lengthMm: 0, floorMm: 0, roadTop: () => 12, plankMm: 12, ...(siblings ? { siblings } : {}) }, pen);
    return edges;
  };
  const inside = (o: DecorTruss) => ([p, q]: [P3, P3]) => {
    const a = (p[0] + q[0]) / 2, z = (p[2] + q[2]) / 2;
    return a > (o.drawnFromMm ?? o.fromMm) + 0.1 && a < (o.drawnToMm ?? o.toMm) - 0.1 && z > trussBandUnderside(o)(a) + 0.1 && z < trussChord(o, o.crownMm)(a) - 0.1;
  };

  /*
   * MUTATION PROOF, run (2026-11-10): nothing ever covered (every edge
   * drawn): `expected 52 to be +0 // Object.is equality`.
   */
  it('draws no edge of one arch inside the other, and none across a half arch\'s cut', () => {
    const [left, right, half] = trusses as [DecorTruss, DecorTruss, DecorTruss];
    expect(drawn(left).filter(inside(right)).length).toBeGreaterThan(0);
    expect(drawn(left, trusses).filter(inside(right)).length).toBe(0);
    const cut = (e: [P3, P3]) => Math.abs(e[0][0] - half.drawnFromMm!) < 1e-9 && Math.abs(e[1][0] - half.drawnFromMm!) < 1e-9;
    expect(drawn(half).filter(cut).length).toBeGreaterThan(0);
    expect(drawn(half, trusses).filter(cut).length).toBe(0);
  });

  /*
   * MUTATION PROOF, run (2026-11-10): an arch not left out of its own check
   * (its curved edges, drawn in straight pieces, dip inside it):
   * `expected 76 to be 184 // Object.is equality`.
   */
  it('still draws each arch\'s own outline where nothing covers it', () => {
    const [left] = trusses as [DecorTruss];
    // Short of 50.75, where the half arch's rib joins it and covers its inner edge.
    const top = (e: [P3, P3]) => (e[0][0] + e[1][0]) / 2 < 50;
    expect(drawn(left, trusses).filter(top).length).toBe(drawn(left).filter(top).length);
  });
});
