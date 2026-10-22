import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { findVertexClashes, findWeldPolarityViolations } from '../../engine/src/graph/feasible.js';
import { placeAll, portFrame, residuals, closesExactly } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import {
  EMPTY_GRAPH,
  addPiece,
  breakWeld,
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

/*
 * G3: `breakWeld`'s first direct test. It wraps the engine's `removeWeld`,
 * which is tested; the wrapper was not, and U5 is the first caller.
 *
 * MUTATION PROOF, run: make `breakWeld` return `graph` unchanged. Fails with
 * `expected [ { …(2) }, { …(2) } ] to have a length of 1 but got 2`.
 */
describe('breakWeld', () => {
  it('removes exactly the weld it is given, frees both ends, and keeps every piece', () => {
    let g = EMPTY_GRAPH;
    let at = null as ReturnType<typeof addPiece>['select'];
    for (let i = 0; i < 3; i++) {
      const step = addPiece(g, 'A', 'left', 2, at, ports);
      g = step.graph;
      at = step.select;
    }
    const gone = g.welds[0]!;
    const kept = g.welds[1]!;
    const broken = breakWeld(g, ports, 0);
    expect(broken.pieces).toBe(g.pieces);
    expect(broken.welds).toHaveLength(1);
    expect(broken.welds[0]).toEqual(kept);
    expect(isFree(broken, gone.a)).toBe(true);
    expect(isFree(broken, gone.b)).toBe(true);
    // The freed run keeps its place: it gains an anchor where it was drawn.
    const before = placeAll(g, ports).frames.get(gone.b.pieceId);
    expect(placeAll(broken, ports).frames.get(gone.b.pieceId)).toEqual(before);
  });
});


/*
 * THE AUTO-FLIP: a piece goes on whichever way round lets peg meet socket.
 *
 * Reported 2026-10-22: placing the M switch (peg heel, socket roads) and then
 * an E was marked "Can't be built", because the E went on by its start, a
 * socket, against M's socket road. Real track would be turned round.
 *
 * The witness is L, the same switch with the pegs on its roads, where an E
 * goes on by its start the ordinary way. M-then-E must end exactly where
 * L-then-E does: same lattice point, same heading, for both turns. That pins
 * the port AND the turn flip, because attaching by the far end without
 * flipping the turn bends the curve the wrong way.
 *
 * MUTATION PROOF, run: make `orientation` always return `{ port: 0, turn }`.
 * Fails with `expected 1 to be +0` on the polarity count. Run again with the
 * port chosen but the turn NOT flipped (`turn` instead of `flip(turn)`):
 * fails with `M then E, left: expected { …(2) } to deeply equal { Object
 * (pos, heading) }`, and the run below ends at heading 10 instead of 6.
 */
describe('addPiece turns a piece round so peg meets socket', () => {
  const build = (steps: ReadonlyArray<readonly [string, 'left' | 'right']>) => {
    let g = EMPTY_GRAPH;
    let at = null as ReturnType<typeof addPiece>['select'];
    for (const [partId, turn] of steps) {
      const step = addPiece(g, partId, turn, ports({ pieceId: '', partId, turn }).length, at, ports);
      g = step.graph;
      at = step.select;
    }
    return { g, at: at! };
  };
  const frameOf = (g: typeof EMPTY_GRAPH, ref: { pieceId: string; port: number }) =>
    portFrame(placeAll(g, ports), ports, g.pieces.find((p) => p.pieceId === ref.pieceId)!, ref.port);
  const badJoints = (g: typeof EMPTY_GRAPH) => findWeldPolarityViolations(g, resolve, ports).length;

  it('puts an E on M by its peg, ending exactly where it does on L', () => {
    for (const turn of ['left', 'right'] as const) {
      const viaM = build([['M', 'left'], ['E', turn]]);
      const viaL = build([['L', 'left'], ['E', turn]]);
      expect(badJoints(viaM.g), `M then E, ${turn}`).toBe(0);
      expect(viaM.g.welds[0]!.b.port, `M then E, ${turn}`).toBe(1);
      expect(frameOf(viaM.g, viaM.at), `M then E, ${turn}`).toEqual(frameOf(viaL.g, viaL.at));
    }
  });

  it('keeps going: every later E also goes on peg first, still bending as asked', () => {
    const { g, at } = build([['M', 'left'], ['E', 'left'], ['E', 'left'], ['E', 'left']]);
    expect(badJoints(g)).toBe(0);
    expect(frameOf(g, at).heading).toBe(6);
  });

  it('leaves an ordinary run alone: each piece still goes on by its start', () => {
    const { g } = build([['A', 'left'], ['E', 'left'], ['A1', 'left']]);
    expect(g.welds.map((w) => w.b.port)).toEqual([0, 0]);
    expect(g.pieces.map((p) => p.turn)).toEqual(['left', 'left', 'left']);
  });

  it('cannot turn round a piece with no end of the other kind, and says so', () => {
    const { g } = build([['A', 'left'], ['C2', 'left'], ['C2', 'left']]);
    expect(g.welds[1]!.b.port).toBe(0);
    expect(badJoints(g)).toBe(1);
  });
});
