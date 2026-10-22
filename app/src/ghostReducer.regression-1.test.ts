/**
 * THE PREVIEW STARTS WHERE A DIRECT PLACE WOULD PUT THE PIECE (decisions R3,
 * 9A; fitOptions puts `orientation`'s own choice first for this reason).
 *
 * Value: protects=at any free end, pick then Place lays the piece exactly
 * where a double-click or Shift+Enter does, so the two routes never disagree
 * Value: fails_when=pick prefers a stored turn over the first fit option, as
 * it did at a start end, where the auto-flip stores the other turn
 * Value: why_new=ghostReducer.test.ts picks only at far ends (pegs), where no
 * flip happens and both routes agree by accident
 * Value: seam=none (the pure reducer)
 * Value: no_claim=which of the two bends is the better default; only that both
 * routes give the same one
 */

// Regression: ISSUE-002 — at a start end, pick+Place and double-click put a curve down bending opposite ways
// Found by /qa on 2026-10-22
// Report: .gstack/qa-reports/run-20261022T200820Z/qa-report-localhost-2026-10-22.md

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);
const newest = (s: EditorState) => {
  const piece = s.graph.pieces[s.graph.pieces.length - 1]!;
  return { turn: piece.turn, frame: placeAll(s.graph, ports).frames.get(piece.pieceId) };
};

describe('pick then Place lays the piece where a direct place does', () => {
  /*
   * MUTATION PROOF, run: `newGhost` back to preferring turn 'left' (the code
   * before the fix): E, E1 and L fail with `port 0: expected { turn: 'left',
   * frame: { …(2) } } to deeply equal { turn: 'right', frame: { …(2) } }`.
   */
  for (const partId of ['E', 'E1', 'A', 'L']) {
    it(`${partId}, at the far end and at the start end of a straight`, () => {
      const one = act(START, { kind: 'add', partId: 'A', turn: 'left' });
      const first = one.graph.pieces[0]!.pieceId;
      for (const port of [1, 0]) {
        const at: EditorState = { ...one, cursor: { pieceId: first, port } };
        const direct = act(at, { kind: 'add', partId, turn: 'left' });
        const previewed = act(act(at, { kind: 'pick', partId }), { kind: 'placeGhost' });
        expect(newest(previewed), `port ${port}`).toEqual(newest(direct));
      }
    });
  }
});
