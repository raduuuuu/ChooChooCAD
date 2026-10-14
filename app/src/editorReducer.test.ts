/**
 * The editor's five transitions (task T4).
 *
 * These were untestable before the extraction: they were closures inside
 * `App.tsx` and this suite has no DOM. The defect that motivated the
 * extraction is the first test below, and it is a REGRESSION test, not a
 * hypothetical: clicking the palette eight times shipped eight separate runs
 * because every handler read `selected` from its own render closure and React
 * batched the updates, so all eight saw the same stale `null`.
 *
 * Mutation proofs are recorded with each pin, because this project has four
 * times shipped a test that restated the value it claimed to pin and so could
 * never fail. A pin whose mutation is not written down is a comment.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { reduce, type EditorState } from './editorReducer.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const START: EditorState = { graph: EMPTY_GRAPH, selected: null };
const runs = (s: EditorState) => placeAll(s.graph, ports).forest.roots.length;

describe('add', () => {
  /*
   * THE EIGHT-CLICKS BUG, PINNED.
   *
   * MUTATION PROOF, run rather than asserted, and the first attempt was
   * WRONG in an instructive way. Replacing `state.selected` with a
   * module-level `let` that each call updates does NOT fail this test: it
   * chains correctly for sequential calls, so it is not the shipped defect.
   * What fails it is a selection FROZEN at one render's value -- pass a
   * constant `null` in place of `state.selected` and this test reports 8 runs
   * instead of 1 (verified: 3 failures, this one by name). That is the real
   * bug: React batched eight updates and every handler read the same stale
   * `null` from its own closure. A mutation that still advances the selection
   * is testing something this test does not claim.
   *
   * The trick is that every call below is applied to the state the PREVIOUS
   * call returned, which is what React's updater form guarantees and what the
   * old closure-reading handlers did not.
   */
  it('eight adds applied in sequence build ONE run, not eight', () => {
    let s = START;
    for (let i = 0; i < 8; i++) s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);

    expect(s.graph.pieces).toHaveLength(8);
    expect(s.graph.welds).toHaveLength(7);
    expect(runs(s)).toBe(1);
  });

  it('derives the port count itself, so no caller can hand it a stale one', () => {
    // `add` carries only what the user did. The selection it offers next is
    // port 1, which only a 2-port part has; a count passed in from an earlier
    // render is the same class of bug as the stale selection above.
    const s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    expect(s.selected).toEqual({ pieceId: s.graph.pieces[0]!.pieceId, port: 1 });
  });

  it('adding with nothing selected starts a SEPARATE run', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    // Deselect, then add: this is the reachable multi-run path today.
    s = { ...s, selected: null };
    s = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);

    expect(runs(s)).toBe(2);
  });

  /*
   * E8 / gate decision d6: EVERY RUN AFTER THE FIRST GETS AN ANCHOR.
   *
   * MUTATION PROOF, run: restore `ports?: PortsOf` and the `&& ports` guard in
   * `addPiece`, then omit `ports` at this reducer's `add` call. The second run
   * arrives with no anchor, `placeAll` puts it at the identity on top of the
   * first, and `findVertexClashes` reports a clash in a layout the user built
   * correctly. Verified: exactly ONE test fails, this one, by name -- which is
   * what makes it a pin on the anchoring rather than a collateral failure.
   */
  it('the second run is ANCHORED, so two components cannot stack at the origin', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = { ...s, selected: null };
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);

    expect(runs(s)).toBe(2);
    const second = s.graph.pieces[1]!.pieceId;
    expect(s.graph.anchors?.has(second)).toBe(true);

    // And the two roots are placed at DIFFERENT frames, which is the thing the
    // anchor actually buys. Identical positions are the stacked-at-the-origin
    // state E8 exists to prevent.
    const placed = placeAll(s.graph, ports);
    const [a, b] = placed.forest.roots.map((id) => placed.frames.get(id)!);
    expect(a!.pos).not.toEqual(b!.pos);
  });

  it('the FIRST piece gets no anchor, because the origin is where it belongs', () => {
    const s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    expect(s.graph.anchors?.size ?? 0).toBe(0);
  });
});

describe('clickPort', () => {
  it('one click arms a free end', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const ref = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    s = { ...s, selected: null };
    s = reduce(s, { kind: 'clickPort', ref }, ports);
    expect(s.selected).toEqual(ref);
  });

  it('clicking the armed end again DISARMS it rather than welding it to itself', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const ref = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    s = reduce({ ...s, selected: ref }, { kind: 'clickPort', ref }, ports);
    expect(s.selected).toBeNull();
    expect(s.graph.welds).toHaveLength(0);
  });

  it('a second click on a DIFFERENT free end welds the two and closes the loop', () => {
    // Eight large curves is the circle preset, and it closes exactly.
    let s = START;
    for (let i = 0; i < 8; i++) s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const tail = s.selected!;
    const head = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };

    s = reduce({ ...s, selected: tail }, { kind: 'clickPort', ref: head }, ports);

    expect(s.graph.welds).toHaveLength(8);
    expect(s.selected).toBeNull();
    expect(runs(s)).toBe(1);
  });
});

describe('undo and clear', () => {
  it('undo deletes the last piece and drops the selection', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'undo' }, ports);

    expect(s.graph.pieces).toHaveLength(1);
    expect(s.graph.welds).toHaveLength(0);
    expect(s.selected).toBeNull();
  });

  it('undo on an empty canvas returns the SAME state value, not a new one', () => {
    // Identity matters: a fresh object here would re-render the whole canvas
    // on a no-op press.
    expect(reduce(START, { kind: 'undo' }, ports)).toBe(START);
  });

  it('clear empties the graph and the selection', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'clear' }, ports);
    expect(s.graph.pieces).toHaveLength(0);
    expect(s.selected).toBeNull();
  });
});

describe('preset', () => {
  it('the circle preset builds eight pieces and welds its two ends', () => {
    const s = reduce(START, { kind: 'preset', ids: Array(8).fill('E') }, ports);
    expect(s.graph.pieces).toHaveLength(8);
    expect(s.graph.welds).toHaveLength(8);
    expect(runs(s)).toBe(1);
    expect(s.selected).toBeNull();
  });

  it('a preset replaces whatever was on the canvas', () => {
    let s = reduce(START, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    s = reduce(s, { kind: 'preset', ids: ['E', 'E'] }, ports);
    expect(s.graph.pieces).toHaveLength(2);
  });

  /*
   * E8's anchor map, PINNED EXACTLY, including the empty case.
   *
   * Every catalogue part has two ports today, so every preset step attaches
   * and no preset needs an anchor: the honest pin is that the map is EMPTY.
   * Writing that down is the point. The moment a one-port buffer or T2's
   * three-port switch lands, a preset step can fail to attach, and this test
   * turns from "empty" into a real multi-run assertion rather than being
   * discovered at the keyboard.
   */
  it('the circle preset anchors nothing, because every step attaches', () => {
    const s = reduce(START, { kind: 'preset', ids: Array(8).fill('E') }, ports);
    expect(s.graph.anchors?.size ?? 0).toBe(0);
    expect(runs(s)).toBe(1);
  });

  it('a single-piece preset welds nothing', () => {
    const s = reduce(START, { kind: 'preset', ids: ['E'] }, ports);
    expect(s.graph.pieces).toHaveLength(1);
    expect(s.graph.welds).toHaveLength(0);
  });
});
