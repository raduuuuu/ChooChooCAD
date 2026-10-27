/**
 * THE ASSEMBLY ORDER (K3; the prerequisite the 3D viewer, build mode and the
 * printable sheet wait on).
 *
 * Value: protects=floor track a bridge passes over goes down before the
 * bridge; a ramp goes down before the raised track it holds up, and raised
 * track grows out from it rather than starting in mid-air; each piece clips
 * onto one already down where it can; every piece appears exactly once
 * Value: fails_when=the order follows declaration or forest order alone, a
 * raised run starts at its far end, or ramps are laid with the floor
 * Value: why_new=no assembly order existed
 * Value: seam=none (pure engine): the real placement, renderer and
 * `findBridges`, which is the oracle for "under before over"
 * Value: no_claim=supports and piers, which are not modelled
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { assemblyOrder } from '../src/graph/assembly.js';
import { connectorSites } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { findBridges } from '../src/graph/overlap.js';
import { renderGraph } from '../src/graph/render.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;

const at = (x: number, y: number, heading: number): Frame => ({
  pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc,
  heading,
});

const segmentsOf = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports)).segments;
const order = (g: Graph) => assemblyOrder(g, segmentsOf(g));
const ids = (g: Graph) => order(g).map((s) => s.pieceId);

/**
 * Up a ramp, round a raised half circle, down a ramp: E E E E N E E E E N,
 * the second ramp entered at its high end. p0-p3 are on the floor, p4 and p9
 * are the ramps, p5-p8 are raised.
 */
function stadium(): Graph {
  const parts: [string, 0 | 1][] = [
    ['E', 0], ['E', 0], ['E', 0], ['E', 0], ['N', 0],
    ['E', 0], ['E', 0], ['E', 0], ['E', 0], ['N', 1],
  ];
  const pieces: Piece[] = parts.map(([partId], i) => ({ pieceId: `p${i}`, partId, turn: 'left' }));
  const welds: Weld[] = parts.map((_, i) => {
    const j = (i + 1) % parts.length;
    return { a: { pieceId: `p${i}`, port: 1 - parts[i]![1] }, b: { pieceId: `p${j}`, port: parts[j]![1] } };
  });
  return { pieces, welds };
}

/**
 * The stadium with a floor straight laid under its raised half, DECLARED
 * LAST, so declaration order and forest order would both put it after the
 * bridge over it.
 */
function bridged(): Graph {
  const g = stadium();
  const raised = segmentsOf(g).find((s) => s.pieceId === 'p6')!;
  const [x, y] = [(raised.from.x + raised.to.x) / 2, (raised.from.y + raised.to.y) / 2];
  return {
    pieces: [...g.pieces, { pieceId: 'f', partId: 'A', turn: 'left' }],
    welds: g.welds,
    anchors: new Map([['f', at(Math.round(x), Math.round(y) - 72, 4)]]),
  };
}

describe('under before over', () => {
  /*
   * MUTATION PROOF, run: every piece in one band (`band` returning 0): fails
   * with `expected 11 to be less than 7`, the floor straight laid after the
   * deck over it.
   */
  it('floor track a bridge passes over is down before the bridge', () => {
    const g = bridged();
    const segs = segmentsOf(g);
    const place = placeAll(g, ports);
    const bridges = findBridges(g, segs, half, connectorSites(g, ports, place));
    // Not vacuous: the fixture really has the straight under the deck.
    expect(bridges.some((b) => b.a === 'f' || b.b === 'f')).toBe(true);

    const step = new Map(assemblyOrder(g, segs).map((s, i) => [s.pieceId, i + 1]));
    const levelOfPiece = new Map(assemblyOrder(g, segs).map((s) => [s.pieceId, s.level]));
    for (const { a, b } of bridges) {
      const [under, over] = levelOfPiece.get(a)! < levelOfPiece.get(b)! ? [a, b] : [b, a];
      expect(step.get(under)!).toBeLessThan(step.get(over)!);
    }
  });
});

describe('nothing raised before what holds it up', () => {
  it('the stadium: the floor walked in order, both ramps, then the deck between them', () => {
    const steps = order(stadium());
    expect(steps.map((s) => s.pieceId)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p9', 'p5', 'p6', 'p7', 'p8']);
    expect(steps.map((s) => s.phase)).toEqual([
      'floor', 'floor', 'floor', 'floor', 'ramp', 'ramp', 'raised', 'raised', 'raised', 'raised',
    ]);
    // The first ramp clips onto the floor's end, the second onto its start;
    // the last deck piece closes onto both its neighbours.
    expect(steps[4]!.joins).toEqual(['p3']);
    expect(steps[5]!.joins).toEqual(['p0']);
    expect(steps[9]!.joins).toEqual(['p7', 'p9']);
  });

  /*
   * A dead-end climb declared from its far end: raised r2, raised r1, the
   * ramp, the floor straight. Forest order starts at r2, in mid-air.
   *
   * MUTATION PROOFS, run:
   * - no preference for pieces joined to something down (`for (const start
   *   of members)`): fails with `expected [ 'f', 'n', 'r2', 'r1' ] to deeply
   *   equal [ 'f', 'n', 'r1', 'r2' ]`.
   * - ramps laid with the floor (`bandOf` returning `2 * lo` for a ramp too):
   *   fails with `expected [ 'n', 'f', 'r1', 'r2' ] to deeply equal [ 'f',
   *   'n', 'r1', 'r2' ]`.
   */
  it('raised track grows out from the ramp top, never from its far end', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'r2', partId: 'A', turn: 'left' },
        { pieceId: 'r1', partId: 'A', turn: 'left' },
        { pieceId: 'n', partId: 'N', turn: 'left' },
        { pieceId: 'f', partId: 'A', turn: 'left' },
      ],
      welds: [
        { a: { pieceId: 'r2', port: 0 }, b: { pieceId: 'r1', port: 1 } },
        { a: { pieceId: 'r1', port: 0 }, b: { pieceId: 'n', port: 1 } },
        { a: { pieceId: 'n', port: 0 }, b: { pieceId: 'f', port: 1 } },
      ],
    };
    const steps = order(g);
    expect(steps.map((s) => s.pieceId)).toEqual(['f', 'n', 'r1', 'r2']);
    expect(steps.map((s) => s.joins)).toEqual([[], ['f'], ['n'], ['r1']]);
  });
});

describe('every piece once, each onto one already down', () => {
  it('loose pieces and runs together: each laid once, joins name only earlier steps', () => {
    const g = bridged();
    const extra: Graph = {
      pieces: [...g.pieces, { pieceId: 'x', partId: 'D', turn: 'left' }],
      welds: g.welds,
      anchors: new Map([...(g.anchors ?? []), ['x', at(2000, 2000, 0)]]),
    };
    const steps = order(extra);
    expect([...steps.map((s) => s.pieceId)].sort()).toEqual([...extra.pieces.map((p) => p.pieceId)].sort());
    const seen = new Set<string>();
    for (const s of steps) {
      for (const j of s.joins) expect(seen.has(j)).toBe(true);
      seen.add(s.pieceId);
    }
    // Three start runs of their own: the loop's floor, and each loose piece.
    expect(steps.filter((s) => s.joins.length === 0).map((s) => s.pieceId)).toEqual(['p0', 'f', 'x']);
  });

  it('an empty layout has no steps', () => {
    expect(ids({ pieces: [], welds: [] })).toEqual([]);
  });
});
