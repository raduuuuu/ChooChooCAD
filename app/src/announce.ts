/**
 * WHAT JUST HAPPENED, IN ONE SENTENCE (task U7b).
 *
 * The verdict line already says whether the layout works; it is region 1 of
 * the announcement policy (Y1 decision 2). This is region 3: one polite,
 * non-atomic sentence per editing action, so a screen reader user hears what
 * their key did ("Joined the end of piece 8 to the start of piece 1") and not
 * only its consequence. Without it, the only feedback for selecting an end is
 * a change of name on a control that may no longer have focus.
 *
 * Pure, and it names things exactly as the graph listing does (`endName`,
 * numbering from 1 in placement order), so what is announced matches what the
 * user can find in the list.
 *
 * Null means "say nothing": an action that changed nothing (a stale click, an
 * undo with nothing to undo) must not announce that it did something.
 */

import { levelOf, portPolarity, portsOf, type Graph, type Piece, type PortRef } from '../../engine/src/graph/model.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { shortCode } from '../../engine/src/parts/schema.js';
import type { EditorAction, EditorState } from './editorReducer.js';
import { lastStep, nextStep } from './editorReducer.js';
import { endName, laidFrom, pieceName } from './GraphListing.js';
import { afterKey, ghostKeys, keyHelp } from './ghostKeys.js';

const same = (a: PortRef | null, b: PortRef | null): boolean =>
  a !== null && b !== null && a.pieceId === b.pieceId && a.port === b.port;

export function describeAction(
  prev: EditorState,
  action: EditorAction,
  next: EditorState,
  resolve: (id: string) => Part,
): string | null {
  if (prev === next) return null;
  const where = (graph: Graph, ref: PortRef): string => {
    const i = graph.pieces.findIndex((p) => p.pieceId === ref.pieceId);
    const piece = graph.pieces[i];
    const name = piece ? endName(resolve(piece.partId), ref.port, piece.turn) : `end ${ref.port + 1}`;
    return `the ${name} of piece ${i + 1}`;
  };

  /*
   * A joint where two sockets meet is made with a male-male adapter (socket
   * adapter plan, item 5), however it was made: placed, dropped, moved or
   * joined by hand. Read from the two ends' kinds, so every route says it.
   */
  const adapterJoint = (graph: Graph, w: Graph['welds'][number]): boolean => {
    const kind = (ref: PortRef) => {
      const piece = graph.pieces.find((p) => p.pieceId === ref.pieceId);
      return piece ? portPolarity(resolve(piece.partId), ref.port) : undefined;
    };
    return kind(w.a) === 'socket' && kind(w.b) === 'socket';
  };
  const withAdapter = (graph: Graph, w: Graph['welds'][number]): string =>
    adapterJoint(graph, w) ? ' with a male-male adapter' : '';

  const numberOf = (graph: Graph, id: string): number =>
    graph.pieces.findIndex((p) => p.pieceId === id) + 1;
  /*
   * Joins an edit OPENED besides the one it was asked to make: the unmet
   * closing join of a loop that did not close, opened so nothing moves
   * (decision D19). Said out loud, because a join the user declared vanished.
   */
  const opened = (except: (w: Graph['welds'][number]) => boolean): string => {
    const gone = prev.graph.welds.filter((w) => !next.graph.welds.includes(w) && !except(w));
    return gone
      .map(
        (w) =>
          ` The join between piece ${numberOf(prev.graph, w.a.pieceId)} and piece ${numberOf(prev.graph, w.b.pieceId)} never met, so it was opened.`,
      )
      .join('');
  };
  const removed = (id: string): string => {
    const i = prev.graph.pieces.findIndex((p) => p.pieceId === id);
    const part = resolve(prev.graph.pieces[i]!.partId);
    const touching = (w: Graph['welds'][number]) => w.a.pieceId === id || w.b.pieceId === id;
    return `Removed piece ${i + 1}, ${part.name} (${shortCode(part)}).${opened(touching)}`;
  };

  /*
   * A placement that also joined an end it landed on exactly (D13): said, so
   * the user hears the loop close and not only that a piece went down.
   */
  const closed = (id: string): string => {
    const added = next.graph.welds.filter(
      (w) => !prev.graph.welds.includes(w) && (w.a.pieceId === id || w.b.pieceId === id),
    );
    if (added.length < 2) return '';
    const far = added[added.length - 1]!;
    const other = far.a.pieceId === id ? far.b : far.a;
    return ` It also joined ${where(next.graph, other)}${withAdapter(next.graph, far)}.`;
  };

  /*
   * LEVELS, said with every placement that involves one (two-layer plan, R2
   * and the L1 note): a ramp says which way it went, a raised piece says it is
   * raised, and a placement that lifted the run it joined says so, because
   * nothing on the canvas shows a run changing level except the drawing order.
   */
  const portsOfPiece = (p: Piece) => portsOf(resolve(p.partId), p.turn);
  const levels = (id: string): string => {
    const piece = next.graph.pieces.find((p) => p.pieceId === id);
    if (!piece) return '';
    const before = placeAll(prev.graph, portsOfPiece).frames;
    const after = placeAll(next.graph, portsOfPiece).frames;
    const at = (frames: typeof after, pid: string) => {
      const f = frames.get(pid);
      return f ? levelOf(f) : 0;
    };
    const raisedRun = prev.graph.pieces.some((p) => at(after, p.pieceId) > at(before, p.pieceId));
    const part = resolve(piece.partId);
    const joinedBy = next.graph.welds.find((w) => w.a.pieceId === id || w.b.pieceId === id);
    const by = joinedBy ? (joinedBy.a.pieceId === id ? joinedBy.a.port : joinedBy.b.port) : 0;
    // It climbs when it went on by its low end, whichever face is up.
    const lowEndIn = levelOf(portsOfPiece(piece)[by]!.at) === 0;
    const own =
      part.kind === 'straight' && part.rise !== undefined
        ? lowEndIn
          ? ' It climbs to the raised level.'
          : ' It comes down to the floor.'
        : at(after, id) >= 1
          ? ' It is raised.'
          : '';
    return `${own}${raisedRun ? ' The run it joined is now raised.' : ''}`;
  };

  switch (action.kind) {
    case 'add': {
      const n = next.graph.pieces.length;
      const piece = next.graph.pieces[n - 1]!;
      const part = resolve(piece.partId);
      const joint = next.graph.welds.find(
        (w) => w.a.pieceId === piece.pieceId || w.b.pieceId === piece.pieceId,
      );
      const head = `Added piece ${n}, ${part.name} (${shortCode(part)})`;
      if (!joint) return `${head}, starting a new run.${levels(piece.pieceId)}`;
      const other = joint.a.pieceId === piece.pieceId ? joint.b : joint.a;
      return `${head}, joined to ${where(next.graph, other)}${withAdapter(next.graph, joint)}.${closed(piece.pieceId)}${levels(piece.pieceId)}`;
    }
    case 'dropGhost':
      // Still pending means the drop was refused (6A); the strip says why.
      if (next.ghost) return "Didn't place it: it doesn't fit there. Enter places it anyway, Escape cancels.";
    // falls through: a clean drop is a Place
    case 'placeGhost': {
      const n = next.graph.pieces.length;
      const piece = next.graph.pieces[n - 1]!;
      const part = resolve(piece.partId);
      const joints = next.graph.welds.filter(
        (w) => w.a.pieceId === piece.pieceId || w.b.pieceId === piece.pieceId,
      );
      const head = `Added piece ${n}, ${part.name} (${shortCode(part)})`;
      if (joints.length === 0) return `${head}, starting a new run.${levels(piece.pieceId)}`;
      const other = joints[0]!.a.pieceId === piece.pieceId ? joints[0]!.b : joints[0]!.a;
      return `${head}, joined to ${where(next.graph, other)}${withAdapter(next.graph, joints[0]!)}.${closed(piece.pieceId)}${levels(piece.pieceId)}`;
    }
    case 'pick':
      if (!next.ghost) return null;
      return `Placing ${resolve(action.partId).name}. ${keyHelp(ghostKeys(next.graph, portsOfPiece, next.ghost, resolve(action.partId)))}`;
    case 'rotateGhost':
    case 'flipGhost':
      return next.ghost ? afterKey(action.kind, resolve(next.ghost.partId), next.ghost) : null;
    case 'moveGhost':
    case 'stepGhost':
      return next.ghost?.at ? `Placing at ${where(next.graph, next.ghost.at)}.` : null;
    case 'floatGhost':
      // Every centimetre of a drag would be a sentence; the drop is said instead.
      return null;
    case 'cancelGhost':
      return 'Cancelled placing the piece.';
    case 'moveRun': {
      if (next.refusal) return `Can't move it there: ${next.refusal}.`;
      const added = next.graph.welds.filter((w) => !prev.graph.welds.includes(w));
      if (added.length === 0) return next.dropHint ? `Moved the run. ${next.dropHint}.` : 'Moved the run.';
      const adapters = added.filter((w) => adapterJoint(next.graph, w)).length;
      const using =
        adapters === 0 ? '' : adapters === 1 ? ' with a male-male adapter' : ` with ${adapters} male-male adapters`;
      return `Moved the run. It joined the track it landed on${using}.`;
    }
    case 'clickPort': {
      if (next.graph.welds.length > prev.graph.welds.length && prev.armed) {
        const made = next.graph.welds[next.graph.welds.length - 1]!;
        return `Joined ${where(prev.graph, prev.armed)} to ${where(prev.graph, action.ref)}${withAdapter(next.graph, made)}.`;
      }
      if (next.armed && !same(prev.armed, next.armed)) {
        return `Selected ${where(next.graph, next.armed)}. Choose another free end to join it to.`;
      }
      if (prev.armed && !next.armed) return 'Selection cleared.';
      return null;
    }
    case 'breakWeld': {
      const named = (w: Graph['welds'][number]) =>
        (same(w.a, action.a) && same(w.b, action.b)) || (same(w.a, action.b) && same(w.b, action.a));
      return `Broke the joint between ${where(prev.graph, action.a)} and ${where(prev.graph, action.b)}.${opened(named)}`;
    }
    case 'undo': {
      const kind = lastStep(prev)?.kind;
      if (kind === 'place') return 'Undid the last piece.';
      if (kind === 'placeJoin') return 'Undid the last piece and its join.';
      if (kind === 'break') return 'Undid the break. The joint is back.';
      if (kind === 'join') return 'Undid the join.';
      if (kind === 'remove') return 'Undid the removal. The piece is back.';
      if (kind === 'move') return 'Undid the move.';
      return null;
    }
    case 'redo': {
      const kind = nextStep(prev)?.kind;
      if (kind === 'place' || kind === 'placeJoin') return 'Placed the piece again.';
      if (kind === 'break') return 'Broke the joint again.';
      if (kind === 'join') return 'Joined the ends again.';
      if (kind === 'remove') return 'Removed the piece again.';
      if (kind === 'move') return 'Moved the run again.';
      return null;
    }
    case 'selectPiece': {
      const id = next.selected ?? null;
      if (id === null) return 'Selection cleared.';
      const i = next.graph.pieces.findIndex((p) => p.pieceId === id);
      const piece = next.graph.pieces[i]!;
      return `Selected ${pieceName(i + 1, piece, resolve(piece.partId), laidFrom(next.graph).get(id))}.`;
    }
    case 'removePiece':
      return removed(action.pieceId);
    case 'removeLast':
      return removed(prev.graph.pieces[prev.graph.pieces.length - 1]!.pieceId);
    case 'clear':
      return 'Cleared the layout.';
    case 'preset':
      return `Loaded a layout of ${next.graph.pieces.length} pieces.`;
  }
}
