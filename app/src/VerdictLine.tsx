/**
 * The verdict line. Second in the visual hierarchy, and the place the product
 * makes its promise.
 *
 * Two rules it must never break:
 *
 *   GREY IS NOT GREEN. A failed solve renders grey and says it could not check.
 *   It must never be mistaken for a pass, because a threshold comparison
 *   against a missing number quietly yields "fine".
 *
 *   NAME THE AXIS. Joint tolerance and route traversability are independent.
 *   Whichever is worse is what shows, and it always says which one it is,
 *   because the fix differs completely: nudge a piece, or raise a bridge.
 *
 * Route traversability is not implemented yet (the checker is designed and
 * unbuilt), so today only the joint axis can ever be the worse one. The shape
 * is here so adding the second axis does not need a redesign.
 */

import type { SolveResult } from '../../engine/src/solver/result.js';

const FAILURE_COPY: Record<string, string> = {
  OPEN_CHAIN: 'Not a loop yet. Close it to check whether it works.',
  HEADING_MISMATCH: 'The track does not come back pointing the right way.',
  INFEASIBLE: 'No arrangement of joint give closes this.',
  UNBOUNDED: 'The slop model is under-constrained.',
  CYCLED: 'Could not check this layout.',
  TIMEDOUT: 'Could not check this layout in time.',
  DEGENERATE: 'Not enough joints to take up any slack.',
  NUMERIC: 'Could not check this layout.',
};

export function VerdictLine({ result }: { result: SolveResult | null }) {
  if (!result) {
    return (
      <div className="verdict verdict-unknown">
        <span className="verdict-mark">?</span>
        <span>Nothing to check yet.</span>
      </div>
    );
  }

  if (!result.ok) {
    // Every non-ok result is GREY. Never green, never styled as a near-pass.
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

  const pct = Math.round(result.worstRatio * 100);

  if (result.closesExactly) {
    return (
      <div className="verdict verdict-pass">
        <span className="verdict-mark">O</span>
        <span>
          This works. Closes exactly, no give needed at any joint.
        </span>
      </div>
    );
  }

  if (result.worstRatio > 1) {
    return (
      <div className="verdict verdict-fail">
        <span className="verdict-mark">X</span>
        <span>
          Won&rsquo;t fit &mdash; <span className="num">{result.gapMm.toFixed(0)}mm</span> short.
          The worst joint would need <span className="num">{pct}%</span> of the give it has.
        </span>
      </div>
    );
  }

  if (result.worstRatio >= 0.8) {
    return (
      <div className="verdict verdict-tight">
        <span className="verdict-mark">/\</span>
        <span>
          Works, but tight. <span className="num">{result.gapMm.toFixed(0)}mm</span> taken up
          across the joints; the worst is at <span className="num">{pct}%</span>. Seat the
          triangles firmly.
        </span>
      </div>
    );
  }

  return (
    <div className="verdict verdict-pass">
      <span className="verdict-mark">O</span>
      <span>
        This works. <span className="num">{result.gapMm.toFixed(0)}mm</span> spread across the
        joints, worst at <span className="num">{pct}%</span>.
      </span>
    </div>
  );
}
