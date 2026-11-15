/**
 * THE SAME PIECE STAYS READY AFTER PLACE (plan 2026-11-14, design DD6; eng
 * ED3).
 *
 * Value: protects=Place with `again` puts the piece down and previews the
 * same part on that piece's own free end, bending the same way, in one step
 * with one Undo entry; a closed loop, a buffer or a pier leaves nothing
 * previewed; Undo puts the preview away; Place without `again` is as before
 * Value: fails_when=the next preview lands on another piece's end, forgets
 * which way the curve bent, appears after a piece with nowhere to go on, or
 * costs a second Undo step
 * Value: why_new=on a phone, six straights were six trips to the Pieces
 * sheet
 * Value: seam=none (the pure reducer)
 * Value: no_claim=which screen sends `again` (the phone's shell, a later
 * step: nothing sends it yet); where focus goes after Place
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH, isFree } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);
const AGAIN: EditorAction = { kind: 'placeGhost', again: true };
const lastId = (s: EditorState) => s.graph.pieces[s.graph.pieces.length - 1]!.pieceId;

describe('Place, with the same piece kept ready', () => {
  /*
   * MUTATION PROOFS, run:
   * - `onward` always null: `expected undefined to be 'A'` (no preview after
   *   Place).
   * - `again` ignored the other way (`onward` computed whatever the action
   *   says): the "without it" spec fails with `expected { partId: 'A', at: { …(2) },
   *   …(3) } to be null`.
   */
  it('previews the same part on the placed piece’s free end, one Undo step a Place', () => {
    let s = act(START, { kind: 'pick', partId: 'A' });
    for (let n = 1; n <= 3; n++) {
      s = act(s, AGAIN);
      expect(s.graph.pieces).toHaveLength(n);
      expect(s.past).toHaveLength(n);
      expect(s.ghost?.partId).toBe('A');
      expect(s.ghost?.at?.pieceId).toBe(lastId(s));
      expect(isFree(s.graph, s.ghost!.at!)).toBe(true);
      expect(s.cursor).toEqual(s.ghost!.at);
    }
  });

  it('without it, Place leaves nothing previewed, as before', () => {
    const s = act(act(START, { kind: 'pick', partId: 'A' }), { kind: 'placeGhost' });
    expect(s.ghost ?? null).toBeNull();
  });

  /*
   * MUTATION PROOF, run: the next preview made with `null` for the turn
   * (`ghostAt(…, onward, null)`): `expected 'left' to be 'right'`.
   */
  it('a curve keeps bending the way it was turned', () => {
    let s = act(act(START, { kind: 'pick', partId: 'A' }), { kind: 'placeGhost' });
    s = act(act(s, { kind: 'pick', partId: 'E' }), { kind: 'flipGhost' });
    const turned = s.ghost!.turn;
    s = act(s, AGAIN);
    expect(s.graph.pieces[1]!.turn).toBe(turned);
    expect(s.ghost?.turn).toBe(turned);
  });

  /*
   * MUTATION PROOF, run: `onward` falling back to `resumeCursor` (any free
   * end of the layout): the buffer spec fails with `expected { partId: 'R',
   * at: { …(2) }, …(3) } to be null`: a second buffer offered on the run's
   * other end.
   */
  it('a buffer has no end to go on: nothing is previewed, though the run has another free end', () => {
    let s = act(act(START, { kind: 'pick', partId: 'A' }), { kind: 'placeGhost' });
    s = act(act(s, { kind: 'pick', partId: 'R' }), AGAIN);
    expect(s.graph.pieces).toHaveLength(2);
    expect(s.graph.welds).toHaveLength(1);
    expect(s.ghost ?? null).toBeNull();
    // The straight's other end is still free: it is not offered.
    expect(isFree(s.graph, { pieceId: s.graph.pieces[0]!.pieceId, port: 0 })).toBe(true);
  });

  it('a pier has no ends: it lands selected and nothing is previewed', () => {
    const s = act(act(START, { kind: 'pick', partId: 'TS' }), AGAIN);
    expect(s.graph.pieces).toHaveLength(1);
    expect(s.selected).toBe(lastId(s));
    expect(s.ghost ?? null).toBeNull();
  });

  /*
   * MUTATION PROOF, run: `count > 0` as the only condition, with the
   * preview put on `next.select` unchecked: `expected { partId: 'E', … } to
   * be null` once the eighth curve closes the circle.
   */
  it('the piece that closes a loop leaves nothing previewed', () => {
    let s = act(START, { kind: 'pick', partId: 'E' });
    for (let n = 1; n <= 7; n++) {
      s = act(s, AGAIN);
      expect(s.ghost?.partId, `after curve ${n}`).toBe('E');
    }
    s = act(s, AGAIN);
    expect(s.graph.pieces).toHaveLength(8);
    expect(s.graph.welds).toHaveLength(8);
    expect(s.ghost ?? null).toBeNull();
  });

  /*
   * MUTATION PROOF, run: undo carrying the preview over (`ghost:
   * state.ghost` in its result): `expected { partId: 'A', … } to be null`.
   */
  it('Undo and Redo put the preview away', () => {
    const placed = act(act(act(START, { kind: 'pick', partId: 'A' }), AGAIN), AGAIN);
    const undone = act(placed, { kind: 'undo' });
    expect(undone.graph.pieces).toHaveLength(1);
    expect(undone.ghost ?? null).toBeNull();
    expect(act(undone, { kind: 'redo' }).ghost ?? null).toBeNull();
  });
});
