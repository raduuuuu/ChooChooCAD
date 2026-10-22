/**
 * Every edit the editor can make, as one pure function (task T4).
 *
 * WHY THIS FILE EXISTS
 *
 * These five updaters were already pure, and they were still untestable: they
 * lived inside `App.tsx` as closures over `resolve` and `ports`, and this
 * suite has no DOM, so nothing could call them. The defect that motivated the
 * extraction was real and shipped: clicking the palette eight times built
 * EIGHT separate runs instead of one run of eight, because each handler read
 * `selected` from its render closure and React batched the updates so all
 * eight saw the same stale `null`. The model was correct the whole time. The
 * wiring was not, which is exactly the class of bug a unit test over the
 * reducer catches and a unit test over the model cannot.
 *
 * THE BOUNDARY, DECIDED BEFORE THE TEST WAS WRITTEN
 *
 * `reduce` takes `ports` as an explicit third argument rather than closing
 * over it. That keeps it pure and keeps the component owning `resolve`, which
 * is the thing that actually needs the part library. An action carries only
 * what the user did (`partId`, `turn`, a `PortRef`), never a count derived
 * outside: `add` used to compute `count` outside the `setEditor` callback,
 * and a value derived from one render applied to a later state is the same
 * shape of defect as the stale selection above.
 */

import type { Graph, Piece as GPiece, PortRef } from '../../engine/src/graph/model.js';
import type { PortsOf } from '../../engine/src/graph/frames.js';
import type { Turn } from '../../engine/src/parts/schema.js';
import {
  EMPTY_GRAPH,
  addPiece,
  breakWeld,
  deletePiece,
  isFree,
  lastPieceId,
  weldEnds,
} from './layoutModel.js';

/**
 * The graph and the two selections are ONE value, and that is not tidiness.
 *
 * They were two `useState`s and the eight-runs bug above is what that cost.
 * Attaching a piece MOVES the cursor to its far end, so they change together
 * and must be computed together.
 *
 * WHY THERE ARE TWO SELECTIONS NOW, and why one was a bug
 *
 * There was a single `selected: PortRef | null`, and it meant three different
 * things at once: attach the next piece HERE, this end is ARMED for a weld,
 * and -- when null -- START A NEW RUN beside the existing track. Five
 * transitions cleared it (disarming a port, welding, `removeLast`, `clear`,
 * `preset`), and `addPiece` reads a null as the third meaning, so it offset
 * the piece perpendicular by `RUN_SPACING_MM` times the steps it takes to
 * clear the existing layout.
 *
 * THE FIVE TRANSITIONS ARE NOT FIVE BUGS, and the mismatch is why the field
 * survived review as long as it did. Clearing the cursor is CORRECT whenever
 * nothing is left to continue from, so two of the five are conditional:
 *
 *   - `clear` is always correct. The board is empty.
 *   - a weld is correct when it consumes the cursor, closing the loop, and
 *     accidental when the cursor sits on some third end the weld never
 *     touched -- that end is still free and the run should still continue.
 *   - a `preset` is correct when its layout closes. All three shipped presets
 *     close exactly -- measured: Circle 8 pieces/8 welds, Stadium and Near
 *     miss 10/10, zero free ends each -- so loading one and adding a piece
 *     starts a second run BY DESIGN, and always did. The fix changed nothing
 *     there. A preset that left a free end would be accidental, but none can:
 *     `PRESETS` has no one-piece entry and every catalogue part has two ports.
 *   - disarming and `removeLast` are always accidental.
 *
 * That is FOUR reachable accidental routes -- disarming, a non-consuming weld,
 * `removeLast`, and a page reload, which cleared nothing because it never restored a
 * cursor at all -- against four correct nulls: an empty board, `clear`, a
 * consuming weld, and a closing preset. The specs below assert both sides,
 * because a fix that made every null impossible would break the four that are
 * right. A non-closing preset is a fifth accidental route in the code and is
 * pinned below, but only synthetic input reaches it.
 *
 * REPORTED FROM LIVE USE, 2026-10-20: a user built `E E E E D E E E` and the
 * next piece landed on its own instead of continuing the circuit, 648mm away
 * on that layout, which is three steps of `RUN_SPACING_MM` and not a fixed
 * distance. Two routes were reproduced at the reducer, each putting the piece
 * at the same offset -- press `removeLast` and add, with two free ends available, or
 * click the armed end and add -- and the reload route was reproduced in a
 * browser. The first reproduction attempt also counted "load a preset and
 * add", which was a misreading: that behaviour is correct, as above.
 *
 * The armed-end click is the trap that made this reachable by accident. After
 * every `add` the cursor already sits on the new piece's far end, and this
 * app's own header tells the user to "click a free end to arm it, click a
 * piece to attach there". Clicking that end to attach there DISARMED it.
 *
 * So the two jobs are two fields. `cursor` survives disarming, welding and
 * remove-last; `armed` is only ever the weld partner. Null `cursor` still means
 * "start a new run", but now it only happens when there is genuinely nothing
 * to continue from: an empty board, after `clear`, or after a loop closes and
 * leaves no free end. This is the same user-visible symptom as the eight-runs
 * bug above, reached from a different direction, which is what one field
 * meaning three things buys you.
 */
export interface EditorState {
  readonly graph: Graph;
  /** Where the next piece attaches. Null starts a new run beside the track. */
  readonly cursor: PortRef | null;
  /** A free end waiting for a weld partner. Null means nothing is armed. */
  readonly armed: PortRef | null;
  /** The one step Undo can reverse, or null when there is none. See `LastAction`. */
  readonly lastAction: LastAction | null;
  /**
   * Whether any action so far CHANGED THE GRAPH. Absent means false.
   *
   * This is the graph store's "the user has acted" acknowledgement, and it
   * lives here, decided from the reducer's result, because the old flag was
   * set by `dispatch` on every action: arming an end, clicking an armed end
   * again, `clear` on an empty board. Each of those changes nothing and was
   * still read as consent to write over a layout that loaded with losses
   * (brio-TODOS.md, "A no-op edit counts as consent to overwrite"; decision
   * D17 of the 2026-10-22 editing plan). Computed inside the updater, from
   * the exact state the action ran on, so a batch of clicks cannot read a
   * stale value.
   */
  readonly edited?: boolean;
}

/**
 * THE ONE STEP UNDO CAN REVERSE (task U5, Y1 decision 5).
 *
 * One step, not a history: undoing twice does nothing the second time, and
 * the control says so by disabling itself rather than doing nothing silently.
 *
 * It carries the PREVIOUS GRAPH VALUE, not a description of what changed
 * (finding E3). A `{ break, a, b }` record would undo by re-welding, and
 * `weldEnds` is not the inverse of `removeWeld`: the break re-captures
 * anchors through `captureAnchors`, which never rewrites an anchor already
 * written, so a re-weld leaves the freed component's new anchor behind and a
 * later break reuses it at a stale frame. Restoring the value is exact by
 * construction, and `Graph` is immutable and structurally shared, so the
 * snapshot costs a few pointers.
 *
 * `join` is not in the plan's three labels. Welding two ends is as easy to do
 * by accident as breaking one, and with the previous graph in hand undoing it
 * costs nothing, so it gets "Undo join" rather than a disabled control.
 *
 * "Remove last" is a separate control and does NOT go through this: it stays
 * repeatable and works on a layout loaded from storage, which a one-step Undo
 * cannot (the owner's ruling, 2026-10-22).
 */
export interface LastAction {
  readonly kind: 'place' | 'break' | 'join';
  readonly previous: Graph;
}

export type EditorAction =
  | { readonly kind: 'add'; readonly partId: string; readonly turn: Turn }
  | { readonly kind: 'clickPort'; readonly ref: PortRef }
  /**
   * Break the weld between these two ends (task U5). Ports, not a weld index
   * (finding E4): breaking reorders `graph.welds`, so an index read from one
   * render and applied to a newer graph breaks the wrong weld.
   */
  | { readonly kind: 'breakWeld'; readonly a: PortRef; readonly b: PortRef }
  /** Delete the newest piece. Repeatable; the old "undo". */
  | { readonly kind: 'removeLast' }
  /** Reverse `lastAction`, once. */
  | { readonly kind: 'undo' }
  | { readonly kind: 'clear' }
  | { readonly kind: 'preset'; readonly ids: readonly string[] };

/**
 * The editor state for a graph restored from storage.
 *
 * A RELOAD USED TO LOSE THE CURSOR, which is the same reported bug by the one
 * route that takes no clicks at all: the graph persists to `localStorage` and
 * the cursor does not, so anyone who refreshed the tab or came back to a
 * layout later had their next palette click start a second run beside it.
 * That makes it the route a user can hit without touching a free end, which
 * is a claim about the interaction and not a measurement of how often it
 * happens; nothing here counts real sessions.
 * Observed in a browser before this existed: a restored nine-piece chain plus
 * one click read "2 separate runs of track, none of them a loop".
 *
 * `resumeCursor` is the same function `removeLast` uses, so a restored chain and a
 * shortened one resume identically. Null comes back only for an empty graph or
 * one with no free port anywhere -- not merely one whose newest piece is
 * welded shut, which is the narrower thing this comment used to claim and the
 * hole `resumeCursor` was widened to close.
 */
export function initialEditor(graph: Graph, ports: PortsOf): EditorState {
  return { graph, cursor: resumeCursor(graph, ports), armed: null, lastAction: null };
}

/**
 * The free end a chain continues from, derived from the graph alone.
 *
 * Called from three places, which is why it takes no hint about what just
 * happened: `removeLast` after a piece is removed, `initialEditor` for a graph
 * restored from storage, and `preset` for a freshly built one. A restored
 * chain, a shortened one and a loaded preset therefore resume identically.
 *
 * NEWEST PIECE FIRST, THEN BACKWARDS, and the second half of that is a fix
 * for a hole found in review. This used to examine the last piece ONLY and
 * return null if it was welded shut.
 *
 * On a board built by this version that looks unreachable, and the argument is
 * worth writing down because it is why the hole survived: a second component
 * can only be started from a null cursor, a null cursor only happens when the
 * open component has no free end left, so the newest piece is always in the
 * open component. Two review probes searched canvas-reachable states for a
 * counterexample and neither found one. Neither is a proof, and the invariant
 * is emergent rather than enforced anywhere, so the scan below does not rely
 * on it.
 *
 * It is reachable from STORAGE. The bug this file exists to fix is exactly what
 * produced multi-run boards, so a layout saved by the shipped buggy version can
 * hold an open run followed by a closed loop. Reading only the last piece
 * returned null there while the earlier run still had two free ends, and the
 * next piece started a third run -- the reported bug again, on reload, for
 * precisely the people who hit it the first time.
 *
 * Within each piece the search runs from the HIGHEST port down, so a two-port
 * piece yields port 1, its far end, which is where a run continues. Returns
 * null for an empty graph and for one with no free port anywhere, and then a
 * new run really is the only thing the next click can do.
 */
function resumeCursor(graph: Graph, ports: PortsOf): PortRef | null {
  const last = lastPieceId(graph);
  if (last === null) return null;
  const newestFirst = [...graph.pieces].reverse();
  const from = newestFirst.findIndex((p) => p.pieceId === last);
  for (const piece of from === -1 ? newestFirst : newestFirst.slice(from)) {
    for (let port = ports(piece).length - 1; port >= 0; port--) {
      const ref: PortRef = { pieceId: piece.pieceId, port };
      if (isFree(graph, ref)) return ref;
    }
  }
  return null;
}

/** An armed end that a weld has consumed is stale and must not stay armed. */
function stillFree(graph: Graph, ref: PortRef | null): PortRef | null {
  return ref !== null && isFree(graph, ref) ? ref : null;
}

/**
 * How many ports a part has, without a piece to ask about yet.
 *
 * `PortsOf` takes a placed piece, and `add` runs before the piece exists. The
 * id is the only field `ports` does not read (it reads `partId` and `turn`),
 * so a provisional one is sound here and nothing downstream sees it.
 */
function portCountOf(ports: PortsOf, partId: string, turn: Turn): number {
  const provisional: GPiece = { pieceId: '', partId, turn };
  return ports(provisional).length;
}

export function reduce(
  state: EditorState,
  action: EditorAction,
  ports: PortsOf,
): EditorState {
  const next = step(state, action, ports);
  // Same object back means nothing happened; keeping its identity lets React
  // skip the render, and the acknowledgement cannot change.
  if (next === state) return next;
  // Sticky: several branches build a fresh state literal, and one of those
  // must not quietly drop an acknowledgement an earlier edit gave.
  const edited = state.edited === true || next.graph !== state.graph;
  return edited === (next.edited === true) ? next : { ...next, edited };
}

function step(state: EditorState, action: EditorAction, ports: PortsOf): EditorState {
  switch (action.kind) {
    case 'add': {
      const count = portCountOf(ports, action.partId, action.turn);
      // Reads the cursor it is HANDED, never one in scope. This is the
      // line the eight-runs regression test pins.
      const next = addPiece(
        state.graph,
        action.partId,
        action.turn,
        count,
        state.cursor,
        ports,
      );
      // The add welds the cursor's port, so an end armed on it is now stale.
      return {
        graph: next.graph,
        cursor: next.select,
        armed: stillFree(next.graph, state.armed),
        lastAction: { kind: 'place', previous: state.graph },
      };
    }

    /*
     * Clicking a free end. One click arms it AND targets it, which is the
     * interaction this app's header documents: "click a free end to arm it,
     * click a piece to attach there". A second click on a DIFFERENT free end
     * welds the two, which is what closing a loop is now that
     * `closed: boolean` is gone.
     *
     * Clicking the ARMED end disarms the weld intent and LEAVES THE CURSOR
     * ALONE. That is one of the reachable routes to the reported bug,
     * and the one
     * a user following the header hits first: when both meanings lived in one
     * field, clicking the end you had just built onto sent the next piece off
     * to start its own run. Which route the original report took is not
     * recorded, so this line is not "the" bug, just the nearest one.
     */
    case 'clickPort': {
      const { ref } = action;
      const { armed } = state;
      if (armed && armed.pieceId === ref.pieceId && armed.port === ref.port) {
        return { ...state, armed: null };
      }
      if (armed) {
        const graph = weldEnds(state.graph, armed, ref);
        /*
         * The weld consumes both ends, so a cursor on either is stale and
         * must go. A cursor on a THIRD end is not stale and must stay: that
         * end is still free, and dropping it is another of the four routes
         * to the reported bug. `stillFree` is what tells the two cases apart, and
         * replacing it with a bare `null` passes every other spec in this
         * file, so there is one below that exists only to catch that.
         *
         * AND WHEN THE WELD DID CONSUME IT, resume where Remove last and a
         * reload resume (owner's ruling, 2026-10-22). Selecting an end also
         * moves the cursor there, so through the UI a join always consumes the
         * cursor's end. Nulling it then sent the next piece off to start a
         * separate run even with free ends left elsewhere -- join a switch's
         * heel to its own curved road and the E beyond it was abandoned. Null
         * is right only when nothing is left to continue from, which
         * `resumeCursor` already decides: closing the last loop still clears it.
         */
        return {
          graph,
          cursor: stillFree(graph, state.cursor) ?? resumeCursor(graph, ports),
          armed: null,
          lastAction: { kind: 'join', previous: state.graph },
        };
      }
      return { ...state, cursor: ref, armed: ref };
    }

    case 'breakWeld': {
      const same = (x: PortRef, y: PortRef) => x.pieceId === y.pieceId && x.port === y.port;
      const index = state.graph.welds.findIndex(
        (w) =>
          (same(w.a, action.a) && same(w.b, action.b)) ||
          (same(w.a, action.b) && same(w.b, action.a)),
      );
      // A weld that is already gone is a stale click, not an error.
      if (index === -1) return state;
      const graph = breakWeld(state.graph, ports, index);
      /*
       * The cursor and the armed end both stay: a break frees ends and claims
       * none, so whatever was free is still free. Both freed ends appear as
       * free ends in the same paint, which is the visible cause of the
       * verdict going from green to grey (Y1 decision 5).
       *
       * A NULL CURSOR DOES NOT STAY. A closed loop has nothing free, so its
       * cursor is null; breaking it frees two ends, and keeping null sent the
       * next piece off to start a separate run beside the opened loop (codex
       * review, 2026-10-22). It resumes as a join and a reload do.
       */
      return {
        graph,
        cursor: state.cursor ?? resumeCursor(graph, ports),
        armed: state.armed,
        lastAction: { kind: 'break', previous: state.graph },
      };
    }

    case 'undo': {
      const last = state.lastAction;
      if (last === null) return state;
      const graph = last.previous;
      /*
       * Keep the cursor if it still names a free end of a piece that exists
       * in the restored graph; otherwise resume where `resumeCursor` would on
       * a reload. Undoing a placement deletes the piece the cursor sat on.
       */
      const keep =
        state.cursor !== null &&
        graph.pieces.some((p) => p.pieceId === state.cursor!.pieceId) &&
        isFree(graph, state.cursor)
          ? state.cursor
          : resumeCursor(graph, ports);
      return { graph, cursor: keep, armed: null, lastAction: null };
    }

    case 'removeLast': {
      const last = lastPieceId(state.graph);
      /*
       * `=== null`, not `!last`. `loadGraph` validates a pieceId only as a
       * string, so `""` survives a restore, and `!last` made Undo a silent
       * permanent no-op on such a board while Add kept welding onto it.
       * `resumeCursor` and `addPiece` both test against null; this was the
       * last loose comparison.
       */
      if (last === null) return state;
      /*
       * The cursor RESUMES on the end the deletion just exposed. It used to
       * become null, so the piece you added next started a new run even
       * though the chain had two free ends sitting there. Nobody presses Remove last
       * in order to start a second track.
       */
      const graph = deletePiece(state.graph, ports, last);
      // Clears `lastAction`: its snapshot describes a graph this one no
      // longer follows from, so its label would name the wrong step.
      return { graph, cursor: resumeCursor(graph, ports), armed: null, lastAction: null };
    }

    case 'clear':
      return { graph: EMPTY_GRAPH, cursor: null, armed: null, lastAction: null };

    /*
     * A preset builds a run and then welds its two ends, exactly as a user
     * would: there is no "closed" flag left to set.
     *
     * `ports` is passed on every step (gate decision d6). It used to be
     * omitted here while `add` passed it, and `addPiece` only anchors a new
     * run when it HAS `ports`. So a preset step that failed to attach started
     * a run with no anchor, which `frames.ts` then places at the identity,
     * stacked on whatever is already at the origin and read by the solver as
     * a clash. Every catalogue part has two ports today, so no shipped preset
     * reaches that state; a one-port buffer or T2's three-port switch would.
     * `ports` is now required by `addPiece`, so the two call sites cannot
     * drift apart again.
     */
    case 'preset': {
      let graph = EMPTY_GRAPH;
      let at: PortRef | null = null;
      for (const partId of action.ids) {
        const count = portCountOf(ports, partId, 'left');
        const step = addPiece(graph, partId, 'left', count, at, ports);
        graph = step.graph;
        at = step.select;
      }
      if (graph.pieces.length > 1 && at) {
        graph = weldEnds(graph, at, { pieceId: graph.pieces[0]!.pieceId, port: 0 });
      }
      /*
       * A closed preset leaves no free end, so `resumeCursor` returns null and
       * the next click correctly starts a new run. Derived rather than hard
       * null, so a preset that ever fails to close still hands back a usable
       * cursor instead of silently relocating the next piece.
       */
      return { graph, cursor: resumeCursor(graph, ports), armed: null, lastAction: null };
    }
  }
}
