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

import type { Graph, PortRef } from '../../engine/src/graph/model.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { shortCode } from '../../engine/src/parts/schema.js';
import type { EditorAction, EditorState } from './editorReducer.js';
import { lastStep, nextStep } from './editorReducer.js';
import { endName, laidFrom, pieceName } from './GraphListing.js';

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
    const name = piece ? endName(resolve(piece.partId), ref.port) : `end ${ref.port + 1}`;
    return `the ${name} of piece ${i + 1}`;
  };

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

  switch (action.kind) {
    case 'add': {
      const n = next.graph.pieces.length;
      const piece = next.graph.pieces[n - 1]!;
      const part = resolve(piece.partId);
      const joint = next.graph.welds.find(
        (w) => w.a.pieceId === piece.pieceId || w.b.pieceId === piece.pieceId,
      );
      const head = `Added piece ${n}, ${part.name} (${shortCode(part)})`;
      if (!joint) return `${head}, starting a new run.`;
      const other = joint.a.pieceId === piece.pieceId ? joint.b : joint.a;
      return `${head}, joined to ${where(next.graph, other)}.`;
    }
    case 'clickPort': {
      if (next.graph.welds.length > prev.graph.welds.length && prev.armed) {
        return `Joined ${where(prev.graph, prev.armed)} to ${where(prev.graph, action.ref)}.`;
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
      if (kind === 'break') return 'Undid the break. The joint is back.';
      if (kind === 'join') return 'Undid the join.';
      if (kind === 'remove') return 'Undid the removal. The piece is back.';
      return null;
    }
    case 'redo': {
      const kind = nextStep(prev)?.kind;
      if (kind === 'place') return 'Placed the piece again.';
      if (kind === 'break') return 'Broke the joint again.';
      if (kind === 'join') return 'Joined the ends again.';
      if (kind === 'remove') return 'Removed the piece again.';
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
