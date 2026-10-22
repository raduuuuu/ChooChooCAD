/**
 * Editing a graph without moving track that nobody touched (T3 and T11).
 *
 * Both operations here share one hazard. Removing a weld or a piece can split
 * one connected layout into two, and the half that does not contain the
 * original root has no frame of its own: `placeAll` would start it at the
 * identity and the user would watch half their track teleport to the origin
 * because they deleted something at the other end.
 *
 * The fix is to write down where each new component already was, at the
 * moment of the split, and keep it. Captured, never re-derived: the frame is
 * an exact lattice point, and recomputing it later from a float pose or a
 * nearest fit would introduce the one epsilon this engine does not have.
 */

import { placeAll } from './frames.js';
import type { PortsOf } from './frames.js';
import type { Frame, Graph, Weld } from './model.js';

/**
 * Re-anchor every component of `next` from where it sat in `before`.
 *
 * Every component root takes the frame it had just before the edit, which is
 * exactly "leave it where it is". For a root that was already a root and
 * already anchored, that frame IS its anchor, so nothing is rewritten.
 *
 * AN EXISTING ANCHOR IS NOT TRUSTED OVER THE FRAME, and once was (codex
 * review, 2026-10-22). Anchors are never removed when a component is joined
 * to another, and a join can move it: break a run, join the loose half back
 * by its other end, and that half swings to meet. Its root still carried the
 * anchor from the first break, so the next break kept that stale frame and
 * the half jumped back to where it sat before the join.
 */
function captureAnchors(
  before: Graph,
  next: Graph,
  ports: PortsOf,
): ReadonlyMap<string, Frame> {
  const was = placeAll(before, ports);
  const willBe = placeAll(next, ports);
  const anchors = new Map(next.anchors ?? []);
  for (const root of willBe.forest.roots) {
    const previous = was.frames.get(root);
    // A piece that did not exist before the edit has nowhere to be put back
    // to; it starts at the identity, which is what a newly added piece wants.
    if (previous) anchors.set(root, previous);
  }
  return anchors;
}

/** Break one weld, leaving both halves exactly where they were. */
export function removeWeld(graph: Graph, ports: PortsOf, weldIndex: number): Graph {
  const next: Graph = {
    pieces: graph.pieces,
    welds: graph.welds.filter((_, i) => i !== weldIndex),
    anchors: graph.anchors,
  };
  return { ...next, anchors: captureAnchors(graph, next, ports) };
}

/**
 * Delete a piece and every weld that touched it (T11).
 *
 * Removing the piece without removing its welds would leave edges pointing at
 * a vertex that no longer exists, which the forest would then walk into. The
 * welds go with it, and whatever that disconnects gets anchored.
 */
export function removePiece(graph: Graph, ports: PortsOf, pieceId: string): Graph {
  const touches = (w: Weld) => w.a.pieceId === pieceId || w.b.pieceId === pieceId;
  const next: Graph = {
    pieces: graph.pieces.filter((p) => p.pieceId !== pieceId),
    welds: graph.welds.filter((w) => !touches(w)),
    // The deleted piece's own anchor goes too, or it would pin a component
    // root that no longer exists.
    anchors: new Map([...(graph.anchors ?? [])].filter(([id]) => id !== pieceId)),
  };
  return { ...next, anchors: captureAnchors(graph, next, ports) };
}

/** Every weld that touches a piece. Useful before offering a delete. */
export function weldsTouching(graph: Graph, pieceId: string): readonly number[] {
  return graph.welds
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.a.pieceId === pieceId || w.b.pieceId === pieceId)
    .map(({ i }) => i);
}
