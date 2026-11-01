/**
 * CLEAR AND A PRESET ARE STEPS UNDO CAN REVERSE (QA 2026-11-01, owner's
 * answer "A) Make them undoable").
 *
 * Value: protects=a layout replaced by Clear or a preset comes back with one
 * Undo, and Redo replaces it again
 * Value: fails_when=clear or preset starts a fresh history again (`past: []`),
 * as both did until this change
 * Value: why_new=editorReducer.test.ts checks only what clear and preset
 * build, never what they leave Undo able to do
 * Value: seam=none (the pure reducer)
 * Value: no_claim=the buttons' labels on screen (UndoControl's NAME table is
 * typed by the step kinds, so a missing label fails typecheck)
 */

// Regression: ISSUE-001 — Clear and the presets replaced a layout with Undo disabled
// Found by /qa on 2026-11-01
// Report: .gstack/qa-reports/run-20261101T084601Z/qa-report-woodentrain.world-2026-11-01.md

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { lastStep, reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);

/** The QA layout: the circle preset with its last piece removed, seven pieces. */
function sevenPieces(): EditorState {
  return act(act(START, { kind: 'preset', ids: Array(8).fill('E') }), { kind: 'removeLast' });
}

describe('Clear and the presets can be undone', () => {
  /*
   * MUTATION PROOF, run (the pre-fix reducer, `past: [], future: []`):
   * `expected undefined to be 'preset' // Object.is equality`, no step to undo.
   */
  it('a preset over a layout: Undo brings the seven pieces back, Redo the preset', () => {
    const before = sevenPieces();
    const stadium = act(before, { kind: 'preset', ids: ['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'D'] });
    expect(stadium.graph.pieces).toHaveLength(10);
    expect(lastStep(stadium)?.kind).toBe('preset');
    const undone = act(stadium, { kind: 'undo' });
    expect(undone.graph.pieces.length).toBe(7);
    expect(undone.graph).toBe(before.graph);
    expect(act(undone, { kind: 'redo' }).graph).toBe(stadium.graph);
  });

  /*
   * MUTATION PROOF, run (the pre-fix reducer, `past: [], future: []`):
   * `expected undefined to be 'clear' // Object.is equality`.
   */
  it('Clear: Undo brings the layout back', () => {
    const before = sevenPieces();
    const cleared = act(before, { kind: 'clear' });
    expect(cleared.graph.pieces).toHaveLength(0);
    expect(lastStep(cleared)?.kind).toBe('clear');
    expect(act(cleared, { kind: 'undo' }).graph.pieces.length).toBe(7);
  });

  it('on an empty floor there is nothing to keep: no step is added', () => {
    expect(lastStep(act(START, { kind: 'clear' }))).toBe(null);
    expect(lastStep(act(START, { kind: 'preset', ids: Array(8).fill('E') }))).toBe(null);
  });
});
