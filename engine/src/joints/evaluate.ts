/**
 * The single shared joint predicate.
 *
 * "Can a train get through this joint?" is asked by the verdict line, the
 * per-joint glyphs, the build-mode warnings, the diagnostics panel and the
 * fix-suggestion ranking. All five render THIS verdict; none recomputes it.
 * Five independent implementations would drift, and the visible symptom of
 * drift is the product contradicting itself, which costs more trust than being
 * consistently wrong.
 */

import type { CalibrationStatus } from '../parts/schema.js';
import type { JointUsage } from '../solver/lp.js';
import type { JointSensitivity } from '../solver/residual.js';

export type JointVerdict = 'PASS' | 'TIGHT' | 'FAIL' | 'UNKNOWN';

/** Below this fraction of budget a joint is comfortable. */
export const TIGHT_THRESHOLD = 0.8;
/** Above this fraction a joint is over budget. */
export const FAIL_THRESHOLD = 1.0;

export interface JointEvaluation {
  readonly index: number;
  readonly verdict: JointVerdict;
  readonly usedSlopMm: number;
  readonly usedSlopDeg: number;
  readonly budgetMm: number;
  readonly budgetDeg: number;
  readonly ratio: number;
  readonly reasons: readonly string[];
  readonly calibrationStatus: CalibrationStatus;
}

/** The verdict when no solve result exists. Distinct from PASS, deliberately. */
export function unknownJoint(
  sens: JointSensitivity,
  calibrationStatus: CalibrationStatus,
  why: string,
): JointEvaluation {
  return {
    index: sens.index,
    verdict: 'UNKNOWN',
    usedSlopMm: 0,
    usedSlopDeg: 0,
    budgetMm: sens.axialMaxMm,
    budgetDeg: sens.angularMaxDeg,
    ratio: 0,
    reasons: [why],
    calibrationStatus,
  };
}

export function evaluateJoint(
  usage: JointUsage,
  sens: JointSensitivity,
  calibrationStatus: CalibrationStatus,
): JointEvaluation {
  const reasons: string[] = [];
  let verdict: JointVerdict;

  if (!Number.isFinite(usage.ratio)) {
    // Should be unreachable: result.ts asserts finiteness at its boundary.
    // Kept because a threshold comparison against a non-number silently yields
    // false, which would render this joint as healthy.
    return unknownJoint(sens, calibrationStatus, 'non-finite slop usage');
  }

  if (usage.ratio > FAIL_THRESHOLD) {
    verdict = 'FAIL';
    reasons.push(
      `needs ${(usage.ratio * 100).toFixed(0)}% of this joint's give; over budget`,
    );
  } else if (usage.ratio >= TIGHT_THRESHOLD) {
    verdict = 'TIGHT';
    reasons.push('within budget but close to the limit; seat this joint firmly');
  } else {
    verdict = 'PASS';
  }

  if (Math.abs(usage.axialMm) > 1e-9) {
    reasons.push(`pulled ${usage.axialMm.toFixed(2)}mm of ${sens.axialMaxMm}mm axial`);
  }
  if (Math.abs(usage.angularDeg) > 1e-9) {
    reasons.push(
      `deflected ${usage.angularDeg.toFixed(2)} of ${sens.angularMaxDeg} degrees`,
    );
  }
  if (calibrationStatus !== 'measured') {
    reasons.push(`tolerance is ${calibrationStatus}, not measured`);
  }

  return {
    index: usage.index,
    verdict,
    usedSlopMm: usage.axialMm,
    usedSlopDeg: usage.angularDeg,
    budgetMm: sens.axialMaxMm,
    budgetDeg: sens.angularMaxDeg,
    ratio: usage.ratio,
    reasons,
    calibrationStatus,
  };
}
