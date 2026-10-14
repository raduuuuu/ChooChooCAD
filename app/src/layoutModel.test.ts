import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { findVertexClashes } from '../../engine/src/graph/feasible.js';
import { placeAll, residuals, closesExactly } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import {
  EMPTY_GRAPH,
  addPiece,
  deletePiece,
  isFree,
  lastPieceId,
  newPieceId,
  weldEnds,
} from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const countFor = (partId: string) => portsOf(resolve(partId)).length;

/** Build a run by clicking: attach each piece to the previously offered end. */
function run(partIds: string[]) {
  let graph = EMPTY_GRAPH;
  let select: ReturnType<typeof addPiece>['select'] = null;
  for (const id of partIds) {
    const next = addPiece(graph, id, 'left', countFor(id), select, ports);
    graph = next.graph;
    select = next.select;
  }
  return { graph, select };
}

describe('free-end clicking', () => {
  it('the first piece starts a run with nothing selected', () => {
    const { graph } = addPiece(EMPTY_GRAPH, 'A', 'left', 2, null, ports);
    expect(graph.pieces).toHaveLength(1);
    expect(graph.welds).toHaveLength(0);
  });

  it('each piece attaches to the end offered by the last', () => {
    const { graph } = run(['E', 'E', 'E']);
    expect(graph.pieces).toHaveLength(3);
    expect(graph.welds).toHaveLength(2);
    // A run, not a pile: every piece after the first is joined to one before.
    expect(placeAll(graph, ports).forest.roots).toHaveLength(1);
  });

  it('clicking with nothing selected starts a SEPARATE run', () => {
    const a = run(['E', 'E']);
    const b = addPiece(a.graph, 'A', 'left', 2, null, ports);
    // Two components: the thing a chain could never hold.
    expect(placeAll(b.graph, ports).forest.roots).toHaveLength(2);
  });

  /*
   * CLOSING A LOOP IS A WELD NOW, not a checkbox. Eight curves and then the
   * two free ends joined to each other, which is what the user actually does
   * with real track.
   */
  it('welding the two free ends of eight curves closes the circle exactly', () => {
    const { graph } = run(Array(8).fill('E'));
    const first = { pieceId: graph.pieces[0]!.pieceId, port: 0 };
    const last = { pieceId: graph.pieces[7]!.pieceId, port: 1 };
    expect(isFree(graph, first)).toBe(true);
    expect(isFree(graph, last)).toBe(true);

    const closed = weldEnds(graph, last, first);
    expect(closed.welds).toHaveLength(8);
    const place = placeAll(closed, ports);
    expect(place.forest.closing).toHaveLength(1);
    expect(closesExactly(residuals(closed, ports, place))).toBe(true);
  });

  it('a port cannot be welded twice, or to itself', () => {
    const { graph } = run(['E', 'E']);
    const end = { pieceId: graph.pieces[1]!.pieceId, port: 1 };
    expect(weldEnds(graph, end, end)).toBe(graph);
    const taken = { pieceId: graph.pieces[0]!.pieceId, port: 1 };
    expect(isFree(graph, taken)).toBe(false);
    expect(weldEnds(graph, taken, end)).toBe(graph);
  });

  /*
   * It must NOT refuse a weld whose geometry does not meet. Being told that
   * the join you declared cannot be made is the whole purpose of the verdict.
   */
  it('a weld that does not close is allowed, and reported', () => {
    const { graph } = run(Array(7).fill('E'));
    const closed = weldEnds(
      graph,
      { pieceId: graph.pieces[6]!.pieceId, port: 1 },
      { pieceId: graph.pieces[0]!.pieceId, port: 0 },
    );
    expect(closed.welds).toHaveLength(7);
    const rs = residuals(closed, ports, placeAll(closed, ports));
    expect(rs).toHaveLength(1);
    expect(rs[0]!.closes).toBe(false);
  });
});

describe('piece ids', () => {
  /*
   * Ids must not be reused while a weld or an anchor still names one. The
   * naive `p${pieces.length}` does exactly that: delete an interior piece and
   * the next one added collides with a still-referenced id.
   */
  it('are not reused after a deletion', () => {
    const { graph } = run(['E', 'E', 'E']);
    const after = deletePiece(graph, ports, graph.pieces[1]!.pieceId);
    const fresh = newPieceId(after.pieces);
    expect(after.pieces.map((p) => p.pieceId)).not.toContain(fresh);
  });

  it('lastPieceId names the most recent piece, or nothing', () => {
    expect(lastPieceId(EMPTY_GRAPH)).toBeNull();
    const { graph } = run(['A', 'D']);
    expect(lastPieceId(graph)).toBe(graph.pieces[1]!.pieceId);
  });
});

describe('deleting', () => {
  it('removes the piece and every weld touching it', () => {
    const { graph } = run(['E', 'E', 'E']);
    const after = deletePiece(graph, ports, graph.pieces[1]!.pieceId);
    expect(after.pieces).toHaveLength(2);
    expect(after.welds).toHaveLength(0);
    const ids = new Set(after.pieces.map((p) => p.pieceId));
    for (const w of after.welds) {
      expect(ids.has(w.a.pieceId) && ids.has(w.b.pieceId)).toBe(true);
    }
  });

  it('leaves the surviving track exactly where it was', () => {
    const { graph } = run(Array(5).fill('E'));
    const before = placeAll(graph, ports);
    const after = deletePiece(graph, ports, graph.pieces[2]!.pieceId);
    const placed = placeAll(after, ports);
    for (const piece of after.pieces) {
      expect(placed.frames.get(piece.pieceId), piece.pieceId).toEqual(
        before.frames.get(piece.pieceId),
      );
    }
  });
});

describe('a new run is laid down beside what is already there', () => {
  it('two runs do not share an origin', () => {
    const a = run(['A', 'A']);
    const b = addPiece(a.graph, 'E', 'left', 2, null, ports);
    const place = placeAll(b.graph, ports);
    expect(place.forest.roots).toHaveLength(2);
    const frames = place.forest.roots.map((r) => place.frames.get(r)!);
    expect(frames[0]!.pos).not.toEqual(frames[1]!.pos);
  });

  /*
   * The bug this prevents was visible and double: every component anchored at
   * the identity, so a second run was DRAWN through the first, and because
   * the pieces were separate with no weld between them the overlap was a real
   * feasibility clash as well.
   */
  it('two separate runs of the same part do not collide', () => {
    const a = run(['A', 'A', 'A']);
    const b = addPiece(a.graph, 'A', 'left', 2, null, ports);
    const place = placeAll(b.graph, ports);
    expect(findVertexClashes(b.graph, ports, place)).toEqual([]);
  });

  it('the anchor stays an exact lattice point', () => {
    const a = run(['A']);
    const b = addPiece(a.graph, 'A', 'left', 2, null, ports);
    for (const [, frame] of b.graph.anchors!) {
      expect(Number.isInteger(frame.heading)).toBe(true);
      for (const c of frame.pos) expect(Number.isInteger(c)).toBe(true);
    }
  });

  it('a piece that attaches gets no anchor of its own', () => {
    const a = run(['A']);
    const b = addPiece(a.graph, 'A', 'left', 2, a.select, ports);
    expect(b.graph.anchors?.has(b.graph.pieces[1]!.pieceId) ?? false).toBe(false);
  });
});
