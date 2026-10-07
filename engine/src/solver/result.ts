/**
 * The solver's public contract.
 *
 * A discriminated result, never an exception and never a bare number. The
 * failure case is a first-class state, and every numeric field is asserted
 * finite before it crosses this boundary, so a non-number can never reach a
 * display that would compare it against a threshold and silently render it as
 * healthy. UNKNOWN is a distinct state from GOOD, by construction.
 */

import { getPart } from '../../data/brio.js';
import { computeResidual, type JointSensitivity } from './residual.js';
import type { JointUsage } from './lp.js';
import { refine } from './refine.js';
import type { Layout, Part } from '../parts/schema.js';

export type SolveFailure =
  | 'OPEN_CHAIN'
  | 'HEADING_MISMATCH'
  | 'INFEASIBLE'
  | 'UNBOUNDED'
  | 'CYCLED'
  | 'TIMEDOUT'
  | 'DEGENERATE'
  | 'NUMERIC';

export type SolveResult =
  | {
      readonly ok: true;
      /** Exactly zero when the loop closes with no slop at all. */
      readonly worstRatio: number;
      /** Residual before slop, millimetres. Zero for an exact closure. */
      readonly gapMm: number;
      readonly closesExactly: boolean;
      readonly usage: readonly JointUsage[];
      readonly joints: readonly JointSensitivity[];
      /** Sequential LP passes taken before the remaining gap converged. */
      readonly passes: number;
      /** Gap still unclosed after the final pass, millimetres. */
      readonly remainingMm: number;
    }
  | {
      readonly ok: false;
      readonly reason: SolveFailure;
      readonly detail: string;
      /** Present when a residual was computed before the failure. */
      readonly gapMm?: number;
      /** Joints implicated, where the failure identifies any. */
      readonly suspectJoints?: readonly number[];
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
      reason: 'OPEN_CHAIN',
      detail: 'layout is an open chain; there is no loop to close',
    };
  }

  const res = computeResidual(layout, resolve);

  if (res.headingMismatchSteps !== 0) {
    const deg = res.headingMismatchSteps * 22.5;
    return {
      ok: false,
      reason: 'HEADING_MISMATCH',
      detail: `track returns ${deg} degrees off its starting direction; joint slop cannot fix a heading mismatch`,
      gapMm: res.gapMm,
    };
  }

  const { outcome: out, passes, remainingMm } = refine(layout, resolve, res.joints);

  switch (out.kind) {
    case 'infeasible':
      return { ok: false, reason: 'INFEASIBLE', detail: 'no bounded slop assignment closes this layout', gapMm: res.gapMm };
    case 'unbounded':
      return { ok: false, reason: 'UNBOUNDED', detail: 'slop model is under-constrained', gapMm: res.gapMm };
    case 'cycled':
      return { ok: false, reason: 'CYCLED', detail: 'solver cycled; treated as a hard failure', gapMm: res.gapMm };
    case 'timedout':
      return { ok: false, reason: 'TIMEDOUT', detail: 'solver exceeded its pivot budget', gapMm: res.gapMm };
    case 'degenerate':
      return { ok: false, reason: 'DEGENERATE', detail: out.reason, gapMm: res.gapMm };
    case 'solved':
      break;
  }

  // Finiteness assertion at the boundary. yalps returns NaN on infeasible and
  // +-Infinity on unbounded; neither may escape as a "solved" result.
  const nums = [out.worstRatio, res.gapMm, remainingMm, ...out.usage.flatMap((u) => [u.axialMm, u.angularDeg, u.ratio])];
  if (!allFinite(...nums)) {
    return {
      ok: false,
      reason: 'NUMERIC',
      detail: 'solver produced a non-finite value; refusing to report a verdict',
      gapMm: Number.isFinite(res.gapMm) ? res.gapMm : undefined,
    };
  }

  return {
    ok: true,
    worstRatio: out.worstRatio,
    gapMm: res.gapMm,
    closesExactly: res.closesExactly,
    usage: out.usage,
    joints: res.joints,
    passes,
    remainingMm,
  };
}
