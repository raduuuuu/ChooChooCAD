/**
 * MULTI-ROAD PIECES (eng review of 2026-10-30, docs/plan/2026-10-29-makerworld-pieces.md).
 *
 * Value: protects=every built-in multi-road piece's roads land EXACTLY on the
 * ends it lists (D9); the mirror is exact; a crossing draws two roads between
 * its own ends (D5); two roads, not two pieces, decide a pile-up (D12); a
 * loop through a crossing closes and a straight laid across it overlaps
 * Value: fails_when=a port pose, road length, radius or side is mistyped; conj
 * drops a sign; render goes back to drawing from port 0; the pile-up goes
 * back to counting per piece
 * Value: why_new=no multi-road kind existed before this change
 * Value: seam=none: the real catalogue, placement, renderer and solver; the
 * double-track piece below is test-local because the real one (EE) is in
 * the next change
 * Value: no_claim=that any reproduction matches real BRIO track
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { add, conj, equals, scale, toXY, zetaPow, ZERO, type Cyc } from '../src/geom/cyclotomic.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, roadEnd, roadsOf, type Frame, type Graph, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';
import type { MultiRoadPart, Part } from '../src/parts/schema.js';

const builtIn = makeResolver(BUILT_IN);
const MULTI = BUILT_IN.filter((p): p is MultiRoadPart => p.kind === 'multi-road');
const at = (x: number, y: number, heading: number): Frame => ({
  pos: add(scale(zetaPow(0), x), scale(zetaPow(4), y)) as Cyc,
  heading,
});

describe('every road lands exactly on the end it names (D9)', () => {
  it('the catalogue has the four switches and the H crossing', () => {
    expect(MULTI.map((p) => p.id)).toEqual(['L', 'M', 'O1', 'P1', 'H']);
  });

  /*
   * MUTATION PROOFS, run:
   * - H's second road's far end at `xy(54, 55)`: fails with `H road 2-3
   *   left: expected false to be true` (and the drawing spec below).
   * - L built with `curvedEnd` of an E1 ([0, 0, 0, 0, 110, 0, -110, 0]):
   *   fails with `L road 0-2 left: expected false to be true`.
   */
  it('walking each road from its start end, both ways up', () => {
    for (const part of MULTI) {
      for (const turn of ['left', 'right'] as const) {
        const ends = portsOf(part, turn);
        for (const road of roadsOf(part, turn)) {
          const got = roadEnd(ends[road.from]!.at, road.shape, part.plankWidthMm);
          const want = ends[road.to]!.at;
          const label = `${part.id} road ${road.from}-${road.to} ${turn}`;
          expect(equals(got.pos, want.pos) && got.heading === want.heading, label).toBe(true);
        }
      }
    }
  });

  it('end 0 is the entry pose, there are three ends or more, and every end is on a road', () => {
    for (const part of MULTI) {
      expect(equals(part.ports[0]!.at.pos, ZERO), part.id).toBe(true);
      expect(part.ports[0]!.at.heading, part.id).toBe(8);
      expect(part.ports.length, part.id).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < part.ports.length; i++) {
        expect(part.roads.some((r) => r.from === i || r.to === i), `${part.id} end ${i}`).toBe(true);
      }
    }
  });
});

describe('the mirror is exact', () => {
  /*
   * MUTATION PROOF, run: drop the minus sign in `conj` (`out[DEG - k] =
   * a[k]!`). Fails with `zeta^1 x: expected -0.9238795325112867 to be close
   * to 0.9238795325112867`, and the road walk above with `L road 0-2 right:
   * expected false to be true`.
   */
  it('conj reflects every heading across the x axis, and twice is nothing', () => {
    for (let k = 0; k < 16; k++) {
      const [x, y] = toXY(zetaPow(k));
      const [mx, my] = toXY(conj(zetaPow(k)));
      expect(mx, `zeta^${k} x`).toBeCloseTo(x, 12);
      expect(my, `zeta^${k} y`).toBeCloseTo(-y, 12);
    }
    const a: Cyc = [3, -1, 4, 1, -5, 9, 2, -6];
    expect(conj(conj(a))).toEqual(a);
  });
});

describe('the H crossing', () => {
  const H = builtIn('H');
  const ports = (piece: Piece) => portsOf(builtIn(piece.partId), piece.turn);
  const one: Graph = { pieces: [{ pieceId: 'h', partId: 'H' }], welds: [] };

  /*
   * MUTATION PROOF, run: in render.ts draw every road from port 0 (`const
   * start = portFrame(placement, ports, piece, 0)`). Fails with `expected
   * { x: +0, y: +0, h: +0 } to deeply equal { Object (x, y, ...) }`. The
   * frozen switches stay green under it, because every switch road starts
   * at the heel: that is why the crossing has to be here.
   */
  it('draws two straight roads between its own ends, crossing at the middle (D5)', () => {
    const r = renderGraph(one, ports, builtIn, placeAll(one, ports));
    const round = (p: { x: number; y: number; h: number }) => ({
      x: Math.round(p.x * 1e9) / 1e9 + 0,
      y: Math.round(p.y * 1e9) / 1e9 + 0,
      h: p.h,
    });
    expect(r.segments.map((s) => s.kind)).toEqual(['straight', 'straight']);
    expect(round(r.segments[0]!.from)).toEqual({ x: 0, y: 0, h: 0 });
    expect(round(r.segments[0]!.to)).toEqual({ x: 108, y: 0, h: 0 });
    expect(round(r.segments[1]!.from)).toEqual({ x: 54, y: -54, h: Math.PI / 2 });
    expect(round(r.segments[1]!.to)).toEqual({ x: 54, y: 54, h: Math.PI / 2 });
    expect(r.ports).toHaveLength(4);
  });

  it('carries its measured pegs and sockets: each road runs peg to socket', () => {
    expect(portsOf(H).map((p) => p.polarity)).toEqual(['peg', 'socket', 'peg', 'socket']);
  });

  /*
   * A stadium whose one straight is the crossing's first road: H, four E,
   * A1, four E, back into H. A1 is 108 like H's road, so it closes exactly,
   * and the crossing's second road hangs free on both sides.
   */
  it('closes a loop through one road like any straight', () => {
    const pieces: Piece[] = [
      { pieceId: 'h', partId: 'H' },
      ...[0, 1, 2, 3].map((i) => ({ pieceId: `a${i}`, partId: 'E' })),
      { pieceId: 's', partId: 'A1' },
      ...[0, 1, 2, 3].map((i) => ({ pieceId: `b${i}`, partId: 'E' })),
    ];
    const chain = ['h', 'a0', 'a1', 'a2', 'a3', 's', 'b0', 'b1', 'b2', 'b3'];
    const welds = chain.slice(0, -1).map((id, i) => ({
      a: { pieceId: id, port: 1 },
      b: { pieceId: chain[i + 1]!, port: 0 },
    }));
    welds.push({ a: { pieceId: 'b3', port: 1 }, b: { pieceId: 'h', port: 0 } });
    const g: Graph = { pieces, welds };
    const r = solveGraph(g, ports, builtIn, () => 0.8, placeAll(g, ports));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.closesExactly).toBe(true);
    expect(r.clashes).toEqual([]);
    expect(r.overlaps).toEqual([]);
  });

  it('overlaps a straight laid along its second road without touching its ends', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'h', partId: 'H' }, { pieceId: 'a', partId: 'A' }],
      welds: [],
      anchors: new Map([['a', at(54, -72, 4)]]),
    };
    const r = solveGraph(g, ports, builtIn, () => 0.8, placeAll(g, ports));
    expect(r.overlaps.map((o) => [o.a, o.b])).toContainEqual(['a', 'h']);
  });
});

/*
 * TWO ROADS ON TOP OF EACH OTHER, NOT TWO PIECES (D12).
 *
 * A test-local double track: two parallel 108 straights, 46 apart, one piece.
 * EE is this shape with curves and arrives in the next change; the rule is
 * the same, so it is tested here on the plainest piece that shows it.
 */
describe('the pile-up rule counts roads', () => {
  const DT: MultiRoadPart = {
    ...(builtIn('H') as MultiRoadPart),
    id: 'TEST-DOUBLE',
    ports: [
      { at: at(0, 0, 8), polarity: 'socket', name: 'inner start' },
      { at: at(108, 0, 0), polarity: 'peg', name: 'inner end' },
      { at: at(0, 46, 8), polarity: 'socket', name: 'outer start' },
      { at: at(108, 46, 0), polarity: 'peg', name: 'outer end' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 108 } },
      { from: 2, to: 3, shape: { kind: 'straight', lengthMm: 108 } },
    ],
  };
  const resolve = (id: string): Part => (id === DT.id ? DT : builtIn(id));
  const ports = (piece: Piece) => portsOf(resolve(piece.partId), piece.turn);
  const clashesOf = (g: Graph) => solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports)).clashes;

  /*
   * MUTATION PROOF, run: in feasible.ts take every other end of the piece
   * instead of the road's (`const others = own.map((_, j) => j).filter((j)
   * => j !== port)`). Fails with `expected [ { …(3) }, { …(3) } ] to deeply
   * equal []`: the two meeting double tracks become a pile-up.
   */
  it('two double tracks laid end to end, joints open, are not a pile-up', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'p', partId: DT.id }, { pieceId: 'q', partId: DT.id }],
      welds: [],
      anchors: new Map([['q', at(108, 0, 0)]]),
    };
    expect(clashesOf(g)).toEqual([]);
  });

  it('two double tracks on top of each other are, at all four ends', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'p', partId: DT.id }, { pieceId: 'q', partId: DT.id }],
      welds: [],
      anchors: new Map([['q', at(0, 0, 0)]]),
    };
    expect(clashesOf(g)).toHaveLength(4);
  });

  it('a straight lying on one road of a switch is still a pile-up', () => {
    const g: Graph = { pieces: [{ pieceId: 'l', partId: 'L' }, { pieceId: 'a', partId: 'A' }], welds: [] };
    expect(clashesOf(g).map((c) => c.at.map(Math.round))).toEqual([[0, 0], [144, 0]]);
  });
});
