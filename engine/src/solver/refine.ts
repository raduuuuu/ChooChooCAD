/**
 * Sequential LP refinement.
 *
 * Stage 2 linearises the effect of joint slop about the nominal pose. That
 * linearisation is only accurate for small perturbations, and the lever arms
 * here are not small: one degree of deflection at a joint 364mm from the seam
 * moves the seam by about 6mm. A single pass therefore depends on where the
 * loop was cut, which is an arbitrary gauge choice, and that showed up
 * immediately as an order-independence failure (the same physical loop scored
 * 1.37 or 1.73 depending on which piece was listed first).
 *
 * Two things were wrong, found in that order:
 *
 *   1. The closure constraint was incomplete. Position was enforced but the
 *      angular slop was never required to sum to zero, so the LP could land the
 *      seam in the right PLACE facing the wrong DIRECTION. Adding that third row
 *      cut the gauge spread from 1.7e-1 to 1.9e-3.
 *   2. The linearisation needs re-solving from the updated pose. Five passes
 *      drives the remaining gap to ~1e-8 mm; further passes change nothing.
 *
 * KNOWN LIMITATION, measured not guessed: after both fixes the gauge spread
 * PLATEAUS at ~1.9e-3 in worst-ratio and does not shrink with more passes. The
 * two cut points converge to genuinely different optima, because the axial slop
 * direction is the heading AT each joint and the converged configurations differ
 * slightly. 1.9e-3 of a 1.5-degree budget is 0.003 degrees, which nobody can
 * seat a wooden joint to, and the budget itself is an unmeasured placeholder.
 * So the VERDICT is gauge-independent while the exact ratio is not, and that is
 * what the property test asserts. Revisit if real measurements ever make the
 * ratio meaningful to three decimal places.
 *
 * Exactness is preserved where it matters. The NOMINAL residual is still an
 * exact integer computation; only the corrections are floating point.
 */

import { nominalFinalHeading, walkFloat, type FPose, type Slop } from '../geom/fk.js';
import type { Layout, Part } from '../parts/schema.js';
import { distribute, type JointUsage, type LpOutcome } from './lp.js';
import type { JointSensitivity } from './residual.js';

const DEG_PER_RAD = 180 / Math.PI;
const MAX_PASSES = 8;
/** Stop refining once the remaining gap is below this, in millimetres. */
const CONVERGED_MM = 1e-7;

/** Sensitivities recomputed from an actual (possibly slopped) configuration. */
function sensitivitiesFrom(
  poses: readonly FPose[],
  template: readonly JointSensitivity[],
): JointSensitivity[] {
  const end = poses[poses.length - 1]!;
  return template.map((t, k) => {
    const p = poses[k + 1]!;
    return {
      ...t,
      at: [p.x, p.y],
      axialDir: [Math.cos(p.h), Math.sin(p.h)],
      angularLever: [-(end.y - p.y), end.x - p.x],
    };
  });
}

export interface RefineResult {
  readonly outcome: LpOutcome;
  readonly passes: number;
  /** Remaining gap after the final pass, millimetres. */
  readonly remainingMm: number;
}

/**
 * Solve, then re-solve from the resulting configuration until the remaining
 * gap converges or the pass budget is spent.
 */
export function refine(
  layout: Layout,
  resolve: (id: string) => Part,
  nominalJoints: readonly JointSensitivity[],
): RefineResult {
  const n = layout.placements.length;
  const acc: Slop[] = Array.from({ length: n }, () => ({ axialMm: 0, angularRad: 0 }));

  let joints = nominalJoints;
  let lastOutcome: LpOutcome | null = null;
  let remainingMm = Number.POSITIVE_INFINITY;
  let passes = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    passes = pass + 1;

    const { poses } = walkFloat(layout, resolve, acc);
    const end = poses[poses.length - 1]!;
    // Nominal final heading is a whole number of turns for a closed loop, which
    // computeResidual already verified exactly. So any heading error here is
    // exactly the accumulated angular slop, and the next pass must cancel it.
    const headingErr = end.h - nominalFinalHeading(layout, resolve);
    const residual: [number, number, number] = [end.x, end.y, headingErr];
    remainingMm = Math.hypot(residual[0], residual[1]);

    if (pass > 0) {
      joints = sensitivitiesFrom(poses, nominalJoints);
      if (remainingMm < CONVERGED_MM) break;
    }

    const out = distribute(residual, joints);
    if (out.kind !== 'solved') {
      return { outcome: out, passes, remainingMm };
    }

    // Accumulate this pass's increment.
    out.usage.forEach((u, k) => {
      const a = acc[k];
      if (a) {
        a.axialMm += u.axialMm;
        a.angularRad += u.angularDeg / DEG_PER_RAD;
      }
    });
    lastOutcome = out;
  }

  // Report the ACCUMULATED slop, not just the last increment, and recompute the
  // worst ratio from it so the number the user sees matches the configuration.
  const usage: JointUsage[] = acc.map((s, k) => {
    const t = nominalJoints[k]!;
    const angularDeg = s.angularRad * DEG_PER_RAD;
    const axRatio = t.axialMaxMm > 0 ? Math.abs(s.axialMm) / t.axialMaxMm : 0;
    const angRatio = t.angularMaxDeg > 0 ? Math.abs(angularDeg) / t.angularMaxDeg : 0;
    return {
      index: t.index,
      axialMm: s.axialMm,
      angularDeg,
      ratio: Math.max(axRatio, angRatio),
    };
  });

  const worstRatio = usage.reduce((m, u) => Math.max(m, u.ratio), 0);

  if (!lastOutcome) {
    return { outcome: { kind: 'degenerate', reason: 'no pass produced a solution' }, passes, remainingMm };
  }

  return { outcome: { kind: 'solved', worstRatio, usage }, passes, remainingMm };
}
