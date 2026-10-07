/**
 * The verdict line. Second in the visual hierarchy, and the place the product
 * makes its promise.
 *
 * Three rules it must never break:
 *
 *   GREY IS NOT GREEN. A failed check renders grey and says it could not check.
 *   It must never be mistaken for a pass, because a threshold comparison
 *   against a missing number quietly yields "fine".
 *
 *   NEVER CLAIM MORE THAN WAS CHECKED. The middle state is deliberately hedged.
 *   The engine knows the gap is within the joints' total give; it does NOT know
 *   that the give can actually be distributed to absorb it, and it does not
 *   pretend to. See decision R21.
 *
 *   NAME WHAT IS NOT VERIFIED. Joint give is `estimated`, not measured, and the
 *   line says so rather than letting a confident number imply otherwise.
 *
 * There is no per-joint ratio here any more. The minimax LP that produced one
 * was deleted at R21: it manufactured precision from guessed tolerances, and
 * every measured defect in the engine lived in it.
 */

import { evaluateLayout, type LayoutEvaluation } from '../../engine/src/joints/evaluate.js';
import type { SolveResult } from '../../engine/src/solver/result.js';

const FAILURE_COPY: Record<string, string> = {
  OPEN_CHAIN: 'Not a loop yet. Close it to check whether it works.',
  HEADING_MISMATCH: 'The track does not come back pointing the right way.',
  NUMERIC: 'Could not check this layout.',
};

function Hedge({ e }: { e: LayoutEvaluation }) {
  if (e.calibrationStatus === 'measured') return null;
  return (
    <span className="verdict-detail">
      {' '}Joint give is {e.calibrationStatus}, not measured.
    </span>
  );
}

export function VerdictLine({ result }: { result: SolveResult | null }) {
  if (!result) {
    return (
      <div className="verdict verdict-unknown">
        <span className="verdict-mark">?</span>
        <span>Nothing to check yet.</span>
      </div>
    );
  }

  // Every non-ok result is GREY. Never green, never styled as a near-pass.
  if (!result.ok) {
    return (
      <div className="verdict verdict-unknown">
        <span className="verdict-mark">?</span>
        <span>
          {FAILURE_COPY[result.reason] ?? 'Could not check this layout.'}{' '}
          <span className="verdict-detail">{result.detail}</span>
        </span>
      </div>
    );
  }

  const e = evaluateLayout(result, 'estimated');

  switch (e.verdict) {
    case 'EXACT':
      return (
        <div className="verdict verdict-pass">
          <span className="verdict-mark">O</span>
          <span>This works. Closes exactly, no give needed at any joint.</span>
        </div>
      );

    case 'NEEDS_GIVE':
      return (
        <div className="verdict verdict-tight">
          <span className="verdict-mark">/\</span>
          <span>
            Needs <span className="num">{e.gapMm.toFixed(0)}mm</span> absorbed across{' '}
            <span className="num">{e.jointCount}</span> joints, which give{' '}
            <span className="num">{e.totalGiveMm.toFixed(0)}mm</span> between them. It may
            well seat. Seat the triangles firmly.
            <Hedge e={e} />
          </span>
        </div>
      );

    case 'EXCEEDS':
      return (
        <div className="verdict verdict-fail">
          <span className="verdict-mark">X</span>
          <span>
            Won&rsquo;t fit. Needs <span className="num">{e.gapMm.toFixed(0)}mm</span>{' '}
            absorbed, but the joints give only{' '}
            <span className="num">{e.totalGiveMm.toFixed(0)}mm</span> in total.
            <Hedge e={e} />
          </span>
        </div>
      );

    case 'UNKNOWN':
      return (
        <div className="verdict verdict-unknown">
          <span className="verdict-mark">?</span>
          <span>
            Could not check this layout.{' '}
            <span className="verdict-detail">{e.reasons.join('; ')}</span>
          </span>
        </div>
      );
  }
}
