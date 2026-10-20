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
 * transitions cleared it (disarming a port, welding, `undo`, `clear`,
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
 *   - disarming and `undo` are always accidental.
 *
 * That is FOUR reachable accidental routes -- disarming, a non-consuming weld,
 * `undo`, and a page reload, which cleared nothing because it never restored a
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
 * at the same offset -- press `undo` and add, with two free ends available, or
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
 * undo; `armed` is only ever the weld partner. Null `cursor` still means
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
}

export type EditorAction =
  | { readonly kind: 'add'; readonly partId: string; readonly turn: Turn }
  | { readonly kind: 'clickPort'; readonly ref: PortRef }
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
 * `resumeCursor` is the same function `undo` uses, so a restored chain and a
 * shortened one resume identically. Null comes back only for an empty graph or
 * one with no free port anywhere -- not merely one whose newest piece is
 * welded shut, which is the narrower thing this comment used to claim and the
 * hole `resumeCursor` was widened to close.
 */
export function initialEditor(graph: Graph, ports: PortsOf): EditorState {
  return { graph, cursor: resumeCursor(graph, ports), armed: null };
}

/**
 * The free end a chain continues from, derived from the graph alone.
 *
 * Called from three places, which is why it takes no hint about what just
 * happened: `undo` after a piece is removed, `initialEditor` for a graph
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
     * ALONE. That is one of the four reachable routes to the reported bug,
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
         */
        return { graph, cursor: stillFree(graph, state.cursor), armed: null };
      }
      return { ...state, cursor: ref, armed: ref };
    }

    case 'undo': {
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
       * though the chain had two free ends sitting there. Nobody presses undo
       * in order to start a second track.
       */
      const graph = deletePiece(state.graph, ports, last);
      return { graph, cursor: resumeCursor(graph, ports), armed: null };
    }

    case 'clear':
      return { graph: EMPTY_GRAPH, cursor: null, armed: null };

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
      return { graph, cursor: resumeCursor(graph, ports), armed: null };
    }
  }
}
