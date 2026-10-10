/**
 * The solver's public contract.
 *
 * A discriminated result, never an exception and never a bare number. The
 * failure case is a first-class state, and every numeric field is asserted
 * finite before it crosses this boundary, so a non-number can never reach a
 * display that would compare it against a threshold and silently render it as
 * healthy. UNKNOWN is a distinct state from GOOD, by construction.
 *
 * WHAT THIS REPORTS, AND WHAT IT DELIBERATELY DOES NOT (decision R21)
 *
 * Stage 1 answers exactly: does the loop close, in integer arithmetic, with no
 * epsilon. That answer is trustworthy and always has been.
 *
 * When it does not close, the honest remaining question is whether the leftover
 * gap is small enough for the joints to absorb. This reports a NECESSARY
 * condition: the gap cannot exceed the sum of the joints' give. If it does, the
 * layout definitely will not fit. If it does not, the layout MIGHT fit, and that
 * is as much as the available data supports.
 *
 * It is not sufficient, and it does not pretend to be. A minimax LP used to
 * allocate the gap joint by joint and report a per-joint ratio, which looked
 * like more. It was deleted at R21, because every measured defect in this
 * project lived in it and because its precision was manufactured from
 * tolerances the part data labels `estimated`. A hedged band over a guessed
 * budget is the truth; a ratio sliced at 0.8 was not.
 *
 * So there is no per-joint verdict here. When the budgets are measured, the
 * allocation becomes worth reinstating and this contract grows a per-joint
 * field again. Until then it says what it knows.
 */

import { getPart } from '../../data/brio.js';
import { computeResidual, totalGiveMm, type Joint } from './residual.js';
import {
  findCoincidentConnectors,
  findPolarityViolations,
  type ConnectorClash,
  type PolarityViolation,
} from '../feasible.js';
import type { Layout, Part } from '../parts/schema.js';

/**
 * Three reasons, down from eight. INFEASIBLE, UNBOUNDED, CYCLED, TIMEDOUT and
 * DEGENERATE were all statuses of the deleted LP and are unreachable now.
 */
/*
 * NO_CYCLE, renamed from OPEN_CHAIN (T10).
 *
 * The old name was a chain artifact and says something false about a graph:
 * a layout can be a tree, a forest, or four loose pieces on the table, none
 * of which is "an open chain". What is true in every case is that there is
 * no loop to check. `Record<SolveFailure, string>` on FAILURE_COPY and
 * ACTION_FOR_FAILURE means a missed rename is a compile error, not a
 * fallthrough to generic copy.
 */
export type SolveFailure = 'NO_CYCLE' | 'HEADING_MISMATCH' | 'NUMERIC';

export type SolveResult =
  | {
      readonly ok: true;
      /** True when the residual is exactly zero. No give needed at all. */
      readonly closesExactly: boolean;
      /** Residual magnitude in millimetres. Zero for an exact closure. */
      readonly gapMm: number;
      /** Sum of one-sided axial give across every joint, millimetres. */
      readonly totalGiveMm: number;
      /**
       * gapMm <= totalGiveMm. NECESSARY, not sufficient: false means the layout
       * definitely does not fit; true means it might.
       */
      readonly withinBound: boolean;
      readonly joints: readonly Joint[];
      /**
       * Non-adjacent connectors sitting at the same exact position (task C4).
       *
       * Empty for every assemblable layout. Non-empty is a DEFINITE refusal and
       * it OVERRIDES closure, including an exact one: sixteen large curves close
       * with a zero residual and run round the same circle twice. This is
       * reported on the `ok: true` branch on purpose, because the solve did not
       * fail. The geometry computed fine; the layout is impossible.
       */
      readonly clashes: readonly ConnectorClash[];
      /**
       * Joints whose two ends have the same polarity (task C2). Unreachable by
       * appending, and reported anyway: a restored or imported layout, and D8's
       * declared welds, both bypass the append path. Like `clashes`, non-empty is
       * a DEFINITE refusal that overrides an exact closure.
       */
      readonly polarityViolations: readonly PolarityViolation[];
    }
  | {
      readonly ok: false;
      readonly reason: SolveFailure;
      readonly detail: string;
      /** Present when a residual was computed before the failure. */
      readonly gapMm?: number;
    };

function allFinite(...xs: number[]): boolean {
  return xs.every((x) => Number.isFinite(x));
}

export function solveLayout(
  layout: Layout,
  resolve: (id: string) => Part = getPart,
): SolveResult {
  if (!layout.closed) {
    return {
      ok: false,
      reason: 'NO_CYCLE',
      detail: 'nothing here forms a loop yet, so there is nothing to close',
    };
  }

  const res = computeResidual(layout, resolve);

  if (res.headingMismatchSteps !== 0) {
    const deg = res.headingMismatchSteps * 22.5;
    return {
      ok: false,
      reason: 'HEADING_MISMATCH',
      detail: `track returns ${deg} degrees off its starting direction; joint give cannot fix a heading mismatch`,
      gapMm: res.gapMm,
    };
  }

  const give = totalGiveMm(res.joints);

  // Finiteness assertion at the boundary. A non-finite number reaching a
  // threshold comparison silently renders as healthy, so it stops here.
  if (!allFinite(res.gapMm, give)) {
    return {
      ok: false,
      reason: 'NUMERIC',
      detail: 'residual or give was not a finite number; refusing to report a verdict',
      gapMm: Number.isFinite(res.gapMm) ? res.gapMm : undefined,
    };
  }

  return {
    ok: true,
    closesExactly: res.closesExactly,
    gapMm: res.gapMm,
    totalGiveMm: give,
    withinBound: res.gapMm <= give,
    joints: res.joints,
    clashes: findCoincidentConnectors(res.poses, layout.closed),
    polarityViolations: findPolarityViolations(layout, resolve),
  };
}
