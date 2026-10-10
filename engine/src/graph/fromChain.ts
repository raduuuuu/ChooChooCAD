/**
 * Every chain is a graph. The adapter that makes the two engines comparable.
 *
 * A chain is the special case where every piece has two ports and port 1 of
 * each is welded to port 0 of the next; closing adds one more weld from the
 * last piece's port 1 to the first piece's port 0. Writing that down is what
 * lets T7 run all fifty existing fixtures through BOTH engines and demand
 * exact agreement, which is the only honest way to delete the chain engine.
 *
 * Piece ids are positional (`p0`, `p1`, ...) because a `Placement` has no
 * identity of its own. T11 will need real identity for deletion; until then
 * the index is the identity and nothing outside this file depends on the
 * naming.
 */

import type { Layout } from '../parts/schema.js';
import type { Graph, Piece, Weld } from './model.js';

export const chainPieceId = (index: number): string => `p${index}`;

export function graphFromChain(layout: Layout): Graph {
  const pieces: Piece[] = layout.placements.map((p, i) => ({
    pieceId: chainPieceId(i),
    partId: p.partId,
    turn: p.turn,
  }));
  const welds: Weld[] = [];
  for (let i = 0; i + 1 < pieces.length; i++) {
    welds.push({
      a: { pieceId: chainPieceId(i), port: 1 },
      b: { pieceId: chainPieceId(i + 1), port: 0 },
    });
  }
  /*
   * A self-weld is a real cycle, and skipping it was wrong.
   *
   * I first guarded this with `pieces.length > 1`, reasoning that a piece
   * welded to itself has "no geometry to satisfy". It has exactly one
   * constraint to satisfy: its own two ports must coincide. Rank is
   * E - V + CC = 1 - 1 + 1 = 1, and the chain engine agrees, reporting a
   * 154.6mm gap for a single closed E curve. The differential harness caught
   * the disagreement immediately, which is what it is for.
   */
  if (layout.closed && pieces.length > 0) {
    welds.push({
      a: { pieceId: chainPieceId(pieces.length - 1), port: 1 },
      b: { pieceId: chainPieceId(0), port: 0 },
    });
  }
  return { pieces, welds };
}
