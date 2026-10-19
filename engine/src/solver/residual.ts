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
 *
 * A JOINT HAS TWO SIDES (fix C3, finding F1)
 *
 * This used to read the budget from `placements[j-1]` alone, which is one half
 * of a two-sided thing. A joint is a peg from one piece in a socket from
 * another, and neither piece's recorded `slop` is the pair's give: each is a
 * per-part summary. With two numbers and no pair data, the sound combination is
 * the LARGER of the two, and the reason is the contract rather than the physics.
 *
 * `totalGiveMm` backs a NECESSARY condition: "gap exceeds give, therefore this
 * definitely will not fit." That is a definite claim, and it is only sound if
 * the give figure is an upper bound on the give really available. Taking the
 * smaller side would understate give and turn the one definite verdict this
 * engine makes into a false one, which is the worst failure mode here. Taking
 * the larger side can only ever weaken the bound toward "might fit", which the
 * verdict already says out loud.
 *
 * Today every BRIO part shares one ESTIMATED_SLOP, so min and max are the same
 * number and this changes no output. It is fixed now because the moment the
 * catalogue carries differing budgets, or calibration produces real per-end
 * pair data, a one-sided read is a wrong answer rather than a tidy one.
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
  /** One-sided axial give at this joint, millimetres. Taken from the pair. */
  readonly axialMaxMm: number;
  /**
   * One-sided angular give at this joint, degrees. Taken from the pair.
   *
   * WRITTEN AND NEVER READ by any give calculation: `totalGiveMm` sums
   * `axialMaxMm` alone. Kept rather than deleted because deleting it would
   * erase the evidence that the question exists; see `totalGiveMm`'s docblock.
   */
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
        axialMaxMm: Math.max(incoming.slop.axialMm, outgoing.slop.axialMm),
        angularMaxDeg: Math.max(incoming.slop.angularDeg, outgoing.slop.angularDeg),
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
 * The bound: total one-sided AXIAL give available across every joint.
 *
 * Order-independent by construction, because addition is. The gauge dependence
 * that made the old solver flip a verdict between FAIL and TIGHT depending on
 * which piece was listed first cannot occur here.
 *
 * AXIAL ONLY, STATED HERE BECAUSE THE NAME DOES NOT SAY SO. This sums
 * `axialMaxMm`. `angularMaxDeg` sits on every `Joint` passed in and is NOT
 * read: not here, and nowhere else that computes give. The minimax LP deleted
 * at decision R21 did model the angular budget; dropping that solver left the
 * field in the schema and the term out of this sum.
 *
 * SO THIS FIGURE IS NOT ESTABLISHED AS AN UPPER BOUND, which is the condition
 * the docblock above makes the engine's one definite verdict depend on. Two
 * reasons, not one. A real term is missing. And the per-joint figure is
 * `Math.max` of two per-part summaries, which avoids the smaller estimate
 * without proving a real peg and socket cannot exceed both, so even a measured
 * axial number would not close it on its own.
 *
 * That is why the verdict copy says a gap exceeds the MODELLED give rather than
 * that the track will not fit: the comparison this function supports is against
 * a model, not against the world. Filed as P1 in `docs/plan/brio-TODOS.md`.
 * Closing it needs the measurement (`CALIBRATION.md` Q2) AND an aggregation
 * rule that yields a maximum rather than a mean, not just a number.
 */
export function totalGiveMm(joints: readonly Joint[]): number {
  return joints.reduce((sum, j) => sum + j.axialMaxMm, 0);
}
