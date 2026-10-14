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
  lastPieceId,
  weldEnds,
} from './layoutModel.js';

/**
 * The graph and the selection are ONE value, and that is not tidiness.
 *
 * They were two `useState`s and the eight-runs bug above is what that cost.
 * Attaching a piece MOVES the selection to its far end, so the two change
 * together and must be computed together.
 */
export interface EditorState {
  readonly graph: Graph;
  readonly selected: PortRef | null;
}

export type EditorAction =
  | { readonly kind: 'add'; readonly partId: string; readonly turn: Turn }
  | { readonly kind: 'clickPort'; readonly ref: PortRef }
  | { readonly kind: 'undo' }
  | { readonly kind: 'clear' }
  | { readonly kind: 'preset'; readonly ids: readonly string[] };

export const INITIAL_SELECTION: PortRef | null = null;

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
      // Reads the selection it is HANDED, never one in scope. This is the
      // line the eight-runs regression test pins.
      const next = addPiece(
        state.graph,
        action.partId,
        action.turn,
        count,
        state.selected,
        ports,
      );
      return { graph: next.graph, selected: next.select };
    }

    /*
     * Clicking a free end. One click arms it; a second click on a DIFFERENT
     * free end welds the two together, which is what closing a loop is now
     * that `closed: boolean` is gone. Clicking the armed end again disarms it.
     */
    case 'clickPort': {
      const armed = state.selected;
      const { ref } = action;
      if (armed && armed.pieceId === ref.pieceId && armed.port === ref.port) {
        return { ...state, selected: null };
      }
      if (armed) return { graph: weldEnds(state.graph, armed, ref), selected: null };
      return { ...state, selected: ref };
    }

    case 'undo': {
      const last = lastPieceId(state.graph);
      if (!last) return state;
      return { graph: deletePiece(state.graph, ports, last), selected: null };
    }

    case 'clear':
      return { graph: EMPTY_GRAPH, selected: null };

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
      return { graph, selected: null };
    }
  }
}
