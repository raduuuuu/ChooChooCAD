/**
 * DROPPING A PIECE DRAGGED FROM THE PALETTE, IN THE REDUCER (decisions E6,
 * 6A, D13, 16A; plan task T7).
 *
 * Value: protects=over open floor the preview stands free where the pointer
 * is, still pointing the way it did; a drop that fits places it exactly there
 * as one step and joins a facing end it lands on; a drop that does not fit
 * places nothing and leaves the piece pending, and says so; only the picked
 * piece's button claims a touch gesture
 * Value: fails_when=a float loses the heading, a drop commits a red piece or
 * drops a clean one, or the touch rule goes missing
 * Value: why_new=dragging from the palette is new
 * Value: seam=none (the pure reducer and announcer; the stylesheet as text)
 * Value: no_claim=the pointer itself; see usePaletteDrag.dom.test.tsx and the
 * browser check
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { describeAction } from './announce.js';
import { lastStep, reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH, ghostFit, shiftMm } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);
const run = (ids: readonly string[]) => ids.reduce((s, partId) => act(s, { kind: 'add', partId, turn: 'left' }), START);
const lastFrame = (s: EditorState) => {
  const piece = s.graph.pieces[s.graph.pieces.length - 1]!;
  return placeAll(s.graph, ports).frames.get(piece.pieceId)!;
};

describe('over open floor', () => {
  /*
   * MUTATION PROOF, run: floatGhost sets `heading: 0`: `expected { Object
   *   (pos, heading) } to deeply equal { Object (pos, heading) }`.
   */
  it('the preview stands free at the pointer, pointing the way it did at the end', () => {
    // Two curves: the cursor's end heads a quarter turn round, so a straight
    // there points at heading 4, not 0.
    const picked = act(run(['E', 'E']), { kind: 'pick', partId: 'A' });
    const heading = ghostFit(picked.graph, ports, picked.ghost!).frame.heading;
    expect(heading).not.toBe(0);
    const floated = act(picked, { kind: 'floatGhost', pos: shiftMm(500, 300) });
    expect(floated.ghost!.at).toBeNull();
    expect(floated.ghost!.frame).toEqual({ pos: shiftMm(500, 300), heading });
    expect(floated.graph).toBe(picked.graph);
  });
});

describe('a drop onto track (the crossing bug, 2026-10-23)', () => {
  const withWood = (st: EditorState, a: EditorAction) => reduce(st, a, ports, { resolve });

  /*
   * MUTATION PROOFS, run:
   * - the reducer's dropGhost not handing `geometry` to ghostFit: `expected
   *   [ { pieceId: 'p0', …(2) }, …(1) ] to have a length of 1 but got 2`, the
   *   straight dropped on top of the first.
   * - ghostFit's wood check skipped (`if (geometry && false)`): `expected []
   *   to deeply equal [ { kind: 'over', pieceId: 'p0' } ]`.
   */
  it('lying along a placed straight places nothing and leaves the piece pending', () => {
    // The first straight runs 0..144 on y = 0; this one floats 10 mm off it
    // and 50 mm back, so no end of either is near the other's.
    const floated = withWood(withWood(run(['A']), { kind: 'pick', partId: 'A' }), {
      kind: 'floatGhost',
      pos: shiftMm(-50, 10),
    });
    expect(ghostFit(floated.graph, ports, floated.ghost!, undefined, undefined, { resolve }).conflicts).toEqual([
      { kind: 'over', pieceId: 'p0' },
    ]);
    const dropped = withWood(floated, { kind: 'dropGhost' });
    expect(dropped.graph.pieces).toHaveLength(1);
    expect(dropped.ghost).toEqual(floated.ghost);
    expect(describeAction(floated, { kind: 'dropGhost' }, dropped, resolve)).toBe(
      "Didn't place it: it doesn't fit there. Enter places it anyway, Escape cancels.",
    );
  });

  it('beside a placed straight, edges touching, places it', () => {
    const floated = withWood(withWood(run(['A']), { kind: 'pick', partId: 'A' }), {
      kind: 'floatGhost',
      pos: shiftMm(-50, 40),
    });
    expect(withWood(floated, { kind: 'dropGhost' }).graph.pieces).toHaveLength(2);
  });
});

describe('a drop', () => {
  /*
   * MUTATION PROOFS, run:
   * - dropGhost always places: the refused spec fails with `expected { Object
   *   (pieces, welds, ...) } to be { pieces: [ { …(3) } ], …(2) }`.
   * - dropGhost never places: the clean spec fails with `expected { partId:
   *   'A', at: null, …(3) } to be null`, and the join spec with `expected [
   *   Array(1) ] to have a length of 2 but got 1`.
   * - the refused drop returns `state` itself: `expected null to be 'Didn\'t
   *   place it: it doesn\'t fit the…'` (nothing is said).
   */
  it('that fits places the piece exactly where it was shown, as one step', () => {
    const floated = act(act(START, { kind: 'pick', partId: 'A' }), { kind: 'floatGhost', pos: shiftMm(300, -200) });
    const dropped = act(floated, { kind: 'dropGhost' });
    expect(dropped.ghost ?? null).toBeNull();
    expect(dropped.graph.pieces).toHaveLength(1);
    expect(lastFrame(dropped).pos).toEqual(shiftMm(300, -200));
    expect(lastStep(dropped)?.kind).toBe('place');
  });

  it('onto a facing end of the other kind joins it', () => {
    // A straight runs 0..144 with its peg at x = 144. A second straight
    // floated so its socket end sits on that peg, facing it.
    const s = run(['A']);
    const floated = act(act(s, { kind: 'pick', partId: 'A' }), { kind: 'floatGhost', pos: shiftMm(144, 0) });
    const dropped = act(floated, { kind: 'dropGhost' });
    expect(dropped.graph.pieces).toHaveLength(2);
    expect(dropped.graph.welds).toHaveLength(1);
    expect(lastStep(dropped)?.kind).toBe('placeJoin');
  });

  it('that does not fit places nothing: the piece stays pending, and the refusal is said', () => {
    // Two pegs onto the straight's peg end.
    const picked = act(run(['A']), { kind: 'pick', partId: 'B' });
    expect(ghostFit(picked.graph, ports, picked.ghost!).conflicts).not.toHaveLength(0);
    const action: EditorAction = { kind: 'dropGhost' };
    const dropped = act(picked, action);
    expect(dropped.graph).toBe(picked.graph);
    expect(dropped.ghost).toBe(picked.ghost);
    expect(describeAction(picked, action, dropped, resolve)).toBe(
      "Didn't place it: it doesn't fit there. Enter places it anyway, Escape cancels.",
    );
  });
});

describe('touch', () => {
  /*
   * MUTATION PROOF, run: the `.piece-main[data-picked]` rule removed:
   * `expected undefined to be 'none'`.
   */
  it('only the picked piece claims the gesture, so the palette still scrolls', () => {
    const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/\.piece-main\[data-picked\]\s*\{([^}]*)\}/g)];
    const last = rules
      .map((r) => /touch-action:\s*([^;]+);/.exec(r[1]!)?.[1]?.trim())
      .filter((v) => v !== undefined)
      .at(-1);
    expect(last).toBe('none');
    // And no rule takes every palette button's gesture away.
    expect(css).not.toMatch(/\.piece-main\s*\{[^}]*touch-action:\s*none/);
  });
});
