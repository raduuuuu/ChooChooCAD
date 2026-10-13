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

import type { ReactNode } from 'react';
import type { TrustIssue } from '../../engine/src/joints/trust.js';
import type { VerdictKind, VerdictView } from './verdictView.js';
import { ACTION_FOR_FAILURE, ACTION_FOR_VERDICT } from './verdictAction.js';

/*
 * Keyed by the kind, not by string: a new one is a compile error here rather
 * than a silent fall-through to generic copy. Verified by deleting a key,
 * which fails with TS2741.
 */
type FailureKind = Extract<
  VerdictKind,
  'NO_CYCLE' | 'HEADING_MISMATCH' | 'TOO_MANY_LOOPS' | 'NUMERIC'
>;
const FAILURE_COPY: Record<FailureKind, string> = {
  NO_CYCLE: 'Not a loop yet.',
  HEADING_MISMATCH: 'The track does not come back pointing the right way.',
  TOO_MANY_LOOPS: 'Too many loops in this layout to rank them.',
  NUMERIC: 'Could not check this layout.',
};
const isFailure = (k: VerdictKind): k is FailureKind =>
  k === 'NO_CYCLE' || k === 'HEADING_MISMATCH' || k === 'TOO_MANY_LOOPS' || k === 'NUMERIC';

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

/**
 * THE LIVE REGION (task W1, decision D3).
 *
 * Every branch below renders through this one wrapper, so a new verdict state
 * cannot ship unannounced: there is no second place to forget. The element is
 * the same `div.verdict` it always was, carrying the same classes, because at
 * 1000px and up `.verdict` is a grid child of `.shell` (app.css:930) and an
 * extra wrapper would have taken its placement.
 *
 * `role="status"` already implies polite, and both are written anyway: the
 * implication is exactly what a future edit drops without noticing.
 *
 * `aria-atomic` is TRUE on purpose. A verdict is only true whole. "Needs 12mm
 * absorbed across 8 joints, which give 16mm between them" read in fragments is
 * worse than silence, because every fragment is a number without its referent.
 * Polite plus atomic also means eight fast placements collapse into one
 * announcement of the final state rather than eight interruptions, which is the
 * behaviour D3 chose over announcing each graph mutation.
 *
 * gstack-shortcut(dec-cc66dbf5): the result is audible, the editor is not
 * operable, upgrade when U7 lands and the announcement policy has to cover
 * piece, end and weld actions.
 */
function Verdict({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div
      className={`verdict verdict-${tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </div>
  );
}

/*
 * The glyph is hidden from assistive tech. It exists so the four verdicts stay
 * distinguishable on paper, where they flatten into one greyscale band; read
 * aloud, "slash backslash" is noise in front of a sentence that already states
 * the verdict in words.
 */
function Mark({ glyph }: { glyph: string }) {
  return (
    <span className="verdict-mark" aria-hidden="true">
      {glyph}
    </span>
  );
}

export function VerdictLine({
  view,
  trust = [],
}: {
  view: VerdictView;
  /** Why this verdict is worth less than it looks. See engine/joints/trust.ts. */
  trust?: readonly TrustIssue[];
}) {
  const e = view;

  if (e.kind === 'NOTHING') {
    return (
      <Verdict tone="unknown">
        <Mark glyph="?" />
        <span className="verdict-text">Nothing to check yet.</span>
      </Verdict>
    );
  }

  // Every failure is GREY. Never green, never styled as a near-pass.
  if (isFailure(e.kind)) {
    return (
      <Verdict tone="unknown">
        <Mark glyph="?" />
        <span className="verdict-text">
          {FAILURE_COPY[e.kind]}{' '}
          <span className="verdict-detail">{e.detail}</span>
        </span>
        <Action action={ACTION_FOR_FAILURE[e.kind] ?? null} />
      </Verdict>
    );
  }

  /*
   * HOW MANY LOOPS FAILED, said only when there is more than one.
   *
   * A layout can now hold several independent loops, and give is never
   * pooled between them, so "the gap" is one loop's gap and not the
   * layout's. Saying "1 of 3 loops" keeps the number honest about what it
   * describes. On a single-loop layout the phrase would be noise, so it is
   * omitted rather than padded to a constant shape.
   */
  const loopNote =
    e.rank > 1 ? (
      <span className="verdict-detail">
        {' '}
        <span className="num">{e.failingLoops}</span> of{' '}
        <span className="num">{e.rank}</span> loops.
      </span>
    ) : null;

  // The trust register rides with EVERY verdict, including EXACT. An exact
  // closure over unmeasured sizes is the case that most needs saying.
  switch (e.kind) {
    // Before EXACT, matching the engine. A double circle closes perfectly.
    // Two causes, and they need different sentences: an unjoinable END is about
    // the pieces themselves, a shared POSITION is about where they ended up.
    case 'IMPOSSIBLE':
      return (
        <Verdict tone="fail">
          <Mark glyph="X" />
          {e.polarityCount > 0 ? (
            <span className="verdict-text">
              Can&rsquo;t be built. <span className="num">{e.polarityCount}</span>{' '}
              {e.polarityCount === 1 ? 'joint puts' : 'joints put'} two ends of
              the same kind together, and those do not fit.
            </span>
          ) : (
            <span className="verdict-text">
              Can&rsquo;t be built. <span className="num">{e.clashCount}</span>{' '}
              {e.clashCount === 1 ? 'pair of track ends lands' : 'pairs of track ends land'}{' '}
              in exactly the same spot, so two pieces would have to share it.
              {/*
                * Only when there IS a loop. `viewOf` reports a gap of 0 on the
                * failure branch, so keying this on gapMm alone printed "the
                * loop does close" over a layout with no loop at all, which a
                * user read in a bug report.
                */}
              {e.rank > 0 && e.gapMm === 0 && ' The loop does close; that does not help.'}
              <span className="verdict-detail">
                {' '}Only exact overlaps like this are checked. Pieces crossing mid-span are not.
              </span>
            </span>
          )}
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT.IMPOSSIBLE} />
        </Verdict>
      );

    case 'EXACT':
      return (
        <Verdict tone="pass">
          <Mark glyph="O" />
          <span className="verdict-text">This works. Closes exactly, no give needed at any joint.</span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT[e.kind]} />
        </Verdict>
      );

    case 'NEEDS_GIVE':
      return (
        <Verdict tone="tight">
          <Mark glyph={'/\\'} />
          <span className="verdict-text">
            Needs <span className="num">{e.gapMm.toFixed(0)}mm</span> absorbed across{' '}
            <span className="num">{e.jointCount}</span> joints, which give{' '}
            <span className="num">{e.giveMm.toFixed(0)}mm</span> between them. That
            means the gap could fit inside the total give, not that it will.
          </span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT[e.kind]} />
        </Verdict>
      );

    case 'EXCEEDS':
      return (
        <Verdict tone="fail">
          <Mark glyph="X" />
          <span className="verdict-text">
            Won&rsquo;t fit. Needs <span className="num">{e.gapMm.toFixed(0)}mm</span>{' '}
            absorbed, but the joints give only{' '}
            <span className="num">{e.giveMm.toFixed(0)}mm</span> in total.{loopNote}
          </span>
          <Trust trust={trust} />
          <Action action={ACTION_FOR_VERDICT[e.kind]} />
        </Verdict>
      );

  }
}
