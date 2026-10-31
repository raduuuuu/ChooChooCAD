/**
 * THE 3D VIEW'S WOOD, FROM THE 2D DRAWING (docs/plan/2026-10-31-3d-viewer.md,
 * eng D20-D25, design 16A-19A, 25A).
 *
 * Value: protects=planks sit at their measured heights, ramps slope straight
 * between their ends' levels, curves follow their centreline radius, grooves
 * are painted at +-gauge/2 only where a width is published, buffer beams,
 * seams, raised footprints and the slab are where the plan says, and every
 * mark sits on the wood it is about
 * Value: fails_when=a height, radius, offset or rule in buildScene changes
 * Value: why_new=no 3D geometry existed
 * Value: seam=none (pure arrays, no three, node project)
 * Value: no_claim=how any of it looks on screen; that is the viewer and the
 * browser pass (eng D15, design 24A)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { fromInt } from '../src/geom/cyclotomic.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import { buildScene, ARC_STEP_RAD, BEAM_DEPTH_MM, GROOVE_LIFT_MM, SEAM_OVERHANG_MM, SLAB_NOMINAL_MM, type MarkInput, type Mesh } from '../src/view3d/mesh.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const RISE = 64;
const PLANK = 12;

/** An open run of catalogue parts, each joined end to start, anchored at the origin. */
const run = (ids: readonly string[], turn: 'left' | 'right' = 'left'): Graph => ({
  pieces: ids.map((partId, i) => ({ pieceId: `p${i}`, partId, turn })),
  welds: ids.slice(1).map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${i + 1}`, port: 0 } })),
  anchors: new Map([['p0', { pos: fromInt(0), heading: 0 }]]),
});

function scene(g: Graph, extra: { marks?: readonly MarkInput[]; table?: Parameters<typeof buildScene>[0]['table']; highlight?: string } = {}) {
  const r = renderGraph(g, ports, resolve, placeAll(g, ports));
  const partOf = (id: string) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId);
  return { r, s: buildScene({ segments: r.segments, ports: r.ports, welds: g.welds, partOf, riseMm: RISE, plankMm: PLANK, ...extra }) };
}

const verts = (m: Mesh): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < m.positions.length; i += 3) out.push([m.positions[i]!, m.positions[i + 1]!, m.positions[i + 2]!]);
  return out;
};
const round = (n: number) => Math.round(n * 1000) / 1000;

describe('plank heights', () => {
  it('a floor straight is a 12mm plank from 0 to its length, 40mm wide', () => {
    const { s } = scene(run(['A']));
    expect(new Set(verts(s.plankTop).map((v) => round(v[2])))).toEqual(new Set([PLANK]));
    expect(s.bounds.min.map(round)).toEqual([0, -20, 0]);
    expect(s.bounds.max.map(round)).toEqual([144, 20, PLANK]);
  });

  /*
   * MUTATION PROOF, run: `endLevels` returns `[0, 0]`:
   * `expected [ [ 12 ], [ 12 ] ] to deeply equal [ [ 12 ], [ 76 ] ]`.
   */
  it('a ramp slopes straight from the floor to the raised level, and the track after it is raised', () => {
    const { s } = scene(run(['A', 'N', 'A']));
    const top = verts(s.plankTop);
    // The ramp runs x 144..360: its top at each end, and halfway.
    const at = (x: number) => [...new Set(top.filter((v) => Math.abs(v[0] - x) < 1e-6).map((v) => round(v[2])))].sort((a, b) => a - b);
    // A straight has a cross-section at each end only; halfway is pinned by the overlap mark below.
    expect([at(144), at(360)]).toEqual([[PLANK], [RISE + PLANK]]);
    // The raised straight after it, x 360..504, is all at the raised top.
    expect(new Set(top.filter((v) => v[0] > 360 + 1e-6).map((v) => round(v[2])))).toEqual(new Set([RISE + PLANK]));
  });
});

describe('curves', () => {
  /*
   * MUTATION PROOF, run: `stations` always puts the centre on the left
   * (`side` dropped from the centre): `expected false to be true`, on the
   * right-hand E only. A left-hand E alone did not catch it (run, survived).
   */
  it.each(['left', 'right'] as const)('an E turned %s follows its centreline radius, in steps of at most 3.75 degrees', (turn) => {
    const { r, s } = scene(run(['E'], turn));
    const seg = r.segments[0]!;
    const rad = seg.centrelineRadiusMm!;
    // The centre is on the side the curve turns toward.
    const k = seg.sweep === 'left' ? 1 : -1;
    const cx = seg.from.x - Math.sin(seg.from.h) * rad * k;
    const cy = seg.from.y + Math.cos(seg.from.h) * rad * k;
    const ok = verts(s.plankTop).every((v) => {
      const d = Math.hypot(v[0] - cx, v[1] - cy);
      return Math.abs(d - (rad - 20)) < 1e-3 || Math.abs(d - (rad + 20)) < 1e-3;
    });
    expect(ok).toBe(true);
    const quads = s.plankTop.indices.length / 6;
    expect(quads).toBeGreaterThanOrEqual(Math.ceil(Math.PI / 4 / ARC_STEP_RAD));
  });
});

describe('painted grooves (eng D22)', () => {
  it('two strips at +-13mm, 6mm wide, just proud of the top', () => {
    const { s } = scene(run(['A']));
    const ys = [...new Set(verts(s.grooves).map((v) => round(v[1])))].sort((a, b) => a - b);
    expect(ys).toEqual([-16, -10, 10, 16]);
    expect(new Set(verts(s.grooves).map((v) => round(v[2])))).toEqual(new Set([round(PLANK + GROOVE_LIFT_MM)]));
  });

  /*
   * MUTATION PROOF, run: the `grooveWidthMm !== undefined` guard removed:
   * `expected 12 to be +0`.
   */
  it('none on a part whose groove width nobody published', () => {
    expect(resolve('IKEA-150').grooveWidthMm).toBeUndefined();
    const { s } = scene(run(['IKEA-150']));
    expect(s.grooves.indices.length).toBe(0);
  });
});

describe('the rest of the scene', () => {
  it('a buffer stop has its ink beam at the barrier, 6mm deep and a plank high above the top', () => {
    const { s } = scene(run(['A', 'S']));
    const b = verts(s.beams);
    expect(b.length).toBeGreaterThan(0);
    const xs = b.map((v) => round(v[0]));
    expect(Math.max(...xs) - Math.min(...xs)).toBe(BEAM_DEPTH_MM);
    expect(new Set(b.map((v) => round(v[2])))).toEqual(new Set([PLANK, 2 * PLANK]));
  });

  it('a seam crosses the top at each joint, past both edges', () => {
    const { s } = scene(run(['A', 'A', 'A']));
    const p = s.seams.positions;
    expect(p.length).toBe(2 * 6);
    expect(round(Math.hypot(p[3]! - p[0]!, p[4]! - p[1]!))).toBe(40 + 2 * SEAM_OVERHANG_MM);
    expect(round(p[2]!)).toBe(round(PLANK + GROOVE_LIFT_MM));
  });

  it('a footprint lies under raised wood only, a ramp tapering to nothing at its floor end', () => {
    const floorOnly = scene(run(['A', 'A'])).s;
    expect(floorOnly.footprints.indices.length).toBe(0);
    const { s } = scene(run(['A', 'N', 'A']));
    const f = verts(s.footprints);
    const widthAt = (x: number) => {
      const ys = f.filter((v) => Math.abs(v[0] - x) < 1e-6).map((v) => v[1]);
      return round(Math.max(...ys) - Math.min(...ys));
    };
    expect(widthAt(144)).toBe(0);
    expect(widthAt(504)).toBe(40);
  });

  it('the slab is the table outline at floor height, 20mm (nominal) thick', () => {
    const outline = [[-100, -100], [600, -100], [600, 100], [-100, 100]] as const;
    const { s } = scene(run(['A']), { table: { outline, overhang: false } });
    expect(s.slab).not.toBeNull();
    expect(new Set(verts(s.slab!.top).map((v) => v[2]))).toEqual(new Set([0]));
    expect(Math.min(...verts(s.slab!.side).map((v) => v[2]))).toBe(-SLAB_NOMINAL_MM);
    expect(scene(run(['A'])).s.slab).toBeNull();
  });

  /*
   * MUTATION PROOF, run: a multi-segment piece's range is overwritten instead
   * of grown (`pieceRanges.set` always): `expected 90 to be 96`.
   */
  it("every top triangle belongs to exactly one piece's range", () => {
    const { s } = scene(run(['A', 'E', 'H', 'A']));
    const total = [...s.pieceRanges.values()].reduce((n, r) => n + r.count, 0);
    expect(total).toBe(s.plankTop.indices.length);
  });
});

describe('marks sit on their wood (eng D21, D25, design 16A)', () => {
  const g = run(['A', 'N', 'A']);

  it('a joint mark at its end’s level; a level fault as a line between two levels; a ramp mark at its high end', () => {
    const marks: MarkInput[] = [
      { kind: 'gap', at: [504, 0], source: { kind: 'weld', a: { pieceId: 'p2', port: 1 } } },
      { kind: 'level', at: [144, 0], source: { kind: 'levels', a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p2', port: 0 } } },
      { kind: 'third', at: [360, 0], source: { kind: 'ramp', pieceId: 'p1' } },
    ];
    const { s } = scene(g, { marks });
    expect(s.marks[0]!.at[2]).toBe(RISE + PLANK);
    expect([s.marks[1]!.at[2], s.marks[1]!.lineTo]).toEqual([RISE + PLANK, PLANK]);
    expect(s.marks[2]!.at[2]).toBe(RISE + PLANK);
  });

  /*
   * MUTATION PROOF, run: an overlap mark placed on piece `a` alone
   * (`topAtPiece(src.a, x, y)`): `expected 12 to be close to 44, received
   * difference is 32, but expected 5e-7`.
   * Piece `a` is the floor straight here, `b` the ramp: before eng D25 the
   * mark sat on whichever id sorted first.
   */
  it('an overlap halfway up a ramp sits on the ramp there, not on the floor piece', () => {
    const marks: MarkInput[] = [{ kind: 'overlap', at: [252, 0], source: { kind: 'overlap', a: 'p0', b: 'p1' } }];
    const { s } = scene(g, { marks });
    // Halfway along the ramp: underside 32, top 44.
    expect(s.marks[0]!.at[2]).toBeCloseTo(RISE / 2 + PLANK, 6);
  });
});

describe("build mode's next piece (build mode plan D23, D42)", () => {
  /*
   * MUTATION PROOF, run: `isNext` always false (the next piece drawn with
   * the rest): `expected 0 to be greater than 0`.
   */
  it('the highlighted piece is drawn apart, top, sides and grooves, and the rest keep the remaining triangles', () => {
    const g = run(['A', 'A', 'A']);
    const plain = scene(g).s;
    const { s } = scene(g, { highlight: 'p1' });
    expect(s.next).not.toBe(null);
    expect(s.next!.top.indices.length).toBeGreaterThan(0);
    expect(s.next!.side.indices.length).toBeGreaterThan(0);
    expect(s.next!.grooves.indices.length).toBeGreaterThan(0);
    // Its top is no longer in the shared top, and every other triangle is.
    expect(s.plankTop.indices.length + s.next!.top.indices.length).toBe(plain.plankTop.indices.length);
    expect(s.pieceRanges.has('p1')).toBe(false);
    // Its top sits between 144 and 288 along the run.
    const xs = verts(s.next!.top).map((v) => round(v[0]));
    expect(Math.min(...xs)).toBe(144);
    expect(Math.max(...xs)).toBe(288);
  });

  /*
   * MUTATION PROOF, run: `painted` ignores the highlight (every piece keeps
   * its grooves): `expected 24 to be +0 // Object.is equality`.
   */
  it('every other piece loses its grooves; without a highlight nothing changes', () => {
    const g = run(['A', 'A', 'A']);
    expect(scene(g, { highlight: 'p1' }).s.grooves.indices.length).toBe(0);
    const plain = scene(g).s;
    expect(plain.next).toBe(null);
    expect(plain.grooves.indices.length).toBeGreaterThan(0);
  });

  it("the next piece's top is outlined: both long edges and both ends, just proud of the top", () => {
    const { s } = scene(run(['A']), { highlight: 'p0' });
    const e = s.next!.edge.positions;
    // A straight: one station pair, two long edges and two ends, two points each.
    expect(e.length / 6).toBe(4);
    for (let i = 2; i < e.length; i += 3) expect(round(e[i]!)).toBe(round(PLANK + GROOVE_LIFT_MM));
  });

  /*
   * MUTATION PROOF, run: `grow` stops widening the piece's own box
   * (`if (false && boxOf)`): `expected [ +0, +0, +0 ] to deeply equal
   * [ 144, -20, +0 ]`, every box left empty and read as the origin.
   */
  it('each piece has its own box, for framing a step on it', () => {
    const { s } = scene(run(['A', 'A']));
    expect(s.pieceBounds.get('p1')!.min.map(round)).toEqual([144, -20, 0]);
    expect(s.pieceBounds.get('p1')!.max.map(round)).toEqual([288, 20, PLANK]);
  });

  /*
   * MUTATION PROOF, run: `boxOf = null` after the segment loop removed (the
   * slab then grows the last piece's box): `expected [ -50, -300, -20 ] to
   * deeply equal [ 144, -20, +0 ]`.
   */
  it("the table never widens the last piece's box", () => {
    const table = { outline: [[-50, -300], [900, -300], [900, 300], [-50, 300]] as [number, number][], overhang: false };
    const { s } = scene(run(['A', 'A']), { table });
    expect(s.pieceBounds.get('p1')!.min.map(round)).toEqual([144, -20, 0]);
  });

  it('a join ring sits on the end it marks, at that end\'s height (D43)', () => {
    const g = run(['A', 'N', 'A']);
    const { s } = scene(g, { marks: [{ kind: 'join', at: [360, 0], source: { kind: 'weld', a: { pieceId: 'p1', port: 1 } } }] });
    expect(s.marks[0]).toEqual({ kind: 'join', at: [360, 0, RISE + PLANK] });
  });
});
