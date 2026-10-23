/**
 * ONE spanning forest, built once (task T4).
 *
 * Three things need to traverse the graph in the same order: the exact walk,
 * the float walk the renderer uses, and cycle extraction. In the chain engine
 * each of them re-derived the order independently, which was harmless only
 * because a list has exactly one order. On a graph it is not harmless: two
 * consumers that disagree about the traversal place the same piece in two
 * different spots, and the renderer would draw a layout the solver never
 * checked. So the forest is computed once and handed to all three.
 *
 * DETERMINISM IS A REQUIREMENT, not a nicety. Pieces are visited in
 * declaration order and each piece's welds in declaration order, so the same
 * graph always yields the same parent pointers, the same roots and the same
 * set of closing welds. Without that, which welds count as "closing" would
 * vary between runs and so would the cycles the verdict reports.
 *
 * WHICH WELDS CLOSE IS DECIDED BY WELD ORDER ALONE, not by the walk (backlog
 * D7, ENG-R5 of the 2026-10-22 editing plan). Welds are taken in declaration
 * order, and one that joins pieces already connected by earlier welds is a
 * closing weld; every other weld is a tree edge. The walk below then follows
 * tree edges only.
 *
 * It used to be whatever the depth-first walk left over, and the walk starts
 * at each component's first-declared piece. A join that merged two runs could
 * move that start into the middle of a loop that does not close, the walk
 * then went round the loop the other way, a different weld became the gap,
 * and track that was already down was re-laid: measured at 293 mm for an
 * exact, facing join (engine/test/joinStability.test.ts). By weld order, a
 * new weld can never change the status of an earlier one, so an exact join
 * moves nothing. On a chain, and on anything built one piece at a time, the
 * last weld declared closes, which is what the walk left over too.
 */

import type { Graph } from './model.js';

/** How a piece was reached: across `weld`, from the piece on its other side. */
export interface ParentLink {
  readonly from: string;
  readonly weld: number;
}

export interface Forest {
  /** Every piece id, in the order the walk visits them. */
  readonly order: readonly string[];
  /** Piece id to the link that placed it. Absent for a component root. */
  readonly parent: ReadonlyMap<string, ParentLink>;
  /** One per connected component, in declaration order. */
  readonly roots: readonly string[];
  /**
   * Welds that are NOT tree edges. Each one closes a cycle, so
   * `closing.length` is the cycle rank, E - V + CC, by construction rather
   * than by a separate count that could disagree.
   */
  readonly closing: readonly number[];
  /** Which component each piece belongs to, indexed into `roots`. */
  readonly component: ReadonlyMap<string, number>;
}

export function spanningForest(graph: Graph): Forest {
  const adjacency = new Map<string, Array<{ weld: number; other: string }>>();
  for (const p of graph.pieces) adjacency.set(p.pieceId, []);
  graph.welds.forEach((w, i) => {
    adjacency.get(w.a.pieceId)?.push({ weld: i, other: w.b.pieceId });
    // A weld from a piece to itself is one edge, not two, or it would be
    // walked from both sides and counted as its own closing weld.
    if (w.b.pieceId !== w.a.pieceId) {
      adjacency.get(w.b.pieceId)?.push({ weld: i, other: w.a.pieceId });
    }
  });

  // Union-find over pieces, fed welds in declaration order.
  const link = new Map<string, string>();
  const find = (k: string): string => {
    const p = link.get(k);
    if (p === undefined || p === k) return k;
    const root = find(p);
    link.set(k, root);
    return root;
  };
  const treeWeld = new Set<number>();
  graph.welds.forEach((w, i) => {
    const a = find(w.a.pieceId);
    const b = find(w.b.pieceId);
    if (a === b) return;
    link.set(a, b);
    treeWeld.add(i);
  });

  const order: string[] = [];
  const parent = new Map<string, ParentLink>();
  const component = new Map<string, number>();
  const roots: string[] = [];
  const visited = new Set<string>();

  for (const start of graph.pieces) {
    if (visited.has(start.pieceId)) continue;
    const componentIndex = roots.length;
    roots.push(start.pieceId);
    /*
     * DEPTH-first, following welds in declaration order.
     *
     * Breadth-first was the first attempt and it is wrong for this job, not
     * because it is inexact (the arithmetic is exact either way) but because
     * of which weld it leaves over. On a closed chain BFS leaves the root in
     * both directions at once, so it reaches the last piece across the
     * CLOSING weld and leaves an interior one over instead. The cycle is the
     * same cycle and the gap has the same magnitude, but it is reported at a
     * different edge and in a rotated frame.
     *
     * Depth-first in declaration order walks a chain the way the chain engine
     * walked it, piece after piece, and leaves exactly the weld a user would
     * call "the one that has to close". That is what makes T7's differential
     * harness able to compare gap VECTORS and not just magnitudes.
     */
    /*
     * Visited is marked on POP, not on push.
     *
     * Marking on push looks equivalent and is not: a piece adjacent to the
     * root by a late weld gets claimed the moment the root is expanded, so
     * on a closed chain p4 was reached by the CLOSING weld from p0 rather
     * than by walking p1, p2, p3, and the weld left over was an interior one.
     * The same off-by-one would misreport which weld has to close for every
     * loop in the graph.
     */
    const stack: Array<{ id: string; via: ParentLink | null }> = [
      { id: start.pieceId, via: null },
    ];
    while (stack.length > 0) {
      const { id, via } = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (via) parent.set(id, via);
      order.push(id);
      component.set(id, componentIndex);
      const neighbours = adjacency.get(id) ?? [];
      // Reversed, because a stack pops last-in first: pushing in reverse makes
      // the first-declared weld the first one followed.
      for (let i = neighbours.length - 1; i >= 0; i--) {
        const { weld, other } = neighbours[i]!;
        if (treeWeld.has(weld) && !visited.has(other)) stack.push({ id: other, via: { from: id, weld } });
      }
    }
  }

  const closing = graph.welds.map((_, i) => i).filter((i) => !treeWeld.has(i));
  return { order, parent, roots, closing, component };
}
