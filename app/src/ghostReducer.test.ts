/**
 * PLACING A PIECE THROUGH A PREVIEW, IN THE REDUCER (decisions R3, E2, 18A,
 * 9A, D13, P-g; Codex OV5; the transition table in the editing plan).
 *
 * Value: protects=pick puts the preview at the cursor, or free on an empty
 * floor; R and F change only what they claim; an end click or [ ] moves it;
 * Place puts it exactly there, joins what it landed on, and leaves the cursor
 * on a free end; Cancel changes nothing; while it is pending a piece click or
 * joint click does nothing
 * Value: fails_when=any of those transitions writes the wrong field, Place
 * ignores the chosen orientation, or the cursor is left on a joined end
 * Value: why_new=the preview is new
 * Value: seam=none (the pure reducer)
 * Value: no_claim=what the preview looks like; see the canvas specs
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { IDENTITY, portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { lastStep, reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH, isFree } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);
const run = (ids: readonly string[]) => ids.reduce((s, partId) => act(s, { kind: 'add', partId, turn: 'left' }), START);

describe('pick', () => {
  /*
   * MUTATION PROOFS, run:
   * - pick ignores the cursor: `expected null to deeply equal { pieceId:
   *   'p1', port: 1 }`.
   * - pick keeps a selection: `expected 'p0' to be null`.
   */
  it('on an empty floor: free, at the origin', () => {
    const s = act(START, { kind: 'pick', partId: 'E' });
    expect(s.ghost).toEqual({ partId: 'E', at: null, frame: IDENTITY, turn: 'left', port: 0 });
    expect(s.graph).toBe(START.graph);
  });

  it('at the cursor, clearing a selection and an armed end', () => {
    const s = run(['A', 'A']);
    const selected = act(s, { kind: 'selectPiece', pieceId: s.graph.pieces[0]!.pieceId });
    const picked = act(selected, { kind: 'pick', partId: 'E' });
    expect(picked.ghost?.at).toEqual(s.cursor);
    expect(picked.selected ?? null).toBeNull();
    expect(picked.armed).toBeNull();
  });

  it('picking the same part again keeps the preview as it is', () => {
    const s = act(act(run(['A']), { kind: 'pick', partId: 'E' }), { kind: 'flipGhost' });
    expect(act(s, { kind: 'pick', partId: 'E' })).toBe(s);
  });
});

describe('turning the preview', () => {
  /*
   * MUTATION PROOFS, run:
   * - a free preview's F does nothing: `expected 'left' to be 'right'`.
   * - F rotates instead of flipping: `expected 'left' not to be 'left'`.
   */
  it('F flips a curve to the other turn; R has nothing else to offer it there', () => {
    const s = act(run(['A']), { kind: 'pick', partId: 'E' });
    const flipped = act(s, { kind: 'flipGhost' });
    expect(flipped.ghost!.turn).not.toBe(s.ghost!.turn);
    expect(act(s, { kind: 'rotateGhost' })).toBe(s);
  });

  it('a free preview: R turns it a sixteenth, F flips its turn', () => {
    const s = act(START, { kind: 'pick', partId: 'E' });
    expect(act(s, { kind: 'rotateGhost' }).ghost!.frame!.heading).toBe(1);
    expect(act(s, { kind: 'flipGhost' }).ghost!.turn).toBe('right');
  });
});

describe('moving the preview', () => {
  /*
   * MUTATION PROOFS, run:
   * - an end click moves the preview but not the cursor: `expected { pieceId:
   *   'p1', port: 1 } to deeply equal { pieceId: 'p0', port: +0 }`.
   * - [ and ] reversed: `expected { pieceId: 'p0', port: +0 } to deeply equal
   *   { pieceId: 'p0', port: 2 }`. (With two ends both directions agree, so
   *   the spec uses a switch's three.)
   */
  it('an end click moves it there, and moves the cursor with it', () => {
    const s = act(run(['A', 'A']), { kind: 'pick', partId: 'E' });
    const start = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    const moved = act(s, { kind: 'clickPort', ref: start });
    expect(moved.ghost!.at).toEqual(start);
    expect(moved.cursor).toEqual(start);
    expect(moved.armed).toBeNull();
  });

  it('] and [ step through the free ends, forward and back', () => {
    // A switch alone: three free ends, so the two directions differ.
    const s = act(run(['L']), { kind: 'pick', partId: 'A' });
    const id = s.graph.pieces[0]!.pieceId;
    expect(s.ghost!.at).toEqual({ pieceId: id, port: 1 });
    expect(act(s, { kind: 'stepGhost', by: 1 }).ghost!.at).toEqual({ pieceId: id, port: 2 });
    expect(act(s, { kind: 'stepGhost', by: -1 }).ghost!.at).toEqual({ pieceId: id, port: 0 });
  });
});

describe('Place and Cancel', () => {
  /*
   * MUTATION PROOFS, run:
   * - Place drops the preview's choice: `expected 'left' to be 'right'`.
   *   Survived on a straight's peg end, where the automatic choice lands the
   *   same way; the two-socket base makes them differ.
   * - Place without auto-join: `expected [ …(7) ] to have a length of 8 but
   *   got 7`.
   * - Place leaves the cursor on the far end the join consumed: `expected {
   *   pieceId: 'p7', port: 1 } to be null` (Codex OV5).
   * - a piece click while placing is not ignored: `expected { …(8) } to be {
   *   …(8) }`.
   */
  it('Place puts the piece down as shown: the flipped curve bends the flipped way', () => {
    // C ends in a socket, so a curve goes on by its peg, turned round, and
    // the automatic choice flips its stored turn. The preview's own choice
    // must win over that, or a flip would not survive Place.
    const base = run(['C']);
    const shown = act(act(base, { kind: 'pick', partId: 'E' }), { kind: 'flipGhost' });
    const placed = act(shown, { kind: 'placeGhost' });
    const piece = placed.graph.pieces[1]!;
    expect(piece.turn).toBe(shown.ghost!.turn);
    expect(placed.ghost ?? null).toBeNull();
    expect(lastStep(placed)?.kind).toBe('place');
  });

  it('Place on an empty floor puts it at the preview frame', () => {
    const shown = act(act(START, { kind: 'pick', partId: 'A' }), { kind: 'rotateGhost' });
    const placed = act(shown, { kind: 'placeGhost' });
    expect(placeAll(placed.graph, ports).frames.get(placed.graph.pieces[0]!.pieceId)).toEqual(shown.ghost!.frame);
  });

  it('the eighth curve placed closes the circle, one step, and the cursor is not left on a joined end', () => {
    let s = run(Array(7).fill('E'));
    s = act(act(s, { kind: 'pick', partId: 'E' }), { kind: 'placeGhost' });
    expect(s.graph.welds).toHaveLength(8);
    expect(lastStep(s)?.kind).toBe('placeJoin');
    // Nothing is free in a closed loop, so there is nothing to continue from.
    expect(s.cursor).toBeNull();
  });

  it('a red preview can still be placed (decision P-g)', () => {
    const base = run(['A']);
    // B has pegs at both ends; A's far end is a peg.
    const placed = act(act(base, { kind: 'pick', partId: 'B' }), { kind: 'placeGhost' });
    expect(placed.graph.pieces).toHaveLength(2);
  });

  it('Cancel changes nothing but the preview', () => {
    const base = run(['A']);
    const cancelled = act(act(base, { kind: 'pick', partId: 'E' }), { kind: 'cancelGhost' });
    expect(cancelled.graph).toBe(base.graph);
    expect(cancelled.ghost ?? null).toBeNull();
    expect(lastStep(cancelled)).toBe(lastStep(base));
  });

  it('while placing, a piece click and a joint click do nothing', () => {
    const s = act(run(['A', 'A']), { kind: 'pick', partId: 'E' });
    const w = s.graph.welds[0]!;
    expect(act(s, { kind: 'selectPiece', pieceId: s.graph.pieces[0]!.pieceId })).toBe(s);
    expect(act(s, { kind: 'breakWeld', a: w.a, b: w.b })).toBe(s);
  });

  it('a double-click placement (add) joins what it lands on, as Place does', () => {
    const s = run(Array(8).fill('E'));
    expect(s.graph.welds).toHaveLength(8);
    expect(lastStep(s)?.kind).toBe('placeJoin');
    expect(s.cursor === null || isFree(s.graph, s.cursor)).toBe(true);
  });
});
