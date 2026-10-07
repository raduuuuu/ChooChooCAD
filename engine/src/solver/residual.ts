/**
 * Exact closure residual, and the per-joint give the bound needs.
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
 * part data itself labels `estimated`. What replaced it is a necessary
 * condition, computed in `result.ts`: the gap cannot exceed the give.
 *
 * So a joint here carries only what it has: where it is, and how much it gives.
 */

import { type Cyc, isZero, sub, toXY } from '../geom/cyclotomic.js';
import { normalizeHeading, walk, type Pose } from '../geom/pose.js';
import type { Layout, Part } from '../parts/schema.js';

/**
 * One joint and its budget. Deliberately NOT called a sensitivity any more:
 * nothing here says how this joint influences the closure, because nothing
 * computes that. See R21.
 */
export interface Joint {
  readonly index: number;
  /** Where the joint sits, as floats. Reporting only. */
  readonly at: [number, number];
  /** One-sided axial give at this joint, millimetres. */
  readonly axialMaxMm: number;
  /** One-sided angular give at this joint, degrees. */
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
      const part = resolve(layout.placements[j - 1]!.partId);
      const [px, py] = toXY(pose.pos);
      joints.push({
        index: j - 1,
        at: [px, py],
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

/**
 * The bound: total one-sided axial give available across every joint.
 *
 * Order-independent by construction, because addition is. The gauge dependence
 * that made the old solver flip a verdict between FAIL and TIGHT depending on
 * which piece was listed first cannot occur here.
 */
export function totalGiveMm(joints: readonly Joint[]): number {
  return joints.reduce((sum, j) => sum + j.axialMaxMm, 0);
}
