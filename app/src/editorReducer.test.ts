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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port, type PortRef } from '../../engine/src/graph/model.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import {
  initialEditor,
  reduce,
  type EditorAction,
  type EditorState,
} from './editorReducer.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
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
    expect(s.cursor).toEqual({ pieceId: s.graph.pieces[0]!.pieceId, port: 1 });
  });

  it('adding with NO CURSOR starts a SEPARATE run', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    // No cursor, then add. This is still the deliberate multi-run path, and it
    // is the ONLY way to reach it now: see the regression tests below for the
    // four ways it used to happen by accident.
    s = { ...s, cursor: null, armed: null };
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
    s = { ...s, cursor: null, armed: null };
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
  it('one click both arms a free end and targets it for the next piece', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const ref = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    s = { ...s, cursor: null, armed: null };
    s = reduce(s, { kind: 'clickPort', ref }, ports);
    // Both, because the app's header promises both: "click a free end to arm
    // it, click a piece to attach there".
    expect(s.armed).toEqual(ref);
    expect(s.cursor).toEqual(ref);
  });

  it('clicking the armed end again DISARMS it rather than welding it to itself', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const ref = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    s = reduce({ ...s, armed: ref }, { kind: 'clickPort', ref }, ports);
    expect(s.armed).toBeNull();
    expect(s.graph.welds).toHaveLength(0);
  });

  it('a second click on a DIFFERENT free end welds the two and closes the loop', () => {
    // Eight large curves is the circle preset, and it closes exactly.
    let s = START;
    for (let i = 0; i < 8; i++) s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const tail = s.cursor!;
    const head = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };

    s = reduce({ ...s, armed: tail }, { kind: 'clickPort', ref: head }, ports);

    expect(s.graph.welds).toHaveLength(8);
    expect(s.armed).toBeNull();
    // The weld consumed both ends, so there is nothing left to continue from
    // and the cursor is correctly empty. A closed loop is the one case where
    // the next click SHOULD start a new run.
    expect(s.cursor).toBeNull();
    expect(runs(s)).toBe(1);
  });
});

describe('undo and clear', () => {
  it('undo deletes the last piece and RESUMES the cursor on the end it exposed', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'undo' }, ports);

    expect(s.graph.pieces).toHaveLength(1);
    expect(s.graph.welds).toHaveLength(0);
    // Was `toBeNull()`, and that was the bug: the chain had free ends and the
    // next piece started a run 648mm away anyway.
    expect(s.cursor).toEqual({ pieceId: s.graph.pieces[0]!.pieceId, port: 1 });
    expect(s.armed).toBeNull();
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
    expect(s.cursor).toBeNull();
    expect(s.armed).toBeNull();
  });
});

describe('preset', () => {
  it('the circle preset builds eight pieces and welds its two ends', () => {
    const s = reduce(START, { kind: 'preset', ids: Array(8).fill('E') }, ports);
    expect(s.graph.pieces).toHaveLength(8);
    expect(s.graph.welds).toHaveLength(8);
    expect(runs(s)).toBe(1);
    // A closed preset leaves no free end, so there is nothing to continue
    // from. Derived, not hard-coded: see `resumeCursor`.
    expect(s.cursor).toBeNull();
    expect(s.armed).toBeNull();
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

/*
 * THE REPORTED BUG: a piece that should continue the circuit started its own
 * run 648mm away. Reported from live use on 2026-10-20.
 *
 * The user built `E E E E D E E E` and the next piece landed somewhere else on
 * the board. The model was right the whole time: a plain run of nine sequential
 * adds chains correctly and always did. What went wrong was that one field,
 * `selected`, meant three things at once -- attach here, armed for a weld, and
 * (when null) start a new run -- so anything that cleared the weld intent also
 * destroyed the attach point, and `addPiece` read the empty field as a request
 * for a second disconnected track.
 *
 * Both tests below build the user's exact sequence and then take one of the
 * two routes a person actually takes mid-build.
 */
describe('the cursor survives a disarm and an undo (reported 2026-10-20)', () => {
  const USER_SEQUENCE = ['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E'] as const;

  const build = (ids: readonly string[]): EditorState => {
    let s = START;
    for (const partId of ids) {
      s = reduce(s, { kind: 'add', partId, turn: 'left' }, ports);
    }
    return s;
  };

  /*
   * MUTATION PROOF, RUN: restore the old conflated transition by returning
   * `{ ...state, cursor: null, armed: null }` from the disarm branch of
   * `clickPort`. Exactly this test fails, and it fails at the cursor check
   * BEFORE it ever reaches the run count, which is worth recording because an
   * earlier version of this comment guessed otherwise.
   *
   * Observed: expected null to deeply equal { pieceId: 'p7', port: 1 }
   */
  it('clicking the end you just built onto does not send the next piece away', () => {
    let s = build(USER_SEQUENCE);
    const end = s.cursor!;

    /*
     * The trap, in two clicks. After every add the cursor ALREADY sits on this
     * end, and the app's header invites the user to click a free end to attach
     * there. The first click arms it; the second disarms. Under the old single
     * field the second click emptied the attach point too.
     */
    s = reduce(s, { kind: 'clickPort', ref: end }, ports);
    expect(s.armed).toEqual(end);
    s = reduce(s, { kind: 'clickPort', ref: end }, ports);
    expect(s.armed).toBeNull();
    expect(s.cursor).toEqual(end);

    s = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);

    expect(s.graph.pieces).toHaveLength(9);
    expect(s.graph.welds).toHaveLength(8);
    expect(runs(s)).toBe(1);
    // The ADDED piece carries no anchor, which is what "joined the chain"
    // means. The map as a whole is not asserted: `undo` legitimately leaves
    // the first piece an explicit identity anchor.
    const added = s.graph.pieces[8]!.pieceId;
    expect(s.graph.anchors?.has(added) ?? false).toBe(false);
  });

  /*
   * MUTATION PROOF, RUN: restore `cursor: null` in the `undo` branch. TWO
   * tests fail, this one and "undo deletes the last piece and RESUMES the
   * cursor", which is the pair you want: one pins the transition, one pins the
   * consequence a user actually sees.
   *
   * Observed here:  expected [ { …(2) }, { …(2) }, …(5) ] to have a length of
   *                 8 but got 7   (the add made no weld, so it started a run)
   * Observed there: expected null to deeply equal { pieceId: 'p0', port: 1 }
   *
   * The free ends were there the whole time, which is what made this the least
   * defensible of the routes: nobody presses undo to start a second track.
   */
  it('undo leaves the chain continuable, so the next piece joins it', () => {
    let s = build([...USER_SEQUENCE, 'E']);
    s = reduce(s, { kind: 'undo' }, ports);
    expect(s.graph.pieces).toHaveLength(8);

    s = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);

    expect(s.graph.pieces).toHaveLength(9);
    expect(s.graph.welds).toHaveLength(8);
    expect(runs(s)).toBe(1);
    const added = s.graph.pieces[8]!.pieceId;
    expect(s.graph.anchors?.has(added) ?? false).toBe(false);
  });

  it('a weld still ends the chain, because a closed loop has nothing to continue', () => {
    // The one case where an empty cursor is correct, pinned so the fix above
    // cannot quietly turn every weld into a continuation point.
    let s = build(['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E']);
    const tail = s.cursor!;
    const head = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    s = reduce({ ...s, armed: tail }, { kind: 'clickPort', ref: head }, ports);

    expect(s.graph.welds).toHaveLength(8);
    expect(s.cursor).toBeNull();
    expect(s.armed).toBeNull();
  });

  /*
   * A WELD THAT DOES NOT TOUCH THE CURSOR, one of the four reachable routes.
   *
   * Every other weld spec in this file welds one of the two ends the cursor is
   * already on, so `stillFree(graph, state.cursor)` and a bare `null` agree on
   * all of them and the branch was unpinned. Found during review, and the
   * mutation below is why it matters: the code was already right, and nothing
   * held it there.
   *
   * Two separate runs, so there are four free ends. Weld two ends that belong
   * to the OTHER run, leaving the cursor's end untouched and still free. The
   * run must stay continuable.
   *
   * MUTATION PROOF, RUN: replace `cursor: stillFree(graph, state.cursor)` with
   * `cursor: null` in the weld branch of `clickPort`. Observed:
   *   expected null to deeply equal { pieceId: 'p1', port: 1 }
   * and THIS WAS THE ONLY SPEC THAT FAILED, here or anywhere else in the
   * suite, which is exactly the hole it was added to fill.
   */
  it('a weld that consumes neither end of the cursor leaves it continuable', () => {
    // Run one: two pieces. Keep its far end; it is where the cursor will sit.
    let s = build(['E', 'E']);
    const runOneTail = s.cursor!;

    // Run two: start it deliberately with a null cursor, then grow it.
    s = { ...s, cursor: null, armed: null };
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    expect(runs(s)).toBe(2);

    // Put the cursor back on run one, then weld run two's two free ends to
    // each other. Neither is the cursor.
    const runTwo = s.graph.pieces.slice(2);
    const a = { pieceId: runTwo[0]!.pieceId, port: 0 };
    const b = { pieceId: runTwo[1]!.pieceId, port: 1 };
    s = reduce({ ...s, cursor: runOneTail, armed: a }, { kind: 'clickPort', ref: b }, ports);

    // The weld happened, and the cursor is untouched because it was elsewhere.
    expect(s.graph.welds.length).toBeGreaterThan(1);
    expect(s.armed).toBeNull();
    expect(s.cursor).toEqual(runOneTail);

    // And the point of all of it: the next piece continues run one.
    const before = runs(s);
    s = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    expect(runs(s)).toBe(before);
  });
});

/*
 * ARMED IMPLIES THE CURSOR IS ON THE SAME PORT.
 *
 * TrackCanvas leans on this. An armed end announces only "Selected free ..."
 * and suppresses the cursor ring, which drops nothing ONLY because the two
 * refs are equal whenever both are set. If some future action ever arms an
 * end without targeting it, that label silently stops announcing the cursor
 * and the ring is suppressed on a port that is not the cursor.
 *
 * Checked by walking every state reachable in four actions from an empty board
 * rather than by asserting the one case. Depth 4 visits 9497 nodes, 201 of them
 * distinct states, and 5512 of the nodes have `armed` set.
 *
 * WHAT THIS WALK CANNOT DO, because the first version of this comment claimed
 * it could: it cannot notice a NEW action. `actionsFrom` writes the four
 * non-click action kinds out by hand, so an `EditorAction` variant added later
 * is never constructed and the walk passes blind. Anyone adding an action that
 * touches `armed` must add it below as well; this spec will not remind them.
 *
 * MUTATION PROOF, RUN: in the arming branch of `clickPort`, return
 * `{ ...state, cursor: state.cursor, armed: ref }` so arming no longer moves
 * the cursor. Observed:
 *   expected [ { armed: { …(2) }, …(1) }, …(5451) ] to deeply equal []
 * Each element is one state where the two refs disagreed, and the count is
 * the point: a single overloaded write puts the editor in thousands of them.
 */
describe('the armed end and the cursor never disagree', () => {
  const same = (a: PortRef | null, b: PortRef | null): boolean =>
    a !== null && b !== null && a.pieceId === b.pieceId && a.port === b.port;

  it('holds across every state reachable in four actions', () => {
    const violations: Array<{ armed: PortRef; cursor: PortRef | null }> = [];
    let visited = 0;
    let armedNodes = 0;

    const actionsFrom = (s: EditorState): EditorAction[] => {
      const out: EditorAction[] = [
        { kind: 'add', partId: 'E', turn: 'left' },
        { kind: 'undo' },
        { kind: 'clear' },
        { kind: 'preset', ids: ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'] },
      ];
      for (const p of s.graph.pieces) {
        for (let port = 0; port < ports(p).length; port++) {
          out.push({ kind: 'clickPort', ref: { pieceId: p.pieceId, port } });
        }
      }
      return out;
    };

    const walk = (s: EditorState, depth: number): void => {
      visited++;
      if (s.armed !== null) armedNodes++;
      if (s.armed !== null && !same(s.armed, s.cursor)) {
        violations.push({ armed: s.armed, cursor: s.cursor });
      }
      if (depth === 0) return;
      for (const action of actionsFrom(s)) walk(reduce(s, action, ports), depth - 1);
    };

    walk(START, 4);

    expect(violations).toEqual([]);
    /*
     * THE GUARD COUNTS ARMED NODES, NOT VISITED ONES, and the difference is a
     * hole found in review. `visited > 200` was supposed to stop a crippled
     * `actionsFrom` from passing vacuously, but the four non-click actions
     * reach 341 nodes on their own, so deleting the `clickPort` generation --
     * the only thing that ever arms an end -- left this spec green while it
     * checked nothing at all. Measured: without clickPort, 341 visited and
     * ZERO nodes with `armed` set.
     *
     * MUTATION PROOF, RUN: replace the `for` loop over pieces and ports with
     * nothing, so `actionsFrom` returns only the four fixed actions. Observed:
     *   the walk never armed an end, so it proved nothing: expected 0 to be
     *   greater than 1000
     */
    expect(visited).toBeGreaterThan(200);
    expect(
      armedNodes,
      'the walk never armed an end, so it proved nothing',
    ).toBeGreaterThan(1000);
  });
});

/*
 * A RELOAD KEEPS THE CURSOR (the same reported bug, by the one route that
 * needs no clicks).
 *
 * The graph persists to `localStorage`; the cursor does not. So a restored
 * chain used to come back with a null cursor and the next palette click
 * started a second run beside it. Observed in a browser before the fix: a
 * restored nine-piece chain plus one click read "2 separate runs of track,
 * none of them a loop". It is the only route that needs neither an undo nor
 * a port click, only coming back to a layout; how often users actually hit it
 * is not measured anywhere.
 *
 * MUTATION PROOF, RUN: return `{ graph, cursor: null, armed: null }` from
 * `initialEditor`. THREE specs fail, not the two this note first claimed: the
 * two below, and `searches ports from the highest index down` in a later
 * describe, which also routes through `initialEditor`. Observed:
 *   expected null to deeply equal { pieceId: 'p7', port: 1 }
 *   expected 2 to be 1 // Object.is equality
 */
describe('initialEditor', () => {
  const chain = (n: number): EditorState => {
    let s = START;
    for (let i = 0; i < n; i++) s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    return s;
  };

  it('resumes the cursor on a restored graph, so a reload stays continuable', () => {
    const built = chain(8);
    const restored = initialEditor(built.graph, ports);
    expect(restored.cursor).toEqual({ pieceId: built.graph.pieces[7]!.pieceId, port: 1 });
    expect(restored.armed).toBeNull();
  });

  it('a piece added after a reload joins the chain instead of starting a run', () => {
    const restored = initialEditor(chain(8).graph, ports);
    const s = reduce(restored, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    expect(runs(s)).toBe(1);
    expect(s.graph.welds).toHaveLength(8);
  });

  it('an empty graph has no cursor, because there is nothing to continue', () => {
    expect(initialEditor(EMPTY_GRAPH, ports).cursor).toBeNull();
  });
});

/*
 * Value: protects=a preset that leaves a free end hands back a cursor on it, so the next click continues
 * Value: fails_when=the preset branch hard-codes `cursor: null` instead of deriving it via resumeCursor
 * Value: why_new=the only preset spec uses a closed circle, where null is also correct; derivation unpinned
 * Value: seam=none; reducer + initialEditor are the real exports
 * Value: no_claim=nothing about which preset the catalogue ships; one-piece id list is a synthetic input
 *
 * MUTATION PROOF, RUN: return `cursor: null` from the `preset` branch of `reduce`.
 */
describe('derived cursor paths not reached by a closed circle', () => {
  it('a preset that does not close leaves the cursor on its free far end', () => {
    const s = reduce(START, { kind: 'preset', ids: ['E'] }, ports);
    expect(s.graph.welds).toHaveLength(0);
    expect(s.cursor).toEqual({ pieceId: s.graph.pieces[0]!.pieceId, port: 1 });
    expect(s.armed).toBeNull();
  });

  /*
   * Value: protects=the cursor lands on the HIGHEST free port of the last piece, as a three-port part needs
   * Value: fails_when=resumeCursor's loop is reversed to search from port 0 upward
   * Value: why_new=only spec using a part with more than two ports; the order itself is also covered elsewhere
   * Value: seam=none; a stub PortsOf passed to the exported initialEditor, the real boundary
   * Value: no_claim=not a claim about switch geometry; the stub only supplies a port count
   *
   * THIS SPEC IS NOT THE ONLY GUARD, and an earlier version of this block said
   * it was ("ascending and descending agree today", which is false: on a
   * two-port piece with both ports free, ascending gives port 0 and descending
   * gives port 1). It earns its place by being the only spec that uses a part
   * with more than two ports, which is the case T2's three-port switch will
   * bring.
   *
   * MUTATION PROOF, RUN: change the loop to `for (let port = 0; port < n; port++)`.
   * THREE specs fail, observed:
   *   undo deletes the last piece and RESUMES the cursor on the end it exposed:
   *     expected { pieceId: 'p0', port: +0 } to deeply equal { pieceId: 'p0', port: 1 }
   *   a preset that does not close leaves the cursor on its free far end: the
   *     same shape
   *   this spec: expected { pieceId: 'only', port: +0 } to deeply equal
   *     { pieceId: 'only', port: 2 }
   */
  it('searches ports from the highest index down', () => {
    const threePorts = (piece: Piece): readonly Port[] => {
      const base = ports(piece);
      return [base[0]!, base[1]!, base[1]!];
    };
    const graph = { pieces: [{ pieceId: 'only', partId: 'E' }], welds: [] };
    expect(initialEditor(graph, threePorts).cursor).toEqual({ pieceId: 'only', port: 2 });
  });
});

/*
 * Value: protects=an armed end that an add has just welded shut does not stay armed
 * Value: fails_when=the add branch keeps `state.armed` instead of filtering it through stillFree
 * Value: why_new=no spec arms an end and then adds; every add in this suite starts with armed null
 * Value: seam=none; both are ordinary reducer transitions
 * Value: no_claim=nothing about what the canvas draws for a stale armed end, which needs no DOM here
 *
 * MUTATION PROOF, RUN: return `armed: state.armed` from the `add` branch.
 * Observed: expected { pieceId: 'p0', port: 1 } to be null.
 */
describe('an add consumes the end it attached to', () => {
  it('clears an armed end that the new weld has closed', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const end = s.cursor!;
    // Arm the very end the next piece will attach to. The add welds it, so
    // leaving it armed would offer a weld partner that is no longer free.
    s = reduce(s, { kind: 'clickPort', ref: end }, ports);
    expect(s.armed).toEqual(end);

    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);

    expect(s.armed).toBeNull();
    expect(s.graph.welds).toHaveLength(1);
    // And the cursor moved on to the new piece, so the chain still continues.
    expect(s.cursor).toEqual({ pieceId: s.graph.pieces[1]!.pieceId, port: 1 });
  });

  it('leaves an armed end alone when it is somewhere else', () => {
    // The guard filters by freeness, not by identity with the cursor, so an
    // armed end the add did not touch must survive.
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    const head = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    s = reduce({ ...s, armed: head }, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    expect(s.armed).toEqual(head);
  });
});

/*
 * Value: protects=a restored layout comes back with a cursor, so a reload does not relocate the next piece
 * Value: fails_when=App.tsx initialises the editor with a literal null cursor instead of calling initialEditor
 * Value: why_new=initialEditor is tested, its CALL SITE is not; reverting the one line restores the reported bug
 * Value: seam=none; reads App.tsx as text, the technique layoutStore.test.ts already uses for this file
 * Value: no_claim=nothing about the effect firing or what React renders; that needs a DOM, which this suite lacks
 *
 * WHY A SOURCE-TEXT PIN, when the coverage audit rejected one as
 * implementation-coupled. It is coupled, and it is still worth it here. The
 * reported bug had four reachable routes, and a PAGE RELOAD is the one that
 * needs no
 * clicks at all, because the graph persists to `localStorage` and the
 * selection does not. The fix is
 * one call at this site. `initialEditor` itself is pinned three ways above,
 * and every one of those specs stays green if App.tsx stops calling it, which
 * is precisely the shape of failure this repository keeps shipping: the model
 * correct, the wiring not. That is what the eight-runs bug was, and it is what
 * this one was.
 *
 * Sliced and anchored at BOTH ends, and the slice is asserted to reach its
 * real end, because `layoutStore.test.ts` records two versions of this
 * technique that silently went vacuous when a slice undershot.
 *
 * WHAT THIS SPEC DOES NOT CLAIM, stated first because two earlier versions of
 * it claimed more than they held and an adversarial review broke both:
 *
 *   - It does not prove the initializer RUNS, or that React calls it, or what
 *     the component renders. That needs a mounted DOM, which this suite does
 *     not have. It is task E11, and until then this is the only check standing
 *     between a correct `initialEditor` and a call site that ignores it.
 *   - It does not prove the `ports` function passed in is CORRECT. It pins the
 *     exact expression, so a changed one fails, but a source-text match cannot
 *     tell a right port list from a wrong one.
 *
 * Three ways it was defeated, each now closed:
 *
 *   1. Comments. The initializer sits under a block comment naming
 *      `initialEditor`, so a substring search matched the prose above a nulled
 *      initializer. Comments are stripped before anything is matched.
 *   2. The second argument. `initialEditor(graphLoad.value, () => [])` passed
 *      every assertion while `resumeCursor` saw no ports and returned null for
 *      every restored graph; so did
 *      `portsOf(resolve(piece.partId), piece.turn).slice(0, 1)`, which left
 *      only port 0, welded on any restored chain. The whole call is now pinned
 *      as one expression.
 *   3. Position. Wrapping the call in a helper that dropped the cursor --
 *      `disarmed(() => initialEditor(graphLoad.value, ...))` -- kept every
 *      matched substring inside a nested lambda and stayed green. The call
 *      must now be the initializer's own first expression.
 *
 * MUTATION PROOF, RUN: replace the initializer body with
 * `({ graph: graphLoad.value, cursor: null, armed: null })`. Observed:
 *   expected '...' to match /useState<EditorState>\(\s*\(\)\s*=>\s*initialEditor\(/
 *
 * SECOND MUTATION, RUN: keep the call and comment out only its argument list,
 * leaving `initialEditor(` inside a comment above a nulled initializer.
 * Observed the same failure, where the pre-strip version passed.
 *
 * THIRD MUTATION, RUN: append `.slice(0, 1)` to the `portsOf` call. Observed:
 *   expected '...' to match /initialEditor\(\s*graphLoad\.value\s*,\s*\(piece: GPiece\) =>\s*portsOf\(resolve\(piece\.partId\), piece\.turn\),?\s*\)/
 *
 * FOURTH MUTATION, RUN: wrap the call as `disarmed(() => initialEditor(...))`.
 * Observed the same failure as the first.
 */
describe('the restored-cursor wiring is present in App.tsx', () => {
  const source = readFileSync(join(import.meta.dirname, 'App.tsx'), 'utf8');

  /*
   * Block and line comments, in that order. Blunt, and enough here: this
   * slice is one `useState` call, with no string literal that could contain
   * either marker. A general stripper would need a tokenizer.
   */
  const stripComments = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

  it('derives the editor state from the stored graph rather than nulling it', () => {
    const open = 'const [editor, setEditor] = useState<EditorState>';
    const close = 'const { graph, cursor, armed } = editor;';
    const from = source.indexOf(open);
    const to = source.indexOf(close);
    expect(from, `${open} not found`).toBeGreaterThan(-1);
    expect(to, `${close} not found`).toBeGreaterThan(from);

    const body = stripComments(source.slice(from, to));
    /*
     * The CALL, in the initializer position. Not just the import, which an
     * unused one would satisfy while the initializer handed back a null
     * cursor, and not just the name, which a comment would satisfy.
     */
    // POSITION: the call is the initializer's own first expression, so a
    // wrapper that drops the cursor afterwards cannot satisfy this.
    expect(body).toMatch(/useState<EditorState>\(\s*\(\)\s*=>\s*initialEditor\(/);
    // THE WHOLE CALL, both arguments, as one expression: a narrowed or
    // replaced `ports` function changes these bytes and fails here.
    expect(body).toMatch(
      /initialEditor\(\s*graphLoad\.value\s*,\s*\(piece: GPiece\) =>\s*portsOf\(resolve\(piece\.partId\), piece\.turn\),?\s*\)/,
    );
    // And NOT the shape the bug had, whatever the spacing.
    expect(body).not.toMatch(/cursor\s*:\s*null/);
    expect(body).not.toContain('...INITIAL_EDITOR');
  });
});
