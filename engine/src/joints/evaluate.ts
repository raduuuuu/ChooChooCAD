/**
 * The single shared layout predicate.
 *
 * "Will this layout work?" is asked by the verdict line and, later, by build
 * mode and the diagnostics panel. All of them render THIS verdict; none
 * recomputes it. Independent implementations would drift, and the visible
 * symptom of drift is the product contradicting itself, which costs more trust
 * than being consistently wrong.
 *
 * This used to be a per-JOINT predicate with a ratio sliced at 0.8. Decision
 * R21 deleted the LP that produced those ratios, so there is no per-joint claim
 * to make and no threshold to slice. The verdict is now layout-level and its
 * middle state is deliberately hedged: the data cannot support more.
 */

import type { CalibrationStatus } from '../parts/schema.js';
import type { SolveResult } from '../solver/result.js';

export type LayoutVerdict =
  /** Residual is exactly zero. Needs no give at any joint. */
  | 'EXACT'
  /** Does not close exactly, but the gap is within the total give. MIGHT fit. */
  | 'NEEDS_GIVE'
  /** The gap exceeds the total give. Definitely does not fit. */
  | 'EXCEEDS'
  /** Could not be checked. Never to be confused with any of the above. */
  | 'UNKNOWN';

export interface LayoutEvaluation {
  readonly verdict: LayoutVerdict;
  /** Residual magnitude, millimetres. Zero when EXACT. */
  readonly gapMm: number;
  /** Total one-sided axial give across all joints, millimetres. */
  readonly totalGiveMm: number;
  readonly jointCount: number;
  readonly reasons: readonly string[];
  readonly calibrationStatus: CalibrationStatus;
}

/** The verdict when no result exists. Distinct from EXACT, deliberately. */
export function unknownLayout(why: string, calibrationStatus: CalibrationStatus): LayoutEvaluation {
  return {
    verdict: 'UNKNOWN',
    gapMm: 0,
    totalGiveMm: 0,
    jointCount: 0,
    reasons: [why],
    calibrationStatus,
  };
}

export function evaluateLayout(
  result: SolveResult,
  calibrationStatus: CalibrationStatus,
): LayoutEvaluation {
  if (!result.ok) {
    return unknownLayout(result.detail, calibrationStatus);
  }

  // Should be unreachable: result.ts asserts finiteness at its boundary. Kept
  // because a comparison against a non-number silently yields false, which
  // would render as healthy.
  if (!Number.isFinite(result.gapMm) || !Number.isFinite(result.totalGiveMm)) {
    return unknownLayout('non-finite gap or give', calibrationStatus);
  }

  const reasons: string[] = [];
  const jointCount = result.joints.length;
  let verdict: LayoutVerdict;

  if (result.closesExactly) {
    verdict = 'EXACT';
    reasons.push('closes exactly; no give needed at any joint');
  } else if (result.withinBound) {
    verdict = 'NEEDS_GIVE';
    reasons.push(
      `needs ${result.gapMm.toFixed(0)}mm absorbed across ${jointCount} joints, ` +
        `which have ${result.totalGiveMm.toFixed(0)}mm between them`,
    );
    reasons.push('within the total give, so it may well seat; this is not a guarantee');
  } else {
    verdict = 'EXCEEDS';
    reasons.push(
      `needs ${result.gapMm.toFixed(0)}mm absorbed but the joints give only ` +
        `${result.totalGiveMm.toFixed(0)}mm in total`,
    );
  }

  if (calibrationStatus !== 'measured') {
    reasons.push(`joint give is ${calibrationStatus}, not measured`);
  }

  return {
    verdict,
    gapMm: result.gapMm,
    totalGiveMm: result.totalGiveMm,
    jointCount,
    reasons,
    calibrationStatus,
  };
}
