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

import { type Cyc, isZero, magnitude, sub, toXY } from '../geom/cyclotomic.js';
import { spanningForest, type Forest } from './forest.js';
import {
  IDENTITY,
  compose,
  frameForPortAt,
  frameOf,
  levelOf,
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
    /*
     * GUARDED, not asserted. `portFrame` forty lines up validates the same
     * index and throws a named error; these two sites silenced it with `!`
     * and produced a raw `TypeError: Cannot read properties of undefined
     * (reading 'at')` instead. `loadGraph` now refuses an out-of-range port,
     * so this is the second line of defence rather than the only one -- but
     * an engine that is handed a bad index should say which piece and which
     * port, not which property of undefined it tried to read.
     *
     * WHERE THE THROW LANDS DEPENDS ON THE CALLER. From App.tsx's render path
     * a React error boundary catches it and the crash screen appears. From
     * `graph/edit.ts` through the editor reducer it is inside an event
     * handler, where boundaries do NOT catch: there it is a console error and
     * a frozen UI with no crash screen and no repro. That asymmetry predates
     * this change and is not made worse by it, but do not read "the boundary
     * catches it" as unconditional.
     */
    const placedLocal = ports(placedPiece)[placedSide.port];
    const thisLocal = ports(thisPiece)[thisSide.port];
    if (!placedLocal) {
      throw new Error(`piece ${placedSide.pieceId} has no port ${placedSide.port}`);
    }
    if (!thisLocal) {
      throw new Error(`piece ${thisSide.pieceId} has no port ${thisSide.port}`);
    }
    const target = opposed(compose(placedFrame, placedLocal.at));
    frames.set(id, frameForPortAt(thisLocal.at, target));
  }

  /*
   * LEVELS ARE RELATIVE TO EACH RUN, and the floor is the bottom (decision L1).
   * A run starts at its root's level (its anchor's, or the floor), and a ramp
   * walked from its high end puts what lies beyond it one level down. Track
   * cannot go below the floor, so a run that reaches below it is lifted until
   * its lowest piece sits on the floor: a ramp laid descending from a floor
   * loop raises that loop. A piece's frame carries the level of its port 0,
   * the low end of a ramp, so the lowest frame is the lowest track.
   */
  const lowest = new Map<number, number>();
  for (const [id, f] of frames) {
    const c = forest.component.get(id)!;
    lowest.set(c, Math.min(lowest.get(c) ?? 0, levelOf(f)));
  }
  for (const [id, f] of frames) {
    const shift = -(lowest.get(forest.component.get(id)!) ?? 0);
    if (shift > 0) frames.set(id, frameOf(f.pos, f.heading, levelOf(f) + shift));
  }

  return { frames, forest };
}

/**
 * The levels a layout's track may use: the floor and one raised level
 * (owner decision D9 of 2026-10-07, kept by L1). A third layer is a filed TODO.
 */
export const LEVEL_COUNT = 2;

/** A joint whose two ends sit on different levels: the loop never comes back down. */
export interface LevelMismatch {
  /** Index into `graph.welds`. */
  readonly weld: number;
  /** Where to mark it, float mm: the joint. */
  readonly at: readonly [number, number];
}

/** A ramp whose high end would sit above the raised level. */
export interface ThirdLevel {
  readonly pieceId: string;
  /** Where to mark it, float mm: the end that climbs too high. */
  readonly at: readonly [number, number];
}

export interface LevelFaults {
  readonly mismatches: readonly LevelMismatch[];
  readonly thirdLevels: readonly ThirdLevel[];
}

/**
 * THE TWO LEVEL FAULTS, in one place (eng decision D1), read by the verdict
 * and by the preview and drop (CEO E1), so they can never disagree.
 *
 * Mismatches are the closing welds whose `levelSteps` is not zero: one per
 * joint. Third levels are checked on every PORT, not on piece frames (eng
 * EOV1): a piece's frame is its low end, so checking frames would miss a
 * ramp's high end. After the normalisation in `placeAll` nothing sits below
 * the floor, so only the top can be exceeded, by an anchored raised run with
 * a climbing ramp or by two ramps climbing in a row. One per ramp.
 */
export function findLevelFaults(
  graph: Graph,
  ports: PortsOf,
  placement: Placement,
  rs: readonly WeldResidual[] = residuals(graph, ports, placement),
): LevelFaults {
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const mismatches = rs
    .filter((r) => r.levelSteps !== 0)
    .map((r) => {
      const w = graph.welds[r.weld]!;
      return { weld: r.weld, at: toXY(portFrame(placement, ports, byId.get(w.a.pieceId)!, w.a.port).pos) };
    });
  const thirdLevels: ThirdLevel[] = [];
  for (const piece of graph.pieces) {
    const own = ports(piece);
    for (let i = 0; i < own.length; i++) {
      // Only a climbing end counts, so the count is per ramp (design 6A), not
      // per piece that happens to lie beyond it.
      if (levelOf(own[i]!.at) === 0) continue;
      const f = portFrame(placement, ports, piece, i);
      if (levelOf(f) >= LEVEL_COUNT) {
        thirdLevels.push({ pieceId: piece.pieceId, at: toXY(f.pos) });
        break;
      }
    }
  }
  return { mismatches, thirdLevels };
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
  /**
   * The same mismatch in millimetres, so ONE function turns a residual into a
   * number a user reads (task W2).
   *
   * `gap` is exact and `gapMm` is lossy, and the lossy one is what the canvas
   * draws and the verdict prints. Deriving it here rather than at each call
   * site is the point: the cycle analysis already called `magnitude` on a sum
   * of these, and a second caller doing its own arithmetic is how a drawing
   * ends up labelled with a different number than the sentence under it.
   */
  readonly gapMm: number;
  /**
   * Level mismatch, the second port's level minus the first's (eng OV2).
   * Non-zero means the loop climbs and never comes back down, however
   * exactly it meets on the floor plan.
   */
  readonly levelSteps: number;
  /**
   * Meets in position, heading AND level. `openUnmetJoins` (edit.ts) trusts
   * this, so a weld joining two levels is opened on delete like a gappy one,
   * and never steers placement between levels.
   */
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
    const levelSteps = levelOf(b) - levelOf(a);
    return {
      weld: index,
      gap,
      headingSteps,
      gapMm: magnitude(gap),
      levelSteps,
      closes: isZero(gap) && headingSteps === 0 && levelSteps === 0,
    };
  });
}

/** True when every closing weld meets exactly. */
export function closesExactly(rs: readonly WeldResidual[]): boolean {
  return rs.every((r) => r.closes);
}
