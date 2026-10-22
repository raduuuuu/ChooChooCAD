/**
 * SELECT ANY PIECE, REMOVE IT, AND WALK THE HISTORY BOTH WAYS (decisions
 * R1/D2 and D12 of the 2026-10-22 editing plan).
 *
 * Value: protects=a middle piece can be removed with every survivor exactly
 * where it was; the cursor and armed end never point at a removed piece; a
 * selection and an armed end are never both set; Undo and Redo walk up to 50
 * steps and any new edit empties Redo
 * Value: fails_when=removal clears the cursor or leaves it dangling, a
 * selection survives its piece, the history is one step or unbounded, or Redo
 * outlives a new edit
 * Value: why_new=removal was newest-piece only and Undo was one step
 * Value: seam=none (the pure reducer)
 * Value: no_claim=how the canvas draws a selection; see the markup specs
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { HISTORY_LIMIT, lastStep, nextStep, reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH, isFree } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);
const chain = (n: number, partId = 'A'): EditorState => {
  let s = START;
  for (let i = 0; i < n; i++) s = act(s, { kind: 'add', partId, turn: 'left' });
  return s;
};
const framesOf = (s: EditorState) =>
  new Map([...placeAll(s.graph, ports).frames].map(([id, f]) => [id, JSON.stringify(f)]));

describe('removing any piece', () => {
  /*
   * MUTATION PROOFS, run:
   * - `stillFree` without its existence check: the cursor spec fails with
   *   `expected { pieceId: 'p3', port: 1 } to deeply equal { pieceId: 'p2',
   *   port: 1 }` (the cursor left on the removed piece), and the armed spec
   *   with `expected { pieceId: 'p0', port: +0 } to be null`. This was a real
   *   bug, caught by these specs before it shipped.
   */
  it('takes a middle piece out, leaving two runs exactly where they were', () => {
    const s = chain(5);
    const middle = s.graph.pieces[2]!.pieceId;
    const before = framesOf(s);
    const after = act(s, { kind: 'removePiece', pieceId: middle });

    expect(after.graph.pieces.map((p) => p.pieceId)).not.toContain(middle);
    expect(after.graph.welds).toHaveLength(2);
    for (const [id, frame] of framesOf(after)) expect(frame, id).toBe(before.get(id));
    expect(lastStep(after)?.kind).toBe('remove');
  });

  it('keeps the cursor on a free end that survives, else resumes on the newest free end', () => {
    const s = chain(4);
    // The cursor sits on piece 4's far end; removing piece 2 leaves it free.
    const kept = act(s, { kind: 'removePiece', pieceId: s.graph.pieces[1]!.pieceId });
    expect(kept.cursor).toEqual(s.cursor);

    // Removing the cursor's own piece resumes on piece 3's freed end.
    const moved = act(s, { kind: 'removePiece', pieceId: s.graph.pieces[3]!.pieceId });
    expect(moved.cursor).toEqual({ pieceId: s.graph.pieces[2]!.pieceId, port: 1 });
    expect(isFree(moved.graph, moved.cursor!)).toBe(true);
  });

  it('drops an armed end that went with the piece', () => {
    const s = chain(3);
    const start = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    const armed = act(s, { kind: 'clickPort', ref: start });
    expect(armed.armed).toEqual(start);
    expect(act(armed, { kind: 'removePiece', pieceId: start.pieceId }).armed).toBeNull();
  });

  it('a piece that is already gone changes nothing', () => {
    const s = chain(2);
    expect(act(s, { kind: 'removePiece', pieceId: 'nope' })).toBe(s);
  });
});

describe('selecting a piece', () => {
  /*
   * MUTATION PROOFS, run:
   * - `selectPiece` keeps `armed`: `expected { pieceId: 'p2', port: 1 } to be
   *   null`.
   * - arming an end keeps `selected`: `expected 'p0' to be null`.
   * - `reduce` stops dropping a selection whose piece is gone: the Undo spec
   *   fails with `expected 'p2' to be null`.
   */
  it('selects, toggles off on a second click, and clears with null', () => {
    const s = chain(3);
    const id = s.graph.pieces[1]!.pieceId;
    const on = act(s, { kind: 'selectPiece', pieceId: id });
    expect(on.selected).toBe(id);
    expect(act(on, { kind: 'selectPiece', pieceId: id }).selected).toBeNull();
    expect(act(on, { kind: 'selectPiece', pieceId: null }).selected).toBeNull();
    // Selecting changes no track, so it is not an edit and not a step.
    expect(on.graph).toBe(s.graph);
    expect(on.edited).toBe(s.edited);
    expect(lastStep(on)).toBe(lastStep(s));
  });

  it('is never on together with an armed end', () => {
    const s = chain(3);
    const end = { pieceId: s.graph.pieces[2]!.pieceId, port: 1 };
    const armed = act(s, { kind: 'clickPort', ref: end });
    const selected = act(armed, { kind: 'selectPiece', pieceId: s.graph.pieces[0]!.pieceId });
    expect(selected.armed).toBeNull();
    const rearmed = act(selected, { kind: 'clickPort', ref: end });
    expect(rearmed.selected).toBeNull();
  });

  it('does not outlive its piece', () => {
    const s = chain(3);
    const id = s.graph.pieces[2]!.pieceId;
    const on = act(s, { kind: 'selectPiece', pieceId: id });
    // Absent and null both mean "nothing selected".
    expect(act(on, { kind: 'removeLast' }).selected ?? null).toBeNull();
    expect(act(on, { kind: 'removePiece', pieceId: id }).selected ?? null).toBeNull();
  });

  it('does not outlive its piece through Undo either', () => {
    const s = chain(3);
    const on = act(s, { kind: 'selectPiece', pieceId: s.graph.pieces[2]!.pieceId });
    // Undoing the last placement takes the selected piece away.
    expect(act(on, { kind: 'undo' }).selected ?? null).toBeNull();
    // Undoing something else keeps it.
    const other = act(on, { kind: 'removePiece', pieceId: s.graph.pieces[0]!.pieceId });
    const kept = act(act(other, { kind: 'selectPiece', pieceId: s.graph.pieces[1]!.pieceId }), { kind: 'undo' });
    expect(kept.selected).toBe(s.graph.pieces[1]!.pieceId);
  });
});

describe('the history', () => {
  /*
   * MUTATION PROOFS, run:
   * - `remember` keeps `future`: `expected { kind: 'place', graph: { …(3) } }
   *   to be null`.
   * - no `.slice(-HISTORY_LIMIT)`: `expected [ …(55) ] to have a length of 50
   *   but got 55`.
   * - Undo does not move its step onto Redo: `expected undefined to be
   *   'remove'`, and the Redo spec fails too.
   */
  it('undoes and redoes several steps, in order', () => {
    const s = chain(3);
    const removed = act(s, { kind: 'removePiece', pieceId: s.graph.pieces[1]!.pieceId });
    const back1 = act(removed, { kind: 'undo' });
    expect(back1.graph).toBe(s.graph);
    expect(nextStep(back1)?.kind).toBe('remove');
    const back2 = act(back1, { kind: 'undo' });
    expect(back2.graph.pieces).toHaveLength(2);
    const fwd = act(act(back2, { kind: 'redo' }), { kind: 'redo' });
    expect(fwd.graph).toBe(removed.graph);
    expect(nextStep(fwd)).toBeNull();
  });

  it('a new edit empties Redo', () => {
    const s = chain(2);
    const back = act(s, { kind: 'undo' });
    expect(nextStep(back)).not.toBeNull();
    const fresh = act(back, { kind: 'add', partId: 'A', turn: 'left' });
    expect(nextStep(fresh)).toBeNull();
    expect(act(fresh, { kind: 'redo' })).toBe(fresh);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps, dropping the oldest`, () => {
    const s = chain(HISTORY_LIMIT + 5);
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    // The oldest kept step is the graph before piece 6 went down.
    expect(s.past![0]!.graph.pieces).toHaveLength(5);
  });
});
