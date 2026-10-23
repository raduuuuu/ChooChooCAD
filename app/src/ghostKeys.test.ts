/**
 * R AND F SAY WHAT THEY DO (owner, 2026-10-23: "explain better the difference
 * between rotate and flip").
 *
 * Value: protects=the R label says which of its two jobs it does here (other
 * end on at a track end, a sixteenth on open floor); the F label names the
 * result for the part (bend, branch, climb or come down); the pick
 * announcement lists only keys that act; the sentence after a press says the
 * result
 * Value: fails_when=a label falls back to a generic verb, R's two jobs share
 * one label, a key that does nothing is announced, or a ramp's flip names the
 * direction it already goes
 * Value: why_new=the buttons said only "Rotate" and "Flip", and the pick
 * announcement never mentioned F
 * Value: seam=the reducer supplies real pending pieces; `ghostKeys`,
 * `keyHelp` and `afterKey` are pure
 * Value: no_claim=the buttons in the DOM (placing.dom.test.tsx,
 * twoLevels.dom.test.tsx)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { describeAction } from './announce.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { ghostKeys } from './ghostKeys.js';
import { EMPTY_GRAPH } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** `partId` picked at the free end of a lone `base`, or on open floor. */
const picked = (base: string | null, partId: string) => {
  let s: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
  if (base) s = reduce(s, { kind: 'add', partId: base, turn: 'left' }, ports);
  const action: EditorAction = { kind: 'pick', partId };
  const next = reduce(s, action, ports, { resolve });
  return { state: next, keys: ghostKeys(next.graph, ports, next.ghost!, resolve(partId)), said: describeAction(s, action, next, resolve) };
};
const press = (s: EditorState, kind: 'rotateGhost' | 'flipGhost') =>
  describeAction(s, { kind }, reduce(s, { kind }, ports, { resolve }), resolve);

describe('the labels say the result', () => {
  /*
   * MUTATION PROOFS, run:
   * - one R label for both jobs (`'Turn 1/16'` always): fails with `expected
   *   { label: 'Turn 1/16', …(2) } to match object { Object (label, enabled)
   *   }`.
   * - the switch's F label replaced by the curve's: fails with `expected 'Bend
   *   the other way' to be 'Branch to the other side'`.
   * - a ramp's F label not looking at its direction (always `'Turn over:
   *   climb'`): fails with `expected 'Turn over: climb' to be 'Turn over: come
   *   down'`.
   */
  it('R: the other end on at a track end, a sixteenth on open floor', () => {
    expect(picked('C', 'A').keys.rotate).toMatchObject({ label: 'Other end on', enabled: true });
    expect(picked('C', 'L').keys.rotate).toMatchObject({ label: 'Next end on', enabled: true });
    expect(picked(null, 'A').keys.rotate).toMatchObject({ label: 'Turn 1/16', enabled: true });
  });

  it('F: bend, branch, or turn a ramp over to go the other way; nothing for a straight', () => {
    expect(picked('C', 'E').keys.flip?.label).toBe('Bend the other way');
    expect(picked('C', 'L').keys.flip?.label).toBe('Branch to the other side');
    // At C's socket end the ramp climbs by default, so F would bring it down.
    expect(picked('C', 'N').keys.flip?.label).toBe('Turn over: come down');
    expect(picked('C', 'A').keys.flip).toBeNull();
  });
});

describe('the pick announcement lists only the keys that act', () => {
  /*
   * MUTATION PROOF, run: `keyHelp` listing R whatever `enabled` says: fails
   * with `expected 'Placing Large curve. Press R to put i…' to be 'Placing
   * Large curve. Press F to bend …'`.
   */
  it('at a peg end only one end of a curve fits, so R is not offered', () => {
    expect(picked('A', 'E').said).toBe(
      'Placing Large curve. Press F to bend it the other way, Enter to place or Escape to cancel.',
    );
  });

  it('a curve at a socket end offers both', () => {
    expect(picked('C', 'E').said).toBe(
      'Placing Large curve. Press R to put its other end on, F to bend it the other way, Enter to place or Escape to cancel.',
    );
  });
});

describe('after a press, the result is said', () => {
  /*
   * MUTATION PROOFS, run:
   * - the rotate sentence without the end's name (`'Rotated it.'`): fails
   *   with `expected 'Rotated it.' to be 'Now joins the track by its curved
   *   roa…'`.
   * - a ramp's direction left out after a flip: fails with `expected 'Turned
   *   over.' to be 'Turned over. It comes down.'`.
   */
  it('which end went on, and which way a ramp now goes', () => {
    expect(press(picked('C', 'L').state, 'rotateGhost')).toBe('Now joins the track by its curved road.');
    expect(press(picked('C', 'N').state, 'flipGhost')).toBe('Turned over. It comes down.');
    expect(press(picked(null, 'A').state, 'rotateGhost')).toBe('Turned it a sixteenth.');
  });
});
