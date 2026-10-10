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
import type { SolveFailure, SolveResult } from '../../engine/src/solver/result.js';
import type { TrustIssue } from '../../engine/src/joints/trust.js';
import { ACTION_FOR_FAILURE, ACTION_FOR_VERDICT } from './verdictAction.js';

// Keyed by SolveFailure, not by string: a new failure reason is then a compile
// error here rather than a silent fall-through to the generic copy below.
const FAILURE_COPY: Record<SolveFailure, string> = {
  NO_CYCLE: 'Not a loop yet.',
  HEADING_MISMATCH: 'The track does not come back pointing the right way.',
  NUMERIC: 'Could not check this layout.',
};

/**
 * The trust register.
 *
 * Replaces the old Hedge, which said one fixed sentence about estimated give.
 * The library made that insufficient: a layout can now also contain sizes
 * nobody measured, sizes resting on one person's word, and brands that do not
 * physically join. Each is a different reason to discount the same verdict, so
 * each gets its own line rather than being averaged into a disclaimer.
 */
function Trust({ trust }: { trust: readonly TrustIssue[] }) {
  if (trust.length === 0) return null;
  const serious = trust.some(
    (t) => t.kind === 'unverified-size' || t.kind === 'brands-do-not-join',
  );
  return (
    <ul className={serious ? 'verdict-trust is-serious' : 'verdict-trust'}>
      {trust.map((t) => (
        <li key={t.kind + t.detail}>{t.detail}</li>
      ))}
    </ul>
  );
}

/**
 * The action register. One imperative, visually quietest of the three, because
 * it is the last thing read rather than the first. Never rendered empty: a
 * state with nothing to suggest returns null instead of an empty box.
 */
function Action({ action }: { action: string | null }) {
  if (!action) return null;
  return <p className="verdict-action">{action}</p>;
}

export function VerdictLine({
  result,
  trust = [],
}: {
  result: SolveResult | null;
  /** Why this verdict is worth less than it looks. See engine/joints/trust.ts. */
  trust?: readonly TrustIssue[];
}) {
  if (!result) {
    return (
      <div className="verdict verdict-unknown">
        <span className="verdict-mark">?</span>
        <span className="verdict-text">Nothing to check yet.</span>
      </div>
    );
  }

  // Every non-ok result is GREY. Never green, never styled as a near-pass.
  if (!result.ok) {
    return (
      <div className="verdict verdict-unknown">
        <span className="verdict-mark">?</span>
        <span className="verdict-text">
          {FAILURE_COPY[result.reason] ?? 'Could not check this layout.'}{' '}
          <span className="verdict-detail">{result.detail}</span>
        </span>
        <Action action={ACTION_FOR_FAILURE[result.reason] ?? null} />
      </div>
    );
  }

  const e = evaluateLayout(result, 'estimated');

  // The trust register rides with EVERY verdict, including EXACT. An exact
  // closure over unmeasured sizes is the case that most needs saying.
  switch (e.verdict) {
    // Before EXACT, matching the engine. A double circle closes perfectly.
    // Two causes, and they need different sentences: an unjoinable END is about
    // the pieces themselves, a shared POSITION is about where they ended up.
    case 'IMPOSSIBLE':
      return (
        <div className="verdict verdict-fail">
          <span className="verdict-mark">X</span>
          {e.polarityViolations.length > 0 ? (
            <span className="verdict-text">
              Can&rsquo;t be built. <span className="num">{e.polarityViolations.length}</span>{' '}
              {e.polarityViolations.length === 1 ? 'joint puts' : 'joints put'} two ends of
              the same kind together, and those do not fit.
            </span>
          ) : (
            <span className="verdict-text">
              Can&rsquo;t be built. <span className="num">{e.clashes.length}</span>{' '}
              {e.clashes.length === 1 ? 'pair of track ends lands' : 'pairs of track ends land'}{' '}
              in exactly the same spot, so two pieces would have to share it.
              {e.gapMm === 0 && ' The loop does close; that does not help.'}
              <span className="verdict-detail">
                {' '}Only exact overlaps like this are checked. Pieces crossing mid-span are not.
              </span>
            </span>
          )}
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT.IMPOSSIBLE} />
        </div>
      );

    case 'EXACT':
      return (
        <div className="verdict verdict-pass">
          <span className="verdict-mark">O</span>
          <span className="verdict-text">This works. Closes exactly, no give needed at any joint.</span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT[e.verdict]} />
        </div>
      );

    case 'NEEDS_GIVE':
      return (
        <div className="verdict verdict-tight">
          <span className="verdict-mark">/\</span>
          <span className="verdict-text">
            Needs <span className="num">{e.gapMm.toFixed(0)}mm</span> absorbed across{' '}
            <span className="num">{e.jointCount}</span> joints, which give{' '}
            <span className="num">{e.totalGiveMm.toFixed(0)}mm</span> between them. That
            means the gap could fit inside the total give, not that it will.
          </span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT[e.verdict]} />
        </div>
      );

    case 'EXCEEDS':
      return (
        <div className="verdict verdict-fail">
          <span className="verdict-mark">X</span>
          <span className="verdict-text">
            Won&rsquo;t fit. Needs <span className="num">{e.gapMm.toFixed(0)}mm</span>{' '}
            absorbed, but the joints give only{' '}
            <span className="num">{e.totalGiveMm.toFixed(0)}mm</span> in total.
          </span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT[e.verdict]} />
        </div>
      );

    case 'UNKNOWN':
      return (
        <div className="verdict verdict-unknown">
          <span className="verdict-mark">?</span>
          <span className="verdict-text">
            Could not check this layout.{' '}
            <span className="verdict-detail">{e.reasons.join('; ')}</span>
          </span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT.UNKNOWN} />
        </div>
      );
  }
}
