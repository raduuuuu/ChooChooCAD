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

const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null, lastAction: null };
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

describe('remove last and clear', () => {
  it('remove last deletes the last piece and RESUMES the cursor on the end it exposed', () => {
    let s = reduce(START, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
    s = reduce(s, { kind: 'removeLast' }, ports);

    expect(s.graph.pieces).toHaveLength(1);
    expect(s.graph.welds).toHaveLength(0);
    // Was `toBeNull()`, and that was the bug: the chain had free ends and the
    // next piece started a run 648mm away anyway.
    expect(s.cursor).toEqual({ pieceId: s.graph.pieces[0]!.pieceId, port: 1 });
    expect(s.armed).toBeNull();
  });

  it('remove last on an empty canvas returns the SAME state value, not a new one', () => {
    // Identity matters: a fresh object here would re-render the whole canvas
    // on a no-op press.
    expect(reduce(START, { kind: 'removeLast' }, ports)).toBe(START);
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
describe('the cursor survives a disarm and a remove-last (reported 2026-10-20)', () => {
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
    // means. The map as a whole is not asserted: `removeLast` legitimately leaves
    // the first piece an explicit identity anchor.
    const added = s.graph.pieces[8]!.pieceId;
    expect(s.graph.anchors?.has(added) ?? false).toBe(false);
  });

  /*
   * MUTATION PROOF, RUN: restore `cursor: null` in the `removeLast` branch. TWO
   * tests fail, this one and "remove last deletes the last piece and RESUMES the
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
  it('remove last leaves the chain continuable, so the next piece joins it', () => {
    let s = build([...USER_SEQUENCE, 'E']);
    s = reduce(s, { kind: 'removeLast' }, ports);
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
   * A WELD THAT DOES NOT TOUCH THE CURSOR. NOT reachable from the UI, found
   * 2026-10-22 when `cursorRoutes.dom.test.tsx` tried to drive it: selecting
   * an end also moves the cursor there, so through the app a join always
   * consumes the cursor's end (the state walk below asserts exactly that).
   * Kept because the reducer still takes any state, and a stored or future
   * action could hand it one.
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

  /*
   * A WELD THAT CONSUMES THE CURSOR, WITH A FREE END LEFT. The route the app
   * actually takes: the cursor resumes on the newest free end, as Remove last
   * and a reload do, instead of going null and starting a separate run.
   * Closing the LAST loop still clears it ('a second click on a DIFFERENT free
   * end welds the two and closes the loop', above).
   *
   * MUTATION PROOF, RUN: drop `?? resumeCursor(graph, ports)` from the weld
   * branch of `clickPort`. Fails with `expected null to deeply equal {
   * pieceId: 'p1', port: 1 }`.
   */
  it('a weld that consumes the cursor resumes on a free end that is left', () => {
    let s = build(['L', 'E']);
    const heel = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    const curved = { pieceId: s.graph.pieces[0]!.pieceId, port: 2 };
    s = reduce(s, { kind: 'clickPort', ref: heel }, ports);
    expect(s.cursor).toEqual(heel);
    s = reduce(s, { kind: 'clickPort', ref: curved }, ports);
    expect(s.cursor).toEqual({ pieceId: s.graph.pieces[1]!.pieceId, port: 1 });
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
 * rather than by asserting the one case. Depth 4 visits 27,515 nodes and 11,624
 * of them have `armed` set (re-measured 2026-10-22, after U5 added `undo` and one
 * `breakWeld` per weld; it was 9,497 and 5,512 before). Distinct states, keyed on
 * pieces, welds, cursor, armed and the kind of `lastAction`: 1,708.
 *
 * WHAT THIS WALK CANNOT DO, because the first version of this comment claimed
 * it could: it cannot notice a NEW action. `actionsFrom` writes the other
 * action kinds out by hand, so an `EditorAction` variant added later
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
        { kind: 'removeLast' },
        { kind: 'undo' },
        { kind: 'clear' },
        { kind: 'preset', ids: ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'] },
      ];
      // U5's break, once per weld, by the ports that name it.
      for (const w of s.graph.welds) out.push({ kind: 'breakWeld', a: w.a, b: w.b });
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
     * `actionsFrom` from passing vacuously, but the non-click actions reach
     * hundreds of nodes on their own, so deleting the `clickPort` generation --
     * the only thing that ever arms an end -- left this spec green while it
     * checked nothing at all. Measured before U5: without clickPort, 341
     * visited and ZERO nodes with `armed` set.
     *
     * MUTATION PROOF, RUN (re-run after U5): replace the `for` loop over pieces
     * and ports with nothing, so `actionsFrom` arms nothing. Observed:
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
 * The restored-cursor WIRING in App.tsx was pinned here as a source-text
 * check until 2026-10-22. It is now a real mount: `reload.dom.test.tsx`
 * saves a layout, mounts App, adds a piece and checks it joined the saved
 * run, which is the behaviour the reported bug broke.
 */

/*
 * TASK U5: BREAK A JOINT, AND THE ONE-STEP UNDO.
 *
 * Value: protects=breaking a joint never deletes or moves a piece, Undo
 * restores exactly what was there (anchors included), Undo reverses the step
 * its label names and only once, and a break names its weld by ports
 * Value: fails_when=undo rebuilds forward instead of restoring, a break
 * resolves a stale index, the snapshot is taken after the change, or a
 * second undo does something
 * Value: why_new=U5 adds both actions; "Remove last" is the old undo, renamed
 * and kept repeatable by the owner's ruling (2026-10-22)
 * Value: seam=the reducer is pure, so every transition runs here with no DOM
 * Value: no_claim=nothing about the click or the hover, which need a DOM
 * (E11); the canvas side is pinned as markup in `weldBreak.test.ts`
 */
describe('breaking a joint, and Undo', () => {
  const chain = (n: number, partId = 'E'): EditorState => {
    let s = START;
    for (let i = 0; i < n; i++) s = reduce(s, { kind: 'add', partId, turn: 'left' }, ports);
    return s;
  };
  const posOf = (s: EditorState) =>
    new Map([...placeAll(s.graph, ports).frames].map(([id, f]) => [id, JSON.stringify(f)]));
  const breakAt = (s: EditorState, i: number): EditorState => {
    const w = s.graph.welds[i]!;
    return reduce(s, { kind: 'breakWeld', a: w.a, b: w.b }, ports);
  };

  it('starts with nothing to undo, which is the first-paint state', () => {
    expect(initialEditor(chain(3).graph, ports).lastAction).toBeNull();
  });

  /*
   * MUTATION PROOF, run: in `breakWeld`, pass `index + 1` to `breakWeld`.
   * Fails with `expected 1 to be +0`: the weld that should be gone is still
   * there. The E4 spec below fails too.
   */
  it('breaking an interior joint leaves two drawn runs, every piece where it was', () => {
    const s = chain(4);
    const before = posOf(s);
    const broken = breakAt(s, 1);
    expect(broken.graph.pieces).toHaveLength(4);
    expect(broken.graph.welds).toHaveLength(2);
    const gone = s.graph.welds[1]!;
    expect(
      broken.graph.welds.filter(
        (w) => w.a.pieceId === gone.a.pieceId && w.b.pieceId === gone.b.pieceId,
      ).length,
    ).toBe(0);
    expect(runs(broken)).toBe(2);
    expect(posOf(broken)).toEqual(before);
    expect(broken.lastAction?.kind).toBe('break');
  });

  /*
   * E3: RESTORED, NOT REBUILT. The previous graph value comes back, anchors
   * and all.
   *
   * MUTATION PROOF, run: snapshot the break with the NEW anchors,
   * `previous: { ...state.graph, anchors: graph.anchors }`. Fails with
   * `expected Map{ 'p0' => { …(2) }, …(1) } to deeply equal Map{}`: the
   * break's freshly captured anchor survives the undo.
   */
  it('Undo after a break restores the previous graph exactly, and deletes nothing', () => {
    const s = chain(4);
    const undone = reduce(breakAt(s, 1), { kind: 'undo' }, ports);
    expect(undone.graph.pieces).toHaveLength(4);
    expect(undone.graph.welds).toEqual(s.graph.welds);
    expect(undone.graph.anchors).toEqual(s.graph.anchors);
    expect(undone.lastAction).toBeNull();
  });

  it('Undo after a placement deletes the placed piece', () => {
    const s = chain(3);
    const placed = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    expect(placed.lastAction?.kind).toBe('place');
    const undone = reduce(placed, { kind: 'undo' }, ports);
    expect(undone.graph).toBe(s.graph);
  });

  it('Undo after break-then-place deletes the placed piece and leaves the joint broken', () => {
    const broken = breakAt(chain(4), 1);
    const placed = reduce(broken, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    const undone = reduce(placed, { kind: 'undo' }, ports);
    expect(undone.graph).toBe(broken.graph);
    expect(undone.graph.welds).toHaveLength(2);
  });

  /*
   * MUTATION PROOF, run: in the `undo` case, keep `lastAction: last` instead
   * of nulling it. Fails with `expected { kind: 'break', previous: { …(3) } }
   * to be null`.
   */
  it('a second Undo does nothing', () => {
    const once = reduce(breakAt(chain(4), 1), { kind: 'undo' }, ports);
    expect(once.lastAction).toBeNull();
    expect(reduce(once, { kind: 'undo' }, ports)).toBe(once);
  });

  /*
   * E3's flow: break, undo, place, break again. Nothing may move, which a
   * re-weld undo would get wrong by leaving the first break's anchor behind.
   */
  it('break, undo, place, break leaves every piece where it was drawn', () => {
    const s = chain(4);
    const again = reduce(
      reduce(breakAt(s, 1), { kind: 'undo' }, ports),
      { kind: 'add', partId: 'A', turn: 'left' },
      ports,
    );
    const before = posOf(again);
    expect(posOf(breakAt(again, 1))).toEqual(before);
  });

  /*
   * A JOIN MOVES TRACK, SO THE NEXT BREAK MUST NOT UNDO THE MOVE (codex review,
   * 2026-10-22). Breaking a run writes an anchor for the half that lost its
   * root. Joining that half back by its OTHER end moves it, here from x=144
   * to x=-144, but the anchor stayed in the graph, and the next break found a
   * component root that "already carried an anchor" and kept it, so the half
   * jumped back to where it sat before the join.
   *
   * MUTATION PROOF, run: in `captureAnchors` (engine/src/graph/edit.ts),
   * restore `if (anchors.has(root)) continue;` ahead of the frame comparison.
   * Fails with `expected Map{ …(2) } to deeply equal Map{ …(2) }`: piece
   * p1's frame goes from x=-144 back to x=144.
   */
  it('break, rejoin by the other end, break: the rejoined half stays where the join put it', () => {
    let s = chain(2, 'A');
    s = breakAt(s, 0);
    const [p0, p1] = s.graph.pieces.map((p) => p.pieceId);
    s = reduce(s, { kind: 'clickPort', ref: { pieceId: p1!, port: 1 } }, ports);
    s = reduce(s, { kind: 'clickPort', ref: { pieceId: p0!, port: 0 } }, ports);
    expect(s.graph.welds).toHaveLength(1);
    const joined = posOf(s);
    expect(posOf(breakAt(s, 0))).toEqual(joined);
  });

  /*
   * A BREAK IN A CLOSED LOOP FREES TWO ENDS, AND THE NEXT PIECE GOES ON ONE
   * (codex review, 2026-10-22). A closed preset leaves the cursor null, and
   * the break kept it null, so a piece added next started a separate run
   * beside the opened circle. Null is right only when nothing is free, the
   * same rule a join follows.
   *
   * MUTATION PROOF, run: in `breakWeld`, return `cursor: state.cursor` again.
   * Fails with `expected null not to be null`.
   */
  it('breaking a closed preset hands the next piece an end to join', () => {
    let s = reduce(START, { kind: 'preset', ids: Array(8).fill('E') }, ports);
    expect(s.cursor).toBeNull();
    s = breakAt(s, 3);
    expect(s.cursor).not.toBeNull();
    s = reduce(s, { kind: 'add', partId: 'D', turn: 'left' }, ports);
    expect(s.graph.pieces).toHaveLength(9);
    expect(s.graph.welds).toHaveLength(8);
    expect(runs(s)).toBe(1);
  });

  /*
   * E4: a break names its weld by PORTS, either way round, and the others
   * stay identifiable by ports after the order shifts.
   *
   * MUTATION PROOF, run: in `breakWeld`, match only `same(w.a, action.a) &&
   * same(w.b, action.b)`. Fails with `expected [ { …(2) }, { …(2) }, …(1) ]
   * to have a length of 2 but got 3`: the reversed refs no longer find the
   * weld.
   */
  it('breaks the weld its two ends name, in either order, and keeps the rest', () => {
    const s = chain(4);
    const [w0, w1, w2] = s.graph.welds;
    const broken = reduce(s, { kind: 'breakWeld', a: w0!.b, b: w0!.a }, ports);
    expect(broken.graph.welds).toHaveLength(2);
    expect(broken.graph.welds).toEqual(expect.arrayContaining([w1, w2]));
  });

  it('a stale break, naming ends that are not welded, changes nothing', () => {
    const s = chain(3);
    const free = { pieceId: s.graph.pieces[2]!.pieceId, port: 1 };
    expect(reduce(s, { kind: 'breakWeld', a: free, b: free }, ports)).toBe(s);
  });

  it('a join is undoable, and Remove last, Clear and a preset leave nothing to undo', () => {
    let s = chain(8);
    const last = s.graph.pieces[7]!.pieceId;
    const first = s.graph.pieces[0]!.pieceId;
    s = reduce(s, { kind: 'clickPort', ref: { pieceId: last, port: 1 } }, ports);
    const joined = reduce(s, { kind: 'clickPort', ref: { pieceId: first, port: 0 } }, ports);
    expect(joined.lastAction?.kind).toBe('join');
    expect(reduce(joined, { kind: 'undo' }, ports).graph).toBe(s.graph);

    expect(reduce(chain(3), { kind: 'removeLast' }, ports).lastAction).toBeNull();
    expect(reduce(chain(3), { kind: 'clear' }, ports).lastAction).toBeNull();
    expect(reduce(chain(3), { kind: 'preset', ids: ['E', 'E'] }, ports).lastAction).toBeNull();
  });
});
