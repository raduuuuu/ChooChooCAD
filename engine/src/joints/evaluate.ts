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

import type { ConnectorClash, PolarityViolation } from '../feasible.js';
import type { CalibrationStatus } from '../parts/schema.js';
import type { SolveResult } from '../solver/result.js';
import { bendWords } from './bendWords.js';
import { bendLimit } from '../../data/bendLimit.js';

export type LayoutVerdict =
  /**
   * Two pieces are asked to occupy the same place. Definite, exact, and it
   * OUTRANKS EXACT: a double circle closes perfectly and cannot be built.
   * Checked before closure for that reason.
   */
  | 'IMPOSSIBLE'
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
  /** The worst joint's bend as a share of its limit; null when not solved. */
  readonly lambda: number | null;
  readonly jointCount: number;
  /** Coincident non-adjacent connectors. Empty unless the verdict is IMPOSSIBLE. */
  readonly clashes: readonly ConnectorClash[];
  /** Joints that cannot physically mate. Empty unless the verdict is IMPOSSIBLE. */
  readonly polarityViolations: readonly PolarityViolation[];
  readonly reasons: readonly string[];
  readonly calibrationStatus: CalibrationStatus;
}

/** The verdict when no result exists. Distinct from EXACT, deliberately. */
export function unknownLayout(why: string, calibrationStatus: CalibrationStatus): LayoutEvaluation {
  return {
    verdict: 'UNKNOWN',
    gapMm: 0,
    lambda: null,
    jointCount: 0,
    clashes: [],
    polarityViolations: [],
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
  if (!Number.isFinite(result.gapMm) || (result.bend.lambda !== null && !Number.isFinite(result.bend.lambda))) {
    return unknownLayout('non-finite gap or bend', calibrationStatus);
  }

  const reasons: string[] = [];
  const jointCount = result.joints.length;
  let verdict: LayoutVerdict;

  // BEFORE closure, deliberately. A double circle closes exactly and is still
  // impossible, so asking "does it close" first would report EXACT and be wrong.
  // Polarity comes first of the two because an unjoinable END is a stronger and
  // simpler statement than two pieces sharing a POSITION.
  if (result.polarityViolations.length > 0) {
    verdict = 'IMPOSSIBLE';
    const v = result.polarityViolations;
    reasons.push(
      `${v.length} ${v.length === 1 ? 'joint joins' : 'joints join'} two ends of the ` +
        'same kind, which do not fit together',
    );
    for (const x of v) {
      reasons.push(`joint ${x.jointIndex}: ${x.between[0]} to ${x.between[1]}, both ${x.polarity}`);
    }
  } else if (result.clashes.length > 0) {
    verdict = 'IMPOSSIBLE';
    const n = result.clashes.length;
    reasons.push(
      `${n} ${n === 1 ? 'pair of connectors shares' : 'pairs of connectors share'} ` +
        'the same exact position, so two pieces would have to occupy the same place',
    );
    if (result.closesExactly) {
      reasons.push('the loop does close exactly; it still cannot be assembled');
    }
    // Said out loud so IMPOSSIBLE is not read as a complete overlap check.
    reasons.push('only exact connector coincidences are checked; pieces crossing mid-span are not');
  } else if (result.closesExactly) {
    verdict = 'EXACT';
    reasons.push('closes exactly; no give needed at any joint');
  } else {
    // The same words the verdict line renders, built once (eng review D7).
    verdict = result.withinBound ? 'NEEDS_GIVE' : 'EXCEEDS';
    const words = bendWords(result.bend, bendLimit(), result.withinBound ? 0 : 1, 1);
    reasons.push(words.line);
    if (words.turned) reasons.push(words.turned);
    for (const l of words.limits) reasons.push(l.text);
  }

  if (calibrationStatus !== 'measured') {
    reasons.push(`joint give is ${calibrationStatus}, not measured`);
  }

  return {
    verdict,
    gapMm: result.gapMm,
    lambda: result.bend.lambda,
    jointCount,
    clashes: result.clashes,
    polarityViolations: result.polarityViolations,
    reasons,
    calibrationStatus,
  };
}
