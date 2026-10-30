/**
 * BUFFER STOPS: the first parts with one end.
 *
 * Value: protects=R and S have one end at the entry, R a peg and S a socket;
 * no road; a body drawn and overlap-checked behind the end; joined like any
 * end, peg to socket; refused by the chain engine and by a two-ended
 * correction
 * Value: fails_when=the body is dropped from the drawing (so overlap cannot see
 * it), drawn the wrong way, given a road, or a buffer is walked as a straight
 * Value: why_new=no one-ended part existed
 * Value: seam=none: the real catalogue, placement, renderer and solver
 * Value: no_claim=the real body length, which is the piece table's 40, not a
 * measurement
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver, resolveLibrary } from '../data/library.js';
import { add, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { displacement } from '../src/geom/pose.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, roadsOf, type Frame, type Graph, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';
import type { Part } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece) => portsOf(resolve(piece.partId), piece.turn);
const solve = (g: Graph) => solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports));
const at = (x: number, y: number, heading: number): Frame => ({
  pos: add(scale(zetaPow(0), x), scale(zetaPow(4), y)) as Cyc,
  heading,
});
const round = (p: { x: number; y: number }) => [Math.round(p.x * 1e6) / 1e6 + 0, Math.round(p.y * 1e6) / 1e6 + 0];

describe('R and S', () => {
  it('have one end, at the entry: R a peg, S a socket, and no road', () => {
    for (const [id, polarity] of [['R', 'peg'], ['S', 'socket']] as const) {
      const p = portsOf(resolve(id));
      expect(p, id).toHaveLength(1);
      expect(p[0]!.at, id).toEqual({ pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 8 });
      expect(p[0]!.polarity, id).toBe(polarity);
      expect(roadsOf(resolve(id)), id).toEqual([]);
    }
  });

  /*
   * MUTATION PROOF, run: in render.ts run the body out of the end the way it
   * faces (`const along = norm16(end.heading)`). Fails with `expected [ [ +0,
   * +0 ], [ -40, +0 ] ] to deeply equal [ [ +0, +0 ], [ 40, +0 ] ]`, and the
   * two specs below fail with it.
   */
  it('draw a 40mm body behind the end, so overlap can see it', () => {
    const g: Graph = { pieces: [{ pieceId: 'r', partId: 'R' }], welds: [] };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    expect(r.segments).toHaveLength(1);
    expect([round(r.segments[0]!.from), round(r.segments[0]!.to)]).toEqual([[0, 0], [40, 0]]);
    expect(r.ports).toHaveLength(1);
  });
});

describe('a buffer stop on the track', () => {
  /** A's far end is a peg at (144, 0): S goes on facing back along A. */
  const onTheEnd = (partId: string): Graph => ({
    pieces: [{ pieceId: 'a', partId: 'A' }, { pieceId: 'b', partId }],
    welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 0 } }],
  });

  it('S closes off a peg end: joined, no clash, no overlap, one open end left', () => {
    const r = solve(onTheEnd('S'));
    expect(r.polarityViolations).toEqual([]);
    expect(r.clashes).toEqual([]);
    expect(r.overlaps).toEqual([]);
    const g = onTheEnd('S');
    const drawn = renderGraph(g, ports, resolve, placeAll(g, ports));
    // The body runs on past the end, away from A.
    const body = drawn.segments.find((s) => s.pieceId === 'b')!;
    expect([round(body.from), round(body.to)]).toEqual([[144, 0], [184, 0]]);
    expect(drawn.ports.filter((p) => p.free)).toHaveLength(1);
  });

  it('R on a peg end is peg to peg, which cannot be built', () => {
    expect(solve(onTheEnd('R')).polarityViolations).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: drop the buffer's body from render.ts (delete the
   * `part.kind === 'buffer'` branch). Fails with `expected [] to deep
   * equally contain [ 'a', 'b' ]`: nothing sees the wood.
   */
  it('its body lying across another straight is an overlap', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'a', partId: 'A' }, { pieceId: 'b', partId: 'S' }],
      welds: [],
      // End at (72, -20) facing down, body running up across A's middle.
      anchors: new Map([['b', at(72, -20, 4)]]),
    };
    expect(solve(g).overlaps.map((o) => [o.a, o.b])).toContainEqual(['a', 'b']);
  });
});

describe('what refuses a buffer stop', () => {
  it('the chain engine, which has only two-ended pieces', () => {
    expect(() => displacement(resolve('R'), 0)).toThrowError(/R has 1 end/);
  });

  it('a two-ended correction under its id', () => {
    const r = resolve('R');
    if (r.kind !== 'buffer') throw new Error('R is not a buffer stop');
    const a = resolve('A') as Extract<Part, { kind: 'straight' }>;
    const lib = resolveLibrary([
      {
        submissionId: 'sub-r',
        at: '2026-10-30T10:00:00Z',
        part: {
          ...a,
          id: 'R',
          dimensions: { status: 'user-measured', source: 'test', submittedAt: '2026-10-30T10:00:00Z', corroborations: 1 },
        },
      },
    ]);
    expect(lib.find((p) => p.id === 'R')!.kind).toBe('buffer');
  });
});
