import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { describeAction } from './announce.js';
import { initialEditor, lastStep, reduce, type EditorState } from './editorReducer.js';
import { findFills } from './finishLoop.js';
import { fillName, findLabel, finishWords } from './finishWords.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { presetByLabel } from './presets.js';
import { presetAction, verdictKind } from './presetVerdict.js';
import { undoLabel } from './UndoControl.js';

/*
 * THE FILL ACTION AND ITS WORDS (plan 2026-11-14, E3). Each pin names the
 * change that fails it, and each was run.
 */

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const act = (s: EditorState, a: Parameters<typeof reduce>[1]) => reduce(s, a, ports);

/** Near miss on the floor, and the fill that closes its 72mm gap. */
function nearMissWithFill() {
  const state = act(initialEditor(EMPTY_GRAPH, ports), presetAction(presetByLabel('Near miss')));
  const closing = state.graph.welds[state.graph.welds.length - 1]!;
  const answer = findFills({ graph: state.graph, ports, resolve, parts: BUILT_IN, brandFit, inventory: null, from: closing.a, to: closing.b });
  if (answer.status !== 'found') throw new Error(`expected a fill, got ${answer.status}`);
  return { state, fill: answer.fills[0]!, closing };
}

describe('the fill action', () => {
  /*
   * Fails when: the reducer builds the layout its own way and not through
   * `applyFill` (say, `addPiece` per piece with no closing join): the layout
   * placed is then not the one the search checked. Run.
   */
  it('places exactly the layout the search checked', () => {
    const { state, fill } = nearMissWithFill();
    const next = act(state, { kind: 'fill', plan: fill, graph: state.graph });
    expect(next.graph).toEqual(fill.graph);
    expect(verdictKind(next.graph)).toBe('EXACT');
  });

  /*
   * Fails when: the fill is not remembered as one step (`remember(state,
   * 'fill')` dropped, or one step per piece): undo then leaves pieces behind
   * or does not bring the replaced joint back. Run.
   */
  it('is one step: undo takes the pieces out and puts the joint back', () => {
    const { state, fill } = nearMissWithFill();
    const next = act(state, { kind: 'fill', plan: fill, graph: state.graph });
    expect(lastStep(next)?.kind).toBe('fill');
    expect(undoLabel(lastStep(next))).toBe('Undo added pieces');
    const back = act(next, { kind: 'undo' });
    expect(back.graph).toBe(state.graph);
    expect(act(back, { kind: 'redo' }).graph).toEqual(fill.graph);
  });

  /*
   * Fails when: a fill found for another layout is applied anyway (the
   * `action.graph !== state.graph` guard removed). The layout here is a new
   * object with the same pieces, which is what any edit leaves behind when it
   * happens not to touch the gap: the pieces WOULD go in, so only the guard
   * stops them. Run. (A first version took a piece out of the loop instead;
   * that opens the closing joint, the fill no longer applies at all, and the
   * pin stayed green with the guard removed.)
   */
  it('does nothing when the layout changed after the search', () => {
    const { state, fill } = nearMissWithFill();
    const edited: EditorState = { ...state, graph: { ...state.graph } };
    const next = act(edited, { kind: 'fill', plan: fill, graph: state.graph });
    expect(next).toBe(edited);
    expect(describeAction(edited, { kind: 'fill', plan: fill, graph: state.graph }, next, resolve)).toBe(null);
    // The same fill, offered for the layout it is now on, does go in: the guard is what refused it.
    expect(act(edited, { kind: 'fill', plan: fill, graph: edited.graph }).graph.pieces.length).toBe(
      edited.graph.pieces.length + 1,
    );
  });

  it('says what it did', () => {
    const { state, fill } = nearMissWithFill();
    const next = act(state, { kind: 'fill', plan: fill, graph: state.graph });
    expect(describeAction(state, { kind: 'fill', plan: fill, graph: state.graph }, next, resolve)).toBe(
      'Added 1 piece. The gap is closed.',
    );
  });
});

describe('what finish-the-loop says', () => {
  const nameOf = (id: string) => resolve(id).name;

  it('names the gap and the pieces', () => {
    expect(findLabel(72)).toBe('Find pieces that close the 72mm gap');
    expect(findLabel(71.96)).toBe('Find pieces that close the 72mm gap');
    expect(findLabel(12.5)).toBe('Find pieces that close the 12.5mm gap');
    expect(fillName(['A3'], nameOf)).toBe('1 × Middle straight');
    expect(fillName(['E', 'D', 'E'], nameOf)).toBe('2 × Large curve, 1 × Long straight');
  });

  /*
   * THE TWO RULES OF THE WORDING. Fails when: an unfinished search is given
   * the words of a finished one (the 'out of work' case returning the 'none'
   * sentence), or any answer says a thing cannot be done. Run for the first.
   */
  it('never says nothing fits of a search that did not finish, and never says impossible', () => {
    const none = finishWords({ status: 'none' }, 4, false);
    const ranOut = finishWords({ status: 'out of work' }, 4, false);
    expect(none.line).toBe('No run of up to 4 plain pieces closes this gap exactly.');
    expect(ranOut.line).not.toBe(none.line);
    expect(ranOut.note).toContain('Nothing is ruled out');
    const all = [
      none,
      ranOut,
      finishWords({ status: 'refused', why: 'levels' }, 4, false),
      finishWords({ status: 'refused', why: 'not free' }, 4, true),
      finishWords({ status: 'found', fills: [], complete: false }, 4, true),
    ];
    for (const w of all) expect(`${w.line} ${w.note ?? ''}`).not.toMatch(/impossible|can't be|cannot be done|won't fit/i);
  });

  /*
   * Fails when: the note about what was tried does not follow the box (the
   * `boxed` argument ignored): a visitor with no box is told only their
   * spare pieces were tried. Run.
   */
  it('says whether the box or the whole library was tried, and when it stopped early', () => {
    expect(finishWords({ status: 'none' }, 4, true).note).toContain('your box has spare');
    expect(finishWords({ status: 'none' }, 4, false).note).toContain('not only the ones you own');
    expect(finishWords({ status: 'found', fills: [], complete: true }, 4, false).note).not.toContain('stopped early');
    expect(finishWords({ status: 'found', fills: [], complete: false }, 4, false).note).toContain('stopped early');
  });
});
