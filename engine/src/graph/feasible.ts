/**
 * FEASIBILITY, LIFTED TO VERTICES (task T9).
 *
 * The chain version of these predicates carried two exclusion rules:
 * `b - a === 1` and, for a closed layout, the `(0, n)` and `(0, n-1)` seam.
 * They were not geometry. They existed because the chain had no way to say
 * "these two connectors are JOINED" as distinct from "these two connectors
 * are in the same place", so consecutive pieces and the closing seam had to
 * be excluded by index or every layout would report itself as a pile-up.
 *
 * A graph says it in the data: a weld is a declared join. So the exclusions
 * are deleted, and with them the thing they cost, which was that any OTHER
 * pair the rules happened to cover was silently exempt too.
 *
 * The two predicates become:
 *
 *   OVERLAP   no two DISTINCT vertices occupy the same position. A vertex is
 *             a set of ports tied together by welds, so a declared join is
 *             one vertex and can never report itself.
 *   POLARITY  a property of each weld, peg against socket, with heels exempt
 *             because a heel is neither (T8).
 */

import { type Cyc, equals, toXY } from '../geom/cyclotomic.js';
import { portFrame, type Placement, type PortsOf } from './frames.js';
import { portPolarity, weldHasPolarity, type Graph } from './model.js';
import type { Part } from '../parts/schema.js';

/** Two separate places on the track asked to be the same place. */
export interface VertexClash {
  readonly a: { readonly pieceId: string; readonly port: number };
  readonly b: { readonly pieceId: string; readonly port: number };
  readonly at: [number, number];
}

export interface WeldPolarityViolation {
  readonly weld: number;
  readonly between: readonly [string, string];
  readonly polarity: 'peg' | 'socket';
}

/** Union-find over ports, joined by welds. One set is one vertex. */
function vertices(graph: Graph): (key: string) => string {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (p === undefined || p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (x: string, y: string) => {
    const a = find(x);
    const b = find(y);
    if (a !== b) parent.set(a, b);
  };
  for (const w of graph.welds) {
    union(`${w.a.pieceId}#${w.a.port}`, `${w.b.pieceId}#${w.b.port}`);
  }
  return find;
}

/**
 * Ports that land on the same spot without being welded there.
 *
 * Exact equality in Z[zeta16], no epsilon: two connectors either occupy the
 * same lattice point or they do not. This is a FEASIBILITY fact and never a
 * connectivity one, which is the distinction the chain engine could not draw.
 */
export function findVertexClashes(
  graph: Graph,
  ports: PortsOf,
  placement: Placement,
): readonly VertexClash[] {
  const find = vertices(graph);
  const placed: Array<{
    pieceId: string;
    port: number;
    vertex: string;
    pos: Cyc;
  }> = [];

  for (const piece of graph.pieces) {
    const count = ports(piece).length;
    for (let i = 0; i < count; i++) {
      placed.push({
        pieceId: piece.pieceId,
        port: i,
        vertex: find(`${piece.pieceId}#${i}`),
        pos: portFrame(placement, ports, piece, i).pos,
      });
    }
  }

  /*
   * gstack-shortcut(dec-f333f98f): all-pairs comparison, O(n^2) in ports.
   * Ceiling: 25,359 pairs at the measured worst case, which is milliseconds.
   * Upgrade when a layout exceeds roughly 500 ports, or when profiling puts
   * this above 16ms in a frame; the replacement is a spatial grid keyed on
   * the exact lattice position, never a tolerance.
   *
   * Decision f333f98f SUPERSEDES cae368ab, whose "204,480 conflicting pairs"
   * was C(640,2), the number of pairs COMPARED, not conflicts found.
   */
  /*
   * ONE CLASH PER PAIR OF VERTICES, not per pair of ports.
   *
   * The first version counted ports and the number it produced was wrong in
   * the way that matters: the 16xE double circle reported "32 pairs of track
   * ends land in exactly the same spot" when there are EIGHT such spots. At
   * each one sit two vertices of two ports each, which is four port-pairs,
   * so the count was inflated fourfold while the canvas drew eight markers.
   * The verdict and the picture disagreed, and the verdict was the wrong one.
   *
   * A vertex is the thing a user sees as "a join". Two of them in one place
   * is one problem to fix, however many connectors that involves.
   */
  const clashes: VertexClash[] = [];
  const reported = new Set<string>();
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      // Same vertex means they are DECLARED to be here together. That is a
      // joint, not a collision, and it is the whole reason the index-based
      // exclusions could go.
      if (a.vertex === b.vertex) continue;
      if (!equals(a.pos, b.pos)) continue;
      const key = a.vertex < b.vertex ? `${a.vertex}|${b.vertex}` : `${b.vertex}|${a.vertex}`;
      if (reported.has(key)) continue;
      reported.add(key);
      const [x, y] = toXY(a.pos);
      clashes.push({
        a: { pieceId: a.pieceId, port: a.port },
        b: { pieceId: b.pieceId, port: b.port },
        at: [x, y],
      });
    }
  }
  return clashes;
}

/** Welds that put two ends of the same kind together. */
export function findWeldPolarityViolations(
  graph: Graph,
  resolve: (id: string) => Part,
  ports: PortsOf,
): readonly WeldPolarityViolation[] {
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const out: WeldPolarityViolation[] = [];
  graph.welds.forEach((w, index) => {
    const pieceA = byId.get(w.a.pieceId);
    const pieceB = byId.get(w.b.pieceId);
    if (!pieceA || !pieceB) return;
    const portA = ports(pieceA)[w.a.port];
    const portB = ports(pieceB)[w.b.port];
    if (!portA || !portB) return;
    if (!weldHasPolarity(portA, portB)) return;
    const pa = portPolarity(resolve(pieceA.partId), w.a.port);
    const pb = portPolarity(resolve(pieceB.partId), w.b.port);
    if (pa !== pb) return;
    out.push({ weld: index, between: [pieceA.partId, pieceB.partId], polarity: pa });
  });
  return out;
}
