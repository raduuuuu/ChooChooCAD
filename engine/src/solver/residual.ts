/**
 * Exact closure residual, and each joint's two sides.
 *
 * This is the whole engine now. The residual of a fixed topology is an exact
 * algebraic constant computed in integer arithmetic: nothing iterates and
 * nothing can fail numerically here. Across four review passes this stage has
 * produced zero defects.
 *
 * It used to also carry per-joint SENSITIVITIES (an axial direction and an
 * angular lever arm) for a minimax LP that allocated slop joint by joint. That
 * LP owned every measured defect in the project and was deleted at decision
 * R21: it produced a precise-looking TIGHT/FAIL split out of tolerances the
 * part data itself labels `estimated`. A necessary condition replaced it (the
 * gap cannot exceed the summed axial give), and that was retired in turn when
 * the floor showed a loop closing a gap three times its axial give: the bend
 * model (`graph/bend.ts`, docs/designs/joint-bend.md) now decides, from
 * measured stretch and a bend limit inferred from that loop.
 *
 * So a joint here carries only what it has: where it is, and its two sides.
 */

import { type Cyc, isZero, sub, toXY } from '../geom/cyclotomic.js';
import { normalizeHeading, walk, type Pose } from '../geom/pose.js';
import type { Layout, Part } from '../parts/schema.js';

/**
 * One joint and its budget. Deliberately NOT called a sensitivity any more:
 * nothing here says how this joint influences the closure, because nothing
 * computes that. See R21.
 *
 * A JOINT HAS TWO SIDES (fix C3, finding F1), and the WEAKER one governs.
 *
 * This used to take the larger side, because the verdict was a necessary
 * condition ("the gap exceeds the give, so it will not fit") that needed give
 * as an upper bound. The verdict now claims closure ("closes with bend"), so
 * the smaller side governs: a joint is only as loose as its tighter half
 * (eng review D10). The bend model applies the same rule in `bendRun.ts`.
 */
export interface Joint {
  readonly index: number;
  /** Where the joint sits, as floats. Reporting only. */
  readonly at: [number, number];
  /**
   * The two part ids that mate at this joint, in placement order. Recorded so
   * the pair is inspectable and the choice above is testable from outside.
   */
  readonly between: readonly [string, string];
  /** Pull-apart stretch at this joint, millimetres: the weaker of the pair. Reported; the bend model reads parts directly. */
  readonly axialMaxMm: number;
  /** Bend at this joint, degrees: the weaker of the pair's own figures. Reported only; BRIO joints use the bend limit. */
  readonly angularMaxDeg: number;
}

export interface ResidualReport {
  /** Exact position residual in Z[zeta16]. Zero means the loop closes exactly. */
  readonly exact: Cyc;
  /** Position residual projected to floats, millimetres. Reporting only. */
  readonly xy: [number, number];
  /** Magnitude in millimetres. Reporting only. */
  readonly gapMm: number;
  /** True when the residual is exactly the zero element. No epsilon. */
  readonly closesExactly: boolean;
  /**
   * Heading mismatch in 22.5-degree steps, modulo 16. Must be 0 for a closed
   * loop; a non-zero value means the track does not come back pointing the
   * right way, and no amount of joint give fixes a rotation.
   */
  readonly headingMismatchSteps: number;
  readonly joints: readonly Joint[];
  readonly poses: readonly Pose[];
}

export function computeResidual(layout: Layout, resolve: (id: string) => Part): ResidualReport {
  const poses = walk(layout, resolve);
  const n = layout.placements.length;
  const end = poses[n]!;
  const start = poses[0]!;

  const exact = sub(end.pos, start.pos);
  const xy = toXY(exact);
  const headingMismatchSteps = normalizeHeading(end.heading - start.heading);

  const joints: Joint[] = [];
  if (layout.closed) {
    // Interior joints sit between consecutive pieces, at poses[1..n-1]; the
    // closing seam is at poses[n], where the chain meets its own start.
    for (let j = 1; j <= n; j++) {
      const pose = poses[j]!;
      // Both sides of the joint. For j === n this wraps to placements[0],
      // which is correct: the closing seam mates the last piece to the first.
      const incomingId = layout.placements[j - 1]!.partId;
      const outgoingId = layout.placements[j % n]!.partId;
      const incoming = resolve(incomingId);
      const outgoing = resolve(outgoingId);
      const [px, py] = toXY(pose.pos);
      joints.push({
        index: j - 1,
        at: [px, py],
        between: [incomingId, outgoingId],
        axialMaxMm: Math.min(incoming.slop.axialMm, outgoing.slop.axialMm),
        angularMaxDeg: Math.min(incoming.slop.angularDeg, outgoing.slop.angularDeg),
      });
    }
  }

  return {
    exact,
    xy,
    gapMm: Math.hypot(xy[0], xy[1]),
    closesExactly: isZero(exact),
    headingMismatchSteps,
    joints,
    poses,
  };
}
