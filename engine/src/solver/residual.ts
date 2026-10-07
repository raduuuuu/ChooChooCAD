/**
 * Exact closure residual, and the joint list the LP needs.
 *
 * Stage 1 of the engine. The residual of a fixed topology is an exact algebraic
 * constant, computed in integer arithmetic. Nothing iterates and nothing can
 * fail numerically here.
 */

import { type Cyc, isZero, sub, toXY } from '../geom/cyclotomic.js';
import { headingUnit, normalizeHeading, walk, type Pose } from '../geom/pose.js';
import type { Layout, Part } from '../parts/schema.js';

export interface JointSensitivity {
  readonly index: number;
  /** Where the joint sits, as floats, for reporting. */
  readonly at: [number, number];
  /** Unit vector along the track at this joint: how axial slop moves the seam. */
  readonly axialDir: [number, number];
  /**
   * Lever arm effect: how one radian of angular slop at this joint moves the
   * closure point. Perpendicular to the vector from the joint to the end.
   * Zero for the closing seam itself, which sits at the gap.
   */
  readonly angularLever: [number, number];
  readonly axialMaxMm: number;
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
   * right way and no amount of joint slop fixes it.
   */
  readonly headingMismatchSteps: number;
  readonly joints: readonly JointSensitivity[];
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

  const joints: JointSensitivity[] = [];
  if (layout.closed) {
    // Interior joints sit between consecutive pieces, at poses[1..n-1].
    // The closing seam is at poses[n], where the chain meets its own start.
    for (let j = 1; j <= n; j++) {
      const pose = poses[j]!;
      const part = resolve(layout.placements[j - 1]!.partId);
      const [px, py] = toXY(pose.pos);
      const [ex, ey] = toXY(end.pos);
      // Rotating everything downstream of this joint by phi moves the end by
      // phi * i * (P_end - P_joint), i.e. perpendicular to the lever arm.
      const lever: [number, number] = [-(ey - py), ex - px];
      joints.push({
        index: j - 1,
        at: [px, py],
        axialDir: headingUnit(pose.heading),
        angularLever: lever,
        axialMaxMm: part.slop.axialMm,
        angularMaxDeg: part.slop.angularDeg,
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
