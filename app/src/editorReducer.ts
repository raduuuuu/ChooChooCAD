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

import type { Cyc } from '../../engine/src/geom/cyclotomic.js';
import { IDENTITY, norm16, type Frame, type Graph, type Piece as GPiece, type PortRef } from '../../engine/src/graph/model.js';
import { placeAll, type PortsOf } from '../../engine/src/graph/frames.js';
import type { Turn } from '../../engine/src/parts/schema.js';
import {
  EMPTY_GRAPH,
  addPiece,
  autoJoin,
  breakWeld,
  defaultFit,
  deletePiece,
  isFree,
  joinRefusal,
  fitOptions,
  frameAt,
  ghostFit,
  lastPieceId,
  moveRun,
  nextRunAnchor,
  rotateCycle,
  weldEnds,
  type Fit,
  type FitGeometry,
} from './layoutModel.js';
import { connectorSites } from '../../engine/src/graph/feasible.js';

/**
 * The graph and everything the user has pointed at are ONE value, and that is
 * not tidiness. It began as the graph and two port selections, `cursor` and
 * `armed`, which is what most of this note is about; the selected piece, the
 * piece being placed and the undo history joined it later, for the same
 * reason.
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
  /**
   * What Undo walks back through, oldest first, at most HISTORY_LIMIT steps.
   * Each step holds the graph BEFORE it. Absent means empty. See `Step`.
   */
  readonly past?: readonly Step[];
  /**
   * What Redo walks forward through, nearest LAST; each holds the graph AFTER
   * it. Any new edit empties it. Absent means empty.
   */
  readonly future?: readonly Step[];
  /**
   * The piece the user selected on the canvas or in the list, by id (decision
   * R1/D2). Absent means none. Never set together with an armed end.
   */
  readonly selected?: string | null;
  /**
   * The piece being placed, before it is placed (decision R3). Absent means
   * none. Never set together with a selection or an armed end.
   */
  readonly ghost?: Ghost | null;
  /**
   * Why the last move of a run was refused, shown until the next action
   * (decision 6A). Absent means nothing was refused.
   */
  readonly refusal?: string | null;
  /**
   * Why the last drop joined nothing although an end was in reach: that end
   * is on the other level (two-layer plan, design 5A as amended by eng
   * re-run D1). Shown until the next action, like `refusal`.
   */
  readonly dropHint?: string | null;
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
 * ONE STEP OF THE UNDO HISTORY (task U5; made multi-step by decision D12 of
 * the 2026-10-22 editing plan, superseding U5's one-step ruling).
 *
 * Up to HISTORY_LIMIT steps back, and Redo forward again until any new edit.
 * Drag, remove-any and moving runs make several regretted edits in a row
 * routine, which one step could not recover.
 *
 * Each step carries a GRAPH VALUE, not a description of what changed
 * (finding E3). A `{ break, a, b }` record would undo by re-welding, and
 * `weldEnds` is not the inverse of `removeWeld`: the break re-captures
 * anchors through `captureAnchors`, which never rewrites an anchor already
 * written, so a re-weld leaves the freed component's new anchor behind and a
 * later break reuses it at a stale frame. Restoring the value is exact by
 * construction, and `Graph` is immutable and structurally shared, so fifty
 * snapshots cost a few pointers each.
 *
 * "Remove last" stays as its own control (the owner's ruling, 2026-10-22): it
 * works on a layout loaded from storage, where the history is empty. It is
 * now a step like any other, so Undo brings the piece back. `clear` and
 * `preset` start a fresh history, as they always reset the old one-step Undo.
 */
/**
 * A PIECE BEING PLACED (decision R3, with E2 and 18A).
 *
 * Attached to a free end (`at`), it goes on by `port` with `turn`, one of the
 * part's `fitOptions` there. With nowhere to attach (an empty floor, or every
 * end joined) it stands free at `frame`. Nothing in the graph changes until
 * Place; the canvas draws it from this alone.
 */
export interface Ghost {
  readonly partId: string;
  readonly at: PortRef | null;
  readonly frame: Frame | null;
  readonly turn: Turn;
  readonly port: number;
}

export interface Step {
  readonly kind: 'place' | 'placeJoin' | 'break' | 'join' | 'remove' | 'move';
  /** In `past`, the graph before the step; in `future`, the graph after it. */
  readonly graph: Graph;
}

/** How many steps Undo keeps (decision D12). */
export const HISTORY_LIMIT = 50;

/** The step Undo would reverse, or null. */
export const lastStep = (s: EditorState): Step | null => s.past?.[s.past.length - 1] ?? null;
/** The step Redo would repeat, or null. */
export const nextStep = (s: EditorState): Step | null => s.future?.[s.future.length - 1] ?? null;

/** History after an edit of `kind`: the old graph remembered, Redo emptied. */
function remember(state: EditorState, kind: Step['kind']): Pick<EditorState, 'past' | 'future'> {
  return {
    past: [...(state.past ?? []), { kind, graph: state.graph }].slice(-HISTORY_LIMIT),
    future: [],
  };
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
  /** Step back through `past`. */
  | { readonly kind: 'undo' }
  /** Step forward through `future`. */
  | { readonly kind: 'redo' }
  /** Select a piece, or clear the selection (null, or the selected piece again). */
  | { readonly kind: 'selectPiece'; readonly pieceId: string | null }
  /** Remove any piece, not just the newest (decision R1/D2). */
  | { readonly kind: 'removePiece'; readonly pieceId: string }
  /** Start placing a piece: show it where it would go (decision R3). */
  | { readonly kind: 'pick'; readonly partId: string }
  /** Turn the pending piece to its next way of going on (R). */
  | { readonly kind: 'rotateGhost' }
  /** Bend the pending curve or switch the other way (F, decision 18A). */
  | { readonly kind: 'flipGhost' }
  /** Move the pending piece to another free end (decision E2). */
  | { readonly kind: 'moveGhost'; readonly ref: PortRef }
  /** Move the pending piece to the next or previous free end ([ and ]). */
  | { readonly kind: 'stepGhost'; readonly by: 1 | -1 }
  /**
   * Stand the pending piece free with its origin at `pos`, keeping the way it
   * points (a palette drag over open floor, decision E6).
   */
  | { readonly kind: 'floatGhost'; readonly pos: Cyc }
  /** Place the pending piece as shown. */
  | { readonly kind: 'placeGhost' }
  /**
   * The end of a palette drag (decisions E6, 6A): place the pending piece if
   * it fits clean, else leave it pending, red, for Place or Cancel.
   */
  | { readonly kind: 'dropGhost' }
  /** Drop the pending piece. */
  | { readonly kind: 'cancelGhost' }
  /**
   * Move the whole run holding `pieceId`: turn it `turns` sixteenths about
   * that piece's first end, then shift it by `by` (decisions E6, D10, D14).
   */
  | {
      readonly kind: 'moveRun';
      readonly pieceId: string;
      readonly turns: number;
      readonly by: Cyc;
      /** A free end on the other level was in snap reach on release (computed by the caller). */
      readonly otherLevelNear?: boolean;
    }
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
  return { graph, cursor: resumeCursor(graph, ports), armed: null };
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

/**
 * An end that a weld has consumed, or whose piece is gone, is stale. `isFree`
 * only asks whether a weld names the end, so a removed piece's ends would
 * read as free without the existence check (found by the remove-any specs).
 */
function stillFree(graph: Graph, ref: PortRef | null): PortRef | null {
  return ref !== null &&
    graph.pieces.some((p) => p.pieceId === ref.pieceId) &&
    isFree(graph, ref)
    ? ref
    : null;
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

/** Every free end, in placement order: the order `[` and `]` step through. */
function freeEnds(graph: Graph, ports: PortsOf): PortRef[] {
  const out: PortRef[] = [];
  for (const piece of graph.pieces) {
    for (let port = 0; port < ports(piece).length; port++) {
      const ref = { pieceId: piece.pieceId, port };
      if (isFree(graph, ref)) out.push(ref);
    }
  }
  return out;
}

/**
 * A pending piece at a free end, keeping the turn it had where that fits. A
 * fresh pick passes no turn and starts on `defaultFit`, exactly where a
 * double-click puts it (9A). Preferring 'left' there showed the other bend at
 * a start end, where the auto-flip stores 'right' (QA ISSUE-002).
 */
function ghostAt(graph: Graph, ports: PortsOf, partId: string, at: PortRef, turn: Turn | null): Ghost {
  const { options } = fitOptions(graph, ports, at, partId);
  // The kept turn only among ways that need no adapter (outside voice OV5): a
  // preview moved from a peg end to a socket end must not land the adapter way.
  const fit = options.find((o) => o.turn === turn && !o.adapter) ?? defaultFit(graph, ports, at, partId);
  return { partId, at, frame: null, turn: fit.turn, port: fit.port };
}

/**
 * Where a newly picked piece starts (decision R3, table "pick"): at the
 * cursor; with no cursor, standing free at the origin on an empty floor or
 * beside the track when every end is joined.
 */
function newGhost(state: EditorState, partId: string, ports: PortsOf): Ghost {
  const at = stillFree(state.graph, state.cursor);
  if (at) return ghostAt(state.graph, ports, partId, at, null);
  const frame = state.graph.pieces.length === 0 ? IDENTITY : nextRunAnchor(state.graph, ports);
  return { partId, at: null, frame, turn: 'left', port: 0 };
}

/** The next way in R's cycle (`rotateCycle`), or null when there is no other. */
function rotated(options: readonly Fit[], g: Ghost): Fit | null {
  const cycle = rotateCycle(options, g.turn);
  if (cycle.length < 2) return null;
  const i = cycle.findIndex((o) => o.port === g.port && o.turn === g.turn);
  return cycle[(i + 1) % cycle.length]!;
}

/** The option with the other turn, the same end if it can (F), or null. */
function flipped(options: readonly Fit[], g: Ghost): Fit | null {
  const other = options.filter((o) => o.turn !== g.turn);
  return other.find((o) => o.port === g.port) ?? other[0] ?? null;
}

export function reduce(
  state: EditorState,
  action: EditorAction,
  ports: PortsOf,
  /**
   * Plank shapes, for the drop guard's wood check. Optional so a test of
   * anything else can leave it out; the app always passes it.
   */
  geometry?: FitGeometry,
): EditorState {
  const raw = step(state, action, ports, geometry);
  // Same object back means nothing happened; keeping its identity lets React
  // skip the render, and the acknowledgement cannot change.
  if (raw === state) return raw;
  // A refusal is said until the next action, whatever that is.
  const stepped =
    action.kind !== 'moveRun' && (raw.refusal || raw.dropHint) ? { ...raw, refusal: null, dropHint: null } : raw;
  // A selection never outlives its piece, whichever action removed it.
  const next =
    stepped.selected != null && !stepped.graph.pieces.some((p) => p.pieceId === stepped.selected)
      ? { ...stepped, selected: null }
      : stepped;
  // Sticky: several branches build a fresh state literal, and one of those
  // must not quietly drop an acknowledgement an earlier edit gave.
  const edited = state.edited === true || next.graph !== state.graph;
  return edited === (next.edited === true) ? next : { ...next, edited };
}

function step(state: EditorState, action: EditorAction, ports: PortsOf, geometry?: FitGeometry): EditorState {
  switch (action.kind) {
    case 'add': {
      const count = portCountOf(ports, action.partId, action.turn);
      // Reads the cursor it is HANDED, never one in scope. This is the
      // line the eight-runs regression test pins.
      // At a free cursor, the same default as the preview (defaultFit).
      const at = stillFree(state.graph, state.cursor);
      const next = addPiece(
        state.graph,
        action.partId,
        action.turn,
        count,
        state.cursor,
        ports,
        at ? defaultFit(state.graph, ports, at, action.partId) : undefined,
      );
      /*
       * Now a DIRECT placement (decision 9A: a double-click on the palette, or
       * Shift+Enter), so it joins what it lands on exactly as Place does.
       */
      const placed = autoJoin(next.graph, ports, next.graph.pieces[next.graph.pieces.length - 1]!.pieceId);
      // The add welds the cursor's port, so an end armed on it is now stale.
      return {
        graph: placed.graph,
        cursor: stillFree(placed.graph, next.select) ?? resumeCursor(placed.graph, ports),
        armed: stillFree(placed.graph, state.armed),
        ghost: null,
        ...remember(state, placed.joined > 0 ? 'placeJoin' : 'place'),
      };
    }

    case 'pick': {
      if (state.ghost?.partId === action.partId) return state;
      return { ...state, ghost: newGhost(state, action.partId, ports), selected: null, armed: null };
    }

    case 'rotateGhost':
    case 'flipGhost': {
      const g = state.ghost;
      if (!g) return state;
      if (g.at === null) {
        if (action.kind === 'flipGhost') return { ...state, ghost: { ...g, turn: g.turn === 'left' ? 'right' : 'left' } };
        return { ...state, ghost: { ...g, frame: { ...g.frame!, heading: norm16(g.frame!.heading + 1) } } };
      }
      const { options } = fitOptions(state.graph, ports, g.at, g.partId);
      const next = action.kind === 'rotateGhost' ? rotated(options, g) : flipped(options, g);
      return next ? { ...state, ghost: { ...g, ...next } } : state;
    }

    case 'moveGhost': {
      const g = state.ghost;
      if (!g || stillFree(state.graph, action.ref) === null) return state;
      return { ...state, cursor: action.ref, ghost: ghostAt(state.graph, ports, g.partId, action.ref, g.turn) };
    }

    case 'stepGhost': {
      const g = state.ghost;
      if (!g) return state;
      const ends = freeEnds(state.graph, ports);
      if (ends.length === 0) return state;
      const i = g.at ? ends.findIndex((e) => e.pieceId === g.at!.pieceId && e.port === g.at!.port) : -1;
      const to = ends[(i + action.by + ends.length) % ends.length]!;
      return { ...state, cursor: to, ghost: ghostAt(state.graph, ports, g.partId, to, g.turn) };
    }

    case 'placeGhost': {
      const g = state.ghost;
      if (!g) return state;
      const count = portCountOf(ports, g.partId, g.turn);
      const next = g.at
        ? addPiece(state.graph, g.partId, g.turn, count, g.at, ports, { port: g.port, turn: g.turn })
        : addPiece(state.graph, g.partId, g.turn, count, null, ports, { port: 0, turn: g.turn }, g.frame!);
      const placed = autoJoin(next.graph, ports, next.graph.pieces[next.graph.pieces.length - 1]!.pieceId);
      return {
        graph: placed.graph,
        // A join can consume the far end the cursor would go to (Codex, OV5).
        cursor: stillFree(placed.graph, next.select) ?? resumeCursor(placed.graph, ports),
        armed: null,
        selected: null,
        ghost: null,
        ...remember(state, placed.joined > 0 ? 'placeJoin' : 'place'),
      };
    }

    case 'floatGhost': {
      const g = state.ghost;
      if (!g) return state;
      const heading = g.at
        ? frameAt(state.graph, ports, placeAll(state.graph, ports), g.at, g.partId, { port: g.port, turn: g.turn }).heading
        : g.frame!.heading;
      return { ...state, ghost: { ...g, at: null, port: 0, frame: { pos: action.pos, heading } } };
    }

    case 'dropGhost': {
      const g = state.ghost;
      if (!g) return state;
      const placement = placeAll(state.graph, ports);
      const fit = ghostFit(state.graph, ports, g, placement, connectorSites(state.graph, ports, placement), geometry);
      if (fit.conflicts.length === 0) return step(state, { kind: 'placeGhost' }, ports);
      // A drop never puts down a red piece (6A), and that includes one lying
      // over track. A fresh object, not `state`,
      // so the refusal is still said: the same object back means nothing happened.
      return { ...state };
    }

    case 'cancelGhost':
      return state.ghost ? { ...state, ghost: null } : state;

    case 'moveRun': {
      if (state.ghost) return state;
      const result = moveRun(state.graph, ports, action.pieceId, { turns: action.turns, by: action.by }, geometry);
      // A refused move changes no track; it says why until the next action.
      if (result.refused !== null) return { ...state, refusal: result.refused, dropHint: null };
      return {
        ...state,
        graph: result.graph,
        cursor: stillFree(result.graph, state.cursor) ?? resumeCursor(result.graph, ports),
        armed: stillFree(result.graph, state.armed),
        refusal: null,
        // Derived from what the drop actually did (eng re-run outside voice 3).
        dropHint: result.joined === 0 && action.otherLevelNear ? "Didn't join: that end is on the other level" : null,
        ...remember(state, 'move'),
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
      // A joined end, or one whose piece is gone, is not something to arm or
      // join: a stale click, ignored, as a stale break is. The canvas and the
      // list only offer free ends, so only a stale render or a synthetic
      // action reaches this; the state walk found it arming a joined end.
      if (stillFree(state.graph, ref) === null) return state;
      // While a piece is being placed, an end click moves it there (E2).
      if (state.ghost) return step(state, { kind: 'moveGhost', ref }, ports);
      if (armed && armed.pieceId === ref.pieceId && armed.port === ref.port) {
        return { ...state, armed: null };
      }
      if (armed) {
        /*
         * A JOIN THAT CAN NEVER BE BUILT IS NOT MADE: two pegs, or ends on
         * different levels. The end stays armed and nothing changes but the
         * object, so the refusal is still said (announce.ts) -- the same object
         * back would mean nothing happened at all.
         */
        if (joinRefusal(connectorSites(state.graph, ports, placeAll(state.graph, ports)), armed, ref)) return { ...state };
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
          ...remember(state, 'join'),
        };
      }
      // Arming an end and selecting a piece are never on at once.
      return { ...state, cursor: ref, armed: ref, selected: null };
    }

    case 'breakWeld': {
      const same = (x: PortRef, y: PortRef) => x.pieceId === y.pieceId && x.port === y.port;
      const index = state.graph.welds.findIndex(
        (w) =>
          (same(w.a, action.a) && same(w.b, action.b)) ||
          (same(w.a, action.b) && same(w.b, action.a)),
      );
      // A weld that is already gone is a stale click, not an error. While a
      // piece is being placed, joints are not editable: Cancel first.
      if (index === -1 || state.ghost) return state;
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
        armed: stillFree(graph, state.armed),
        selected: state.selected ?? null,
        ...remember(state, 'break'),
      };
    }

    case 'undo':
    case 'redo': {
      const back = action.kind === 'undo';
      const from = back ? (state.past ?? []) : (state.future ?? []);
      const taken = from[from.length - 1];
      if (taken === undefined) return state;
      const graph = taken.graph;
      // The current graph goes onto the other stack, under the same name, so
      // Redo reads "Redo remove" right after "Undo remove".
      const moved: Step = { kind: taken.kind, graph: state.graph };
      const to = [...(back ? (state.future ?? []) : (state.past ?? [])), moved];
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
      return {
        graph,
        cursor: keep,
        armed: null,
        selected: state.selected ?? null,
        past: back ? from.slice(0, -1) : to.slice(-HISTORY_LIMIT),
        future: back ? to : from.slice(0, -1),
      };
    }

    case 'selectPiece': {
      // A piece click while placing is ignored, so a stray click cannot
      // throw the pending piece away; only Cancel or Esc does.
      if (state.ghost) return state;
      const id = action.pieceId;
      if (id !== null && !state.graph.pieces.some((p) => p.pieceId === id)) return state;
      const selected = id === null || id === state.selected ? null : id;
      if (selected === (state.selected ?? null) && state.armed === null) return state;
      return { ...state, selected, armed: null };
    }

    case 'removePiece': {
      if (!state.graph.pieces.some((p) => p.pieceId === action.pieceId)) return state;
      const graph = deletePiece(state.graph, ports, action.pieceId);
      return {
        graph,
        cursor: stillFree(graph, state.cursor) ?? resumeCursor(graph, ports),
        armed: stillFree(graph, state.armed),
        selected: null,
        ...remember(state, 'remove'),
      };
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
      // Undoable since the history became multi-step (decision D12): it is
      // a removal like any other.
      return { graph, cursor: resumeCursor(graph, ports), armed: null, ...remember(state, 'remove') };
    }

    case 'clear':
      return { graph: EMPTY_GRAPH, cursor: null, armed: null, past: [], future: [] };

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
      return { graph, cursor: resumeCursor(graph, ports), armed: null, past: [], future: [] };
    }
  }
}
