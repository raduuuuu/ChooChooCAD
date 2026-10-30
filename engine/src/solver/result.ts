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
import { computeResidual, type Joint } from './residual.js';
import { BEND_BUDGET, pieceMove, solveRun, type RunBend } from '../graph/bendRun.js';
import type { BendStep } from '../graph/bend.js';
import { portsOf } from '../graph/model.js';
import { bendLimit } from '../../data/bendLimit.js';
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
 * no loop to check. FAILURE_COPY and ACTION_FOR_FAILURE are each a `Record`
 * over the app's own `FailureKind` union, so a missed rename is a compile
 * error there rather than a fallthrough to generic copy. Note that union is
 * WIDER than `SolveFailure`: it carries the two kinds the app adds on top of
 * the three below, so the two types are related by intent, not by code.
 */
export type SolveFailure = 'NO_CYCLE' | 'BEND_UNCHECKED' | 'NUMERIC';

export type SolveResult =
  | {
      readonly ok: true;
      /** True when the residual is exactly zero. No give needed at all. */
      readonly closesExactly: boolean;
      /** Residual magnitude in millimetres. Zero for an exact closure. */
      readonly gapMm: number;
      /** The loop's bend, from the same solver and rule as the graph path (eng review D2). */
      readonly bend: RunBend;
      /**
       * Closes, exactly or within the joints' bend. False means the loop needs
       * more bend than its joints are credited with, which is "beyond the
       * tested bend", never "will not fit" (docs/designs/joint-bend.md).
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

  /*
   * THE BEND, the same way the graph path weighs it (eng review D2): the loop
   * walked piece by piece from each part's own ports, one joint after each
   * piece, each joint the weaker of its two sides (D10). A loop that comes
   * back turned is just a walk whose end points the wrong way (D4), so there
   * is no heading refusal here any more.
   */
  const n = layout.placements.length;
  const parts = layout.placements.map((p) => resolve(p.partId));
  const steps: BendStep[] = layout.placements.map((p, i) => ({
    move: pieceMove(portsOf(parts[i]!, p.turn ?? 'left'), 0, 1),
    joint: i,
    sign: 1,
  }));
  const sideOf = (part: Part): { limitRad: number; stretchMm: number } => {
    const deg = part.brand === 'BRIO' ? bendLimit().deg : part.slop.angularDeg;
    return {
      limitRad: typeof deg === 'number' && Number.isFinite(deg) && deg > 0 ? (deg * Math.PI) / 180 : Number.NaN,
      stretchMm: part.slop.axialMm,
    };
  };
  const joints = parts.map((part, i) => {
    const a = sideOf(part);
    const b = sideOf(parts[(i + 1) % n]!);
    return { limitRad: Math.min(a.limitRad, b.limitRad), stretchMm: Math.min(a.stretchMm, b.stretchMm) };
  });
  const turnedSteps = Math.min(res.headingMismatchSteps, 16 - res.headingMismatchSteps);
  const pieceIds = layout.placements.map((_, i) => String(i));
  const bend: RunBend = res.closesExactly
    ? { pieces: pieceIds, status: 'exact', lambda: 0, stretchMm: 0, leftoverMm: 0, turnedSteps: 0, standalone: [0], why: null, work: 0, movesMm: 0, others: [], brio: true, atLeast: false }
    : solveRun(pieceIds, { joints, loops: [steps] }, turnedSteps, BEND_BUDGET);

  if (bend.status === 'unchecked') {
    return {
      ok: false,
      reason: 'BEND_UNCHECKED',
      detail: bend.why ?? 'the bend could not be checked',
      gapMm: Number.isFinite(res.gapMm) ? res.gapMm : undefined,
    };
  }
  // Finiteness assertion at the boundary. A non-finite number reaching a
  // threshold comparison silently renders as healthy, so it stops here.
  if (!allFinite(res.gapMm) || (bend.lambda !== null && !Number.isFinite(bend.lambda))) {
    return {
      ok: false,
      reason: 'NUMERIC',
      detail: 'residual or bend was not a finite number; refusing to report a verdict',
      gapMm: Number.isFinite(res.gapMm) ? res.gapMm : undefined,
    };
  }

  return {
    ok: true,
    closesExactly: res.closesExactly,
    gapMm: res.gapMm,
    bend,
    withinBound: bend.status === 'exact' || bend.status === 'closes',
    joints: res.joints,
    clashes: findCoincidentConnectors(res.poses, layout.closed),
    polarityViolations: findPolarityViolations(layout, resolve),
  };
}
