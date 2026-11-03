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
