/**
 * What the verdict line renders, derived from a `GraphResult`.
 *
 * There was briefly a `solveViaGraph.ts` that flattened a GraphResult into
 * the old chain-shaped `SolveResult`. Its own docblock said that was honest
 * only while the UI could not build a branch: every graph it produced had
 * rank 0 or 1, so there were no per-cycle figures to lose. Free-end clicking
 * made that false, so it was deleted rather than left to quietly discard
 * them, and this takes its place.
 *
 * Pure, so the rules below are testable without a DOM. The ORDER of them is
 * the product's whole claim about what outranks what:
 *
 *   1. Impossible geometry beats everything, including an exact closure.
 *      Sixteen large curves close perfectly and run the same circle twice.
 *   2. Rotation beats give. No amount of joint slop fixes a loop that comes
 *      back pointing the wrong way.
 *   3. A gap is only compared against the give of ITS OWN loop.
 */

import type { GraphResult } from '../../engine/src/graph/solve.js';

export type VerdictKind =
  | 'NOTHING'
  | 'NO_CYCLE'
  | 'HEADING_MISMATCH'
  | 'TOO_MANY_LOOPS'
  | 'NUMERIC'
  | 'IMPOSSIBLE'
  | 'EXACT'
  | 'NEEDS_GIVE'
  | 'EXCEEDS';

export interface VerdictView {
  readonly kind: VerdictKind;
  readonly detail: string;
  /** The worst loop's gap, millimetres. */
  readonly gapMm: number;
  /** That same loop's OWN give. Never a total across loops. */
  readonly giveMm: number;
  /** Independent loops in the layout: E - V + CC. */
  readonly rank: number;
  /** How many of them do not fit. Zero when the layout works. */
  readonly failingLoops: number;
  readonly clashCount: number;
  readonly polarityCount: number;
  /** Joints in the worst loop, which is the number the gap is spread across. */
  readonly jointCount: number;
}

const EMPTY: VerdictView = {
  kind: 'NOTHING',
  detail: '',
  gapMm: 0,
  giveMm: 0,
  rank: 0,
  failingLoops: 0,
  clashCount: 0,
  polarityCount: 0,
  jointCount: 0,
};

export function viewOf(result: GraphResult | null): VerdictView {
  if (!result) return EMPTY;

  if (!result.ok) {
    /*
     * IMPOSSIBLE OUTRANKS "no loop yet".
     *
     * Two runs lying on top of each other is a definite, locatable problem
     * whether or not anything is closed. Reporting NO_CYCLE there told the
     * user the one thing that was not wrong and stayed silent about the one
     * that was.
     */
    if (result.clashes.length > 0 || result.polarityViolations.length > 0) {
      return {
        ...EMPTY,
        kind: 'IMPOSSIBLE',
        rank: result.rank,
        clashCount: result.clashes.length,
        polarityCount: result.polarityViolations.length,
      };
    }
    return { ...EMPTY, kind: result.reason, detail: result.detail, rank: result.rank };
  }

  const base = {
    detail: '',
    gapMm: result.gapMm,
    giveMm: result.totalGiveMm,
    rank: result.rank,
    failingLoops: result.cycles.filter((c) => !c.withinGive).length,
    clashCount: result.clashes.length,
    polarityCount: result.polarityViolations.length,
    jointCount: result.worst?.welds.length ?? 0,
  };

  // 1. Impossible outranks closure. Checked first for that reason.
  if (result.clashes.length > 0 || result.polarityViolations.length > 0) {
    return { ...base, kind: 'IMPOSSIBLE' };
  }
  if (result.closesExactly) return { ...base, kind: 'EXACT' };
  return { ...base, kind: result.withinBound ? 'NEEDS_GIVE' : 'EXCEEDS' };
}
