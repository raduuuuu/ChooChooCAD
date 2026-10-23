/**
 * WOOD ON WOOD (overlap.ts): planks crossing mid-span are found, and nothing
 * that is really buildable is.
 *
 * The bug this closes, reported by the owner 2026-10-23: two pieces laid over
 * each other drew as one merged shape that read as a switch or a crossing
 * piece, and the verdict said nothing, because the only overlap check was
 * ends landing on the same exact point.
 *
 * Both halves matter, as in graphFeasible.test.ts: a check that flags every
 * welded joint or a switch's own exits is as useless as no check.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { fromInt, add, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { connectorSites, findVertexClashes } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { clipConvex, findPlankOverlaps } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';
import type { Layout } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;

function overlaps(g: Graph) {
  const placement = placeAll(g, ports);
  const segs = renderGraph(g, ports, resolve, placement).segments;
  return findPlankOverlaps(g, segs, half, connectorSites(g, ports, placement));
}

/** A whole-mm position plus a heading in sixteenths of a turn. */
const at = (x: number, y: number, heading: number): Frame => ({
  pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc,
  heading,
});

const chain = (ids: string[], closed: boolean): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed,
});

describe('planks crossing are found', () => {
  /*
   * MUTATION PROOFS, run:
   * - `findPlankOverlaps` returns `[]`: every spec here fails, the plus sign
   *   with `expected [] to have a length of 1 but got +0`.
   * - the inside test in `clipConvex` flipped (`>= 0` to `<= 0`): the plus
   *   sign fails with `expected [] to have a length of 1 but got +0`.
   */
  it('two straights in a plus sign: one overlap, at the crossing, 40 x 40 mm', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'A' },
        { pieceId: 'b', partId: 'A' },
      ],
      welds: [],
      anchors: new Map([
        ['a', at(0, 0, 0)],
        ['b', at(72, -72, 4)],
      ]),
    };
    const found = overlaps(g);
    expect(found).toHaveLength(1);
    expect([found[0]!.a, found[0]!.b]).toEqual(['a', 'b']);
    expect(found[0]!.at[0]).toBeCloseTo(72, 6);
    expect(found[0]!.at[1]).toBeCloseTo(0, 6);
    expect(found[0]!.areaMm2).toBeCloseTo(40 * 40, 6);
  });

  it('a large curve laid across a straight, the reported "looks like a switch"', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 's', partId: 'D' },
        { pieceId: 'c', partId: 'E', turn: 'left' },
      ],
      welds: [],
      // Starts beside the straight and bends across it.
      anchors: new Map([
        ['s', at(0, 0, 0)],
        ['c', at(20, -100, 2)],
      ]),
    };
    expect(overlaps(g)).toHaveLength(1);
  });

  it('a run doubled back over itself is found once per pair of pieces', () => {
    // Four straights out, then a second run of four laid on top, reversed.
    const g: Graph = {
      pieces: [
        { pieceId: 'p', partId: 'D' },
        { pieceId: 'q', partId: 'D' },
      ],
      welds: [],
      anchors: new Map([
        ['p', at(0, 0, 0)],
        ['q', at(216, 10, 8)],
      ]),
    };
    const found = overlaps(g);
    expect(found).toHaveLength(1);
    // 30 mm of shared width over the full 216 mm length.
    expect(found[0]!.areaMm2).toBeCloseTo(30 * 216, 6);
  });
});

describe('buildable track is never flagged', () => {
  /*
   * MUTATION PROOFS, run:
   * - the weld exemption deleted: "a loop 54 mm too long" fails with
   *   `expected [ { a: 'p0', b: 'p10', …(2) } ] to deeply equal []`, its
   *   last piece lying on the first, which is the loop's gap and not a
   *   crossing.
   * - the shared-spot exemption deleted: "the 16xE double circle" fails
   *   with `expected [ { a: 'p0', b: 'p8', …(2) }, …(7) ] to deeply equal
   *   []`, every stacked pair reported a second time.
   */
  it.each([
    ['the exact circle', chain(Array(8).fill('E'), true)],
    ['the stadium', chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D'], true)],
    ['the near miss, whose loop is 72 mm short', chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'A'], true)],
    ['an S bend', chain(['E', 'E', 'A', 'E', 'E'], false)],
    // The extra straight BEFORE the last piece, so the last piece runs 54 mm
    // over the first with no end of either on a shared spot: only the weld
    // exempts it.
    ['a loop 54 mm too long', chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'A2', 'D'], true)],
  ])('%s', (_name, layout) => {
    expect(overlaps(graphFromChain(layout))).toEqual([]);
  });

  it('the 16xE double circle is its vertex clashes, not overlaps as well', () => {
    const g = graphFromChain(chain(Array(16).fill('E'), true));
    expect(findVertexClashes(g, ports, placeAll(g, ports))).toHaveLength(8);
    expect(overlaps(g)).toEqual([]);
  });

  it('two runs side by side, edges touching, are not an overlap', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'D' },
        { pieceId: 'b', partId: 'D' },
      ],
      welds: [],
      anchors: new Map([
        ['a', at(0, 0, 0)],
        ['b', at(0, 40, 0)],
      ]),
    };
    expect(overlaps(g)).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the same-piece exemption deleted: all four fail with
   * `expected [ { a: 'sw', b: 'sw', …(2) } ] to deeply equal []`, a switch's
   * two roads sharing their heel by design.
   */
  for (const sw of ['L', 'M', 'O1', 'P1']) {
    it(`switch ${sw} with a piece on every end, both roads carried on`, () => {
      const g: Graph = {
        pieces: [
          { pieceId: 'sw', partId: sw, turn: 'left' },
          { pieceId: 'in', partId: 'A' },
          { pieceId: 'main', partId: 'A' },
          { pieceId: 'main2', partId: 'A' },
          { pieceId: 'branch', partId: 'E', turn: 'left' },
          { pieceId: 'branch2', partId: 'A' },
        ],
        welds: [
          { a: { pieceId: 'in', port: 1 }, b: { pieceId: 'sw', port: 0 } },
          { a: { pieceId: 'sw', port: 1 }, b: { pieceId: 'main', port: 0 } },
          { a: { pieceId: 'main', port: 1 }, b: { pieceId: 'main2', port: 0 } },
          { a: { pieceId: 'sw', port: 2 }, b: { pieceId: 'branch', port: 0 } },
          { a: { pieceId: 'branch', port: 1 }, b: { pieceId: 'branch2', port: 0 } },
        ],
      };
      expect(overlaps(g)).toEqual([]);
    });
  }
});

describe('the clip', () => {
  it('two unit squares offset by half share half a square', () => {
    const sq = (x: number, y: number) => [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]] as const;
    const region = clipConvex(sq(0, 0), sq(0.5, 0));
    let a = 0;
    for (let i = 0; i < region.length; i++) {
      const [x1, y1] = region[i]!;
      const [x2, y2] = region[(i + 1) % region.length]!;
      a += x1 * y2 - x2 * y1;
    }
    expect(a / 2).toBeCloseTo(0.5, 12);
  });
});
