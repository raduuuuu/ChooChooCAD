/**
 * HOW FAR A BRIO JOINT IS CREDITED WITH BENDING (docs/designs/joint-bend.md).
 *
 * Three sources, in this order (eng review, "The limit: one value, defined by
 * the solver"):
 *
 * 1. MEASURED: CALIBRATION.md Q2's bend reading, when one was taken.
 * 2. INFERRED: the bend the Q1 loop needs, when it closed on the floor and a
 *    train ran round it. That loop is a fact about real joints: they bent at
 *    least that far, all at once, and still carried a train. It is a LOWER
 *    bound on what joints do, which is why a verdict past it says "beyond
 *    the tested bend" and never "will not fit".
 * 3. ESTIMATED: the 1.5-degree guess, when neither was read.
 *
 * DERIVED BY THE SHIPPED SOLVER, NEVER TYPED IN. The inferred value is
 * `solveBend`'s own answer for Q1 with a UNIT_DEG limit on every joint, read
 * back as degrees, so Q1 can never land on the wrong side of it through
 * rounding or a second model (design R1-3). The unit is ten degrees, not one,
 * so that Q1's answer (about 0.27 of it) sits well inside the range the solver
 * refines; with a one-degree unit the answer reads 2.7, which the solver
 * treats as surely beyond and stops refining (measured: the derivation then
 * returned the unrefined 2.71 with 3.4mm left over, and fell back to the
 * estimate).
 *
 * LAZY, BECAUSE OF LOAD ORDER (eng review D15). Q1's pieces live in the
 * catalogue, and the catalogue's own slop is computed while brio.ts loads, so
 * deriving this at load would read a half-built list. It is computed on the
 * first call, after loading has finished, and remembered.
 */

import { solveBend, type BendStep } from '../src/graph/bend.js';
import { pieceMove } from '../src/graph/bendRun.js';
import { portsOf } from '../src/graph/model.js';
import { ESTIMATES, measuredBendDeg, type Measurements } from './calibration.js';
import { getPart } from './brio.js';
import { MEASUREMENTS } from './measurements.js';

export type BendLimitStatus = 'measured' | 'inferred' | 'estimated';

export interface BendLimit {
  readonly deg: number;
  readonly status: BendLimitStatus;
  /** Where the figure came from, in words. */
  readonly source: string;
  /**
   * For an inferred limit: how much the solver's refined answer exceeds its
   * first, linear one, in degrees. The refined answer is a closure the solver
   * FOUND, so it can sit a little above the true minimum; this is how much
   * (eng review D13). Zero for the other two sources.
   */
  readonly marginDeg: number;
}

/** The Q1 loop: four large curves, the long straight, four large curves, the medium straight. */
export const Q1_LOOP = ['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'A'] as const;

/** The joint limit the derivation solves with; lambda times this is the bend in degrees. */
const UNIT_DEG = 10;

/** The bend the Q1 loop needs, in degrees. */
export function q1BendDeg(stretchMm: number): { deg: number; firstLinearDeg: number } | null {
  const steps: BendStep[] = Q1_LOOP.map((id, i) => ({
    move: pieceMove(portsOf(getPart(id)), 0, 1),
    joint: i,
    sign: 1,
  }));
  const joints = Q1_LOOP.map(() => ({ limitRad: (UNIT_DEG * Math.PI) / 180, stretchMm }));
  const o = solveBend({ joints, loops: [steps] }, 1e6, 1e9);
  if (o.kind !== 'solved' || o.leftoverMm > 0.5) return null;
  return { deg: o.lambda * UNIT_DEG, firstLinearDeg: o.firstLinearLambda * UNIT_DEG };
}

export function deriveBendLimit(m: Measurements, stretchMm: number): BendLimit {
  const measured = measuredBendDeg(m);
  if (measured !== null) {
    return { deg: measured, status: 'measured', source: 'CALIBRATION.md Q2, measured on one joint', marginDeg: 0 };
  }
  if (m.q1.closes === true && m.q1.trainRuns === true) {
    const q1 = q1BendDeg(stretchMm);
    if (q1 !== null) {
      return {
        deg: q1.deg,
        status: 'inferred',
        source: 'CALIBRATION.md Q1: a loop that closed and carried a train needed this much',
        marginDeg: Math.max(0, q1.deg - q1.firstLinearDeg),
      };
    }
  }
  return { deg: ESTIMATES.angularDeg, status: 'estimated', source: 'an estimate; nobody has measured it', marginDeg: 0 };
}

let cached: BendLimit | null = null;

/** The BRIO bend limit, derived on first use from the readings and remembered. */
export function bendLimit(): BendLimit {
  if (cached === null) cached = deriveBendLimit(MEASUREMENTS, getPart('A').slop.axialMm);
  return cached;
}
