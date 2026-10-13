/**
 * Placing every piece, exactly (task T2, consuming T4's forest).
 *
 * Give one piece a frame and the forest determines the rest: each tree weld
 * says "this port of the new piece must sit where that port of the placed one
 * is, facing the other way", and `frameForPortAt` turns that into the new
 * piece's frame. No piece is ever placed twice and no pose is re-derived, so
 * the arithmetic stays exact end to end.
 *
 * The welds the forest did NOT use are the interesting ones. Each closes a
 * cycle, and whether the layout works is exactly the question of whether the
 * two sides of each closing weld meet. That is `residuals` below, and it is
 * the generalisation of the chain engine's single "does the last piece reach
 * the first" test.
 *
 * `ports` is passed in rather than resolved here. The walk does not care what
 * a part is, only how many ports it has and where they sit, which is what
 * makes a three or four-ported piece need no new code. It is also how the
 * crossing rigidity test injects a four-port piece without one existing in
 * the catalogue yet.
 */

import { type Cyc, isZero, sub } from '../geom/cyclotomic.js';
import { spanningForest, type Forest } from './forest.js';
import {
  IDENTITY,
  compose,
  frameForPortAt,
  opposed,
  type Frame,
  type Graph,
  type Piece,
  type Port,
} from './model.js';

export type PortsOf = (piece: Piece) => readonly Port[];

export interface Placement {
  readonly frames: ReadonlyMap<string, Frame>;
  readonly forest: Forest;
}

/**
 * Where a port of a placed piece ends up in world space.
 * Throws rather than returning a default: an unplaced piece is a bug in the
 * forest, and a silent fallback would put track at the origin.
 */
export function portFrame(
  placement: Placement,
  ports: PortsOf,
  piece: Piece,
  portIndex: number,
): Frame {
  const frame = placement.frames.get(piece.pieceId);
  if (!frame) throw new Error(`piece ${piece.pieceId} was never placed`);
  const local = ports(piece)[portIndex];
  if (!local) throw new Error(`piece ${piece.pieceId} has no port ${portIndex}`);
  return compose(frame, local.at);
}

/**
 * Place every piece.
 *
 * `anchors` fixes a component's root frame. A component with no anchor starts
 * at the identity, which is the current behaviour for the single chain. T3
 * replaces that default with a frame CAPTURED when a component splits, so the
 * two halves of a broken loop stay where they were instead of one of them
 * jumping to the origin.
 */
export function placeAll(
  graph: Graph,
  ports: PortsOf,
  anchors: ReadonlyMap<string, Frame> = graph.anchors ?? new Map(),
): Placement {
  const forest = spanningForest(graph);
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const frames = new Map<string, Frame>();

  for (const id of forest.order) {
    const link = forest.parent.get(id);
    if (!link) {
      frames.set(id, anchors.get(id) ?? IDENTITY);
      continue;
    }
    const weld = graph.welds[link.weld]!;
    // Which side of the weld is the piece already placed, and which is this one.
    const [placedSide, thisSide] =
      weld.a.pieceId === link.from ? [weld.a, weld.b] : [weld.b, weld.a];
    const placedPiece = byId.get(placedSide.pieceId)!;
    const thisPiece = byId.get(thisSide.pieceId)!;
    const placedFrame = frames.get(placedSide.pieceId)!;
    const target = opposed(compose(placedFrame, ports(placedPiece)[placedSide.port]!.at));
    frames.set(id, frameForPortAt(ports(thisPiece)[thisSide.port]!.at, target));
  }

  return { frames, forest };
}

export interface WeldResidual {
  /** Index into `graph.welds`. */
  readonly weld: number;
  /** Exact position mismatch between the two ports. Zero when it closes. */
  readonly gap: Cyc;
  /**
   * Heading mismatch in zeta steps, 0..15. Zero when the two ports align.
   *
   * Signed the way the chain engine signed it, as the rotation the loop
   * ACCUMULATED, so a one-step error reads as 1 rather than 15. Taking the
   * difference in the other direction is equally defensible and the
   * differential harness caught the two engines disagreeing 2 against 14 on
   * a self-welded curve. Matching the existing convention costs nothing and
   * keeps `HEADING_MISMATCH`'s user-facing copy meaning what it already said.
   */
  readonly headingSteps: number;
  readonly closes: boolean;
}

/**
 * One residual per closing weld.
 *
 * A chain closed or it did not, one number. A graph has one residual per
 * independent cycle, and T6's rule is that they are never pooled: give
 * absorbed in one loop cannot pay for a gap in another, because the pieces
 * are not shared. Returning them separately is what makes that rule
 * expressible at all.
 */
export function residuals(
  graph: Graph,
  ports: PortsOf,
  placement: Placement,
): readonly WeldResidual[] {
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  return placement.forest.closing.map((index) => {
    const weld = graph.welds[index]!;
    const a = portFrame(placement, ports, byId.get(weld.a.pieceId)!, weld.a.port);
    const b = portFrame(placement, ports, byId.get(weld.b.pieceId)!, weld.b.port);
    const want = opposed(a);
    const gap = sub(b.pos, want.pos);
    const headingSteps = (((want.heading - b.heading) % 16) + 16) % 16;
    return { weld: index, gap, headingSteps, closes: isZero(gap) && headingSteps === 0 };
  });
}

/** True when every closing weld meets exactly. */
export function closesExactly(rs: readonly WeldResidual[]): boolean {
  return rs.every((r) => r.closes);
}
