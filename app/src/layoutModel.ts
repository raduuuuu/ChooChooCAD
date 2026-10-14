/**
 * The layout the app edits: a graph, not a chain.
 *
 * FREE-END CLICKING is the interaction this exists for. Decision D5 cut full
 * drag-and-drop and named this as "the smallest interaction that makes a
 * branch buildable": select a free end, click a piece, it attaches there. Two
 * free ends can be welded to each other, which is how a loop closes.
 *
 * `closed: boolean` is RETIRED. It was a property of a list, and the question
 * it answered ("does the last piece join the first?") has no meaning once a
 * layout can be a tree, a forest, or two loops sharing a switch. Closure is
 * now a weld a user declares like any other, which is also why the engine
 * never has to guess whether two coincident ends are joined.
 *
 * Everything here is pure: no React, no localStorage reads at module scope,
 * no `window`. The operations take a graph and return a new one.
 */

import { scale, toXY, zetaPow } from '../../engine/src/geom/cyclotomic.js';
import { removePiece, removeWeld } from '../../engine/src/graph/edit.js';
import { placeAll, portFrame, type PortsOf } from '../../engine/src/graph/frames.js';
import type { Frame, Graph, Piece, PortRef, Weld } from '../../engine/src/graph/model.js';
import type { Turn } from '../../engine/src/parts/schema.js';

export const EMPTY_GRAPH: Graph = { pieces: [], welds: [] };

/** Stable within a session; the graph stores it, so it must not be an index. */
export function newPieceId(existing: readonly Piece[]): string {
  let n = existing.length;
  const taken = new Set(existing.map((p) => p.pieceId));
  // Linear probe rather than a counter in state: deleting piece 3 and adding
  // another must not reuse id 3 while a weld or anchor still names it.
  while (taken.has(`p${n}`)) n++;
  return `p${n}`;
}

export function isFree(graph: Graph, ref: PortRef): boolean {
  return !graph.welds.some(
    (w) =>
      (w.a.pieceId === ref.pieceId && w.a.port === ref.port) ||
      (w.b.pieceId === ref.pieceId && w.b.port === ref.port),
  );
}

/**
 * Add a piece, welding its port 0 to `at` when one is given.
 *
 * Returns the new graph and the port a user would most likely want selected
 * next: the new piece's far end, so clicking piece after piece builds a run
 * without reselecting. For a switch there are two far ends and the through
 * road is the one offered, because continuing straight is the common case
 * and the diverging road is one more click away rather than a guess.
 */
/** The grid new runs are spaced on. One long straight. */
const RUN_SPACING_MM = 216;

/**
 * Where to start a run so it does not land on the track already there.
 *
 * Without this every component anchors at the identity and a second run is
 * drawn straight through the first. The canvas showed two runs crossing at
 * the origin, and because they were separate pieces with no weld between them
 * the overlap was a real feasibility clash as well.
 *
 * PERPENDICULAR, and far enough to clear what exists. Offsetting along the
 * track direction was the first attempt and it put a new run exactly where
 * the old one ended: three 144mm straights are 432mm, and the offset was
 * 216 x 2. Runs go side by side now, cleared by the existing layout's own
 * height.
 *
 * The DISTANCE is chosen with floats, which is fine: picking where to put
 * something is not computing geometry. What is stored is an integer multiple
 * of an exact lattice vector, so the anchor itself stays exact and the
 * engine never sees a rounded number.
 */
function nextRunAnchor(graph: Graph, ports: PortsOf): Frame {
  const place = placeAll(graph, ports);
  let maxY = 0;
  let minY = 0;
  for (const piece of graph.pieces) {
    const count = ports(piece).length;
    for (let i = 0; i < count; i++) {
      const [, y] = toXY(portFrame(place, ports, piece, i).pos);
      if (y > maxY) maxY = y;
      if (y < minY) minY = y;
    }
  }
  const clearance = maxY - minY + RUN_SPACING_MM;
  const steps = Math.max(1, Math.ceil(clearance / RUN_SPACING_MM));
  // zeta^4 is a quarter turn: straight across from the track already down.
  return { pos: scale(zetaPow(4), RUN_SPACING_MM * steps), heading: 0 };
}

export function addPiece(
  graph: Graph,
  partId: string,
  turn: Turn,
  portCount: number,
  at: PortRef | null,
  /*
   * REQUIRED, not optional (task T4, gate decision d6).
   *
   * It was optional, and the anchoring below is gated on having it, so the
   * two call sites disagreed in a way nothing could see: `add` passed it and
   * `preset` did not, which meant a preset step that failed to attach started
   * a run with NO anchor and `placeAll` then put that component at the
   * identity, on top of whatever was already at the origin. The solver reads
   * that as a clash in a layout the user built correctly. Required is what
   * stops the two paths drifting again when a one-port buffer or T2's
   * three-port switch makes the unattached step reachable.
   */
  ports: PortsOf,
): { graph: Graph; select: PortRef | null } {
  const pieceId = newPieceId(graph.pieces);
  const piece: Piece = { pieceId, partId, turn };
  const pieces = [...graph.pieces, piece];
  const attaching = at !== null && isFree(graph, at);
  const welds: Weld[] = attaching
    ? [...graph.welds, { a: at, b: { pieceId, port: 0 } }]
    : [...graph.welds];

  // A piece that attaches joins an existing component and needs no anchor.
  // One that starts a new run gets put down beside what is already there.
  const anchors = new Map(graph.anchors ?? []);
  if (!attaching && graph.pieces.length > 0) {
    anchors.set(pieceId, nextRunAnchor(graph, ports));
  }

  const select: PortRef | null = portCount > 1 ? { pieceId, port: 1 } : null;
  return { graph: { pieces, welds, anchors }, select };
}

/**
 * Weld two free ends to each other. This is what closing a loop now is.
 *
 * Refuses a port to itself and refuses a pair already welded. It does NOT
 * refuse a weld whose geometry does not meet: that is the verdict's job, and
 * declaring a join the track cannot make is exactly the thing the user is
 * asking to be told about.
 */
export function weldEnds(graph: Graph, a: PortRef, b: PortRef): Graph {
  if (a.pieceId === b.pieceId && a.port === b.port) return graph;
  if (!isFree(graph, a) || !isFree(graph, b)) return graph;
  return { ...graph, welds: [...graph.welds, { a, b }] };
}

/** Delete a piece and everything that pointed at it (T11). */
export function deletePiece(graph: Graph, ports: PortsOf, pieceId: string): Graph {
  return removePiece(graph, ports, pieceId);
}

/** Break one declared join, leaving both halves where they are (T3). */
export function breakWeld(graph: Graph, ports: PortsOf, weldIndex: number): Graph {
  return removeWeld(graph, ports, weldIndex);
}

/** The most recently added piece, for an undo-shaped "remove last". */
export function lastPieceId(graph: Graph): string | null {
  return graph.pieces.length === 0 ? null : graph.pieces[graph.pieces.length - 1]!.pieceId;
}
