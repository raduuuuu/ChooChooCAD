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
  | 'TOO_BIG_TO_CHECK'
  | 'NUMERIC'
  | 'IMPOSSIBLE'
  | 'EXACT'
  | 'NEEDS_GIVE'
  | 'EXCEEDS';

export interface VerdictView {
  readonly kind: VerdictKind;
  readonly detail: string;
  /**
   * The worst loop's gap, millimetres -- ONLY when `gapKnown`.
   *
   * On a refusal this is a filler zero, and a zero filler read as a
   * measurement is what printed "The loop does close" over layouts whose
   * loops were never examined. Check `gapKnown` before saying anything about
   * closure.
   */
  readonly gapMm: number;
  /**
   * True when `gapMm` and `giveMm` came from a real measurement.
   *
   * False on every refusal, because `EMPTY` fills them with zero. The engine
   * decides closure from exact residuals; a refusal never got that far.
   */
  readonly gapKnown: boolean;
  /** That same loop's OWN give. Never a total across loops. */
  readonly giveMm: number;
  /** Independent loops in the layout: E - V + CC. */
  readonly rank: number;
  /** How many of them do not fit. Zero when the layout works. */
  readonly failingLoops: number;
  readonly clashCount: number;
  /** Places where one plank runs over another, ends nowhere near (overlap.ts). */
  readonly overlapCount: number;
  readonly polarityCount: number;
  /** Welds where two sockets meet, each needing a male-male adapter. Never changes the kind. */
  readonly adapterCount: number;
  /** Joints in the worst loop, which is the number the gap is spread across. */
  readonly jointCount: number;
  /**
   * The gap in pieces (task X6): the one straight that closes the one
   * failing loop, added or taken out. Only on EXCEEDS, and only when every
   * guard in `engine/src/graph/repair.ts` passed; null means say millimetres.
   */
  readonly pieces: {
    readonly direction: 'short' | 'long';
    readonly name: string;
    readonly lengthMm: number;
    readonly partNumber: string | null;
  } | null;
}

const EMPTY: VerdictView = {
  gapKnown: false,
  kind: 'NOTHING',
  detail: '',
  gapMm: 0,
  giveMm: 0,
  rank: 0,
  failingLoops: 0,
  clashCount: 0,
  overlapCount: 0,
  polarityCount: 0,
  adapterCount: 0,
  jointCount: 0,
  pieces: null,
};

/** Track in a place it cannot be: ends piled up, planks crossing, or ends that do not fit. */
const impossible = (r: GraphResult): boolean =>
  r.clashes.length > 0 || r.overlaps.length > 0 || r.polarityViolations.length > 0;

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
    if (impossible(result)) {
      return {
        ...EMPTY,
        kind: 'IMPOSSIBLE',
        rank: result.rank,
        clashCount: result.clashes.length,
        overlapCount: result.overlaps.length,
        polarityCount: result.polarityViolations.length,
        adapterCount: result.adapterJoints.length,
      };
    }
    return {
      ...EMPTY,
      kind: result.reason,
      detail: result.detail,
      rank: result.rank,
      adapterCount: result.adapterJoints.length,
    };
  }

  const base = {
    detail: '',
    // Measured: this is the solved branch, so the engine traced the cycles.
    gapKnown: true,
    gapMm: result.gapMm,
    giveMm: result.totalGiveMm,
    rank: result.rank,
    failingLoops: result.cycles.filter((c) => !c.withinGive).length,
    clashCount: result.clashes.length,
    overlapCount: result.overlaps.length,
    polarityCount: result.polarityViolations.length,
    adapterCount: result.adapterJoints.length,
    jointCount: result.worst?.welds.length ?? 0,
    pieces: null,
  };

  // 1. Impossible outranks closure. Checked first for that reason.
  if (impossible(result)) {
    return { ...base, kind: 'IMPOSSIBLE' };
  }
  if (result.closesExactly) return { ...base, kind: 'EXACT' };
  if (result.withinBound) return { ...base, kind: 'NEEDS_GIVE' };
  const r = result.repair;
  return {
    ...base,
    kind: 'EXCEEDS',
    pieces: r
      ? {
          direction: r.direction,
          name: r.part.name,
          lengthMm: r.part.lengthMm,
          partNumber: r.partNumber,
        }
      : null,
  };
}
