/**
 * REMOVING OR BREAKING NEVER MOVES THE TRACK THAT STAYS (decision D19 of the
 * 2026-10-22 editing plan).
 *
 * Value: protects=after a remove or a break, every surviving piece keeps its
 * exact frame, even in a loop whose closing join never met
 * Value: fails_when=a gappy closing weld is left in place and becomes a tree
 * edge, so the far side is re-laid through the gap
 * Value: why_new=engine edit specs only used loops that close exactly, where
 * the hazard cannot appear; Codex measured 72mm on Near miss
 * Value: seam=none (the reducer and engine, no DOM)
 * Value: no_claim=nothing about how the opened join is announced
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll, residuals } from '../../engine/src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { reduce, type EditorState } from './editorReducer.js';
import { breakWeld, deletePiece, EMPTY_GRAPH } from './layoutModel.js';
import { PRESETS } from './presets.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };

const preset = (label: string): Graph =>
  reduce(START, { kind: 'preset', ids: PRESETS.find((p) => p.label === label)!.pieces }, ports)
    .graph;

const frames = (g: Graph): ReadonlyMap<string, Frame> => placeAll(g, ports).frames;

/** Every piece in `after`, with any whose exact frame changed. */
const moved = (before: Graph, after: Graph): string[] => {
  const was = frames(before);
  const now = frames(after);
  return after.pieces
    .map((p) => p.pieceId)
    .filter((id) => JSON.stringify(was.get(id)) !== JSON.stringify(now.get(id)));
};

describe('a join that never met does not steer the track that stays', () => {
  /*
   * MUTATION PROOF, run: make `openUnmetJoins` return `next` untouched. All
   * three Near miss specs fail: `removing p1: expected [ 'p2', 'p3', 'p4',
   * 'p5', 'p6', …(3) ] to deeply equal []`, `breaking weld 0: expected [
   * 'p1', 'p2', 'p3', 'p4', 'p5', …(4) ] to deeply equal []`, and the gappy
   * weld is still in the graph. The exact Circle spec stays green, which is
   * the point: only a join that never met is opened.
   */
  it('Near miss: removing a piece moves nothing', () => {
    const graph = preset('Near miss');
    // The premise: one closing weld that does not meet.
    expect(residuals(graph, ports, placeAll(graph, ports)).filter((r) => !r.closes)).toHaveLength(1);

    for (const piece of graph.pieces) {
      const after = deletePiece(graph, ports, piece.pieceId);
      expect(moved(graph, after), `removing ${piece.pieceId}`).toEqual([]);
    }
  });

  it('Near miss: breaking any joint moves nothing', () => {
    const graph = preset('Near miss');
    for (let i = 0; i < graph.welds.length; i++) {
      const after = breakWeld(graph, ports, i);
      expect(moved(graph, after), `breaking weld ${i}`).toEqual([]);
    }
  });

  it('opens the unmet join, and only that one', () => {
    const graph = preset('Near miss');
    const unmet = residuals(graph, ports, placeAll(graph, ports)).find((r) => !r.closes)!;
    const gappy = graph.welds[unmet.weld]!;
    const p4 = graph.pieces[4]!.pieceId;
    const after = deletePiece(graph, ports, p4);
    const touching = graph.welds.filter((w) => w.a.pieceId === p4 || w.b.pieceId === p4);

    expect(after.welds).not.toContain(gappy);
    expect(after.welds).toHaveLength(graph.welds.length - touching.length - 1);
  });

  it('an exact loop keeps every join', () => {
    const graph = preset('Circle');
    const after = deletePiece(graph, ports, graph.pieces[3]!.pieceId);
    expect(after.welds).toHaveLength(graph.welds.length - 2);
    expect(moved(graph, after)).toEqual([]);
  });
});
