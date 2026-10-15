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
import type { VerdictView } from './verdictView.js';
import {
  ACTION_FOR_FAILURE,
  ACTION_FOR_VERDICT,
  FAILURE_COPY,
  isFailure,
} from './verdictAction.js';

/*
 * The copy table and the predicate moved to `verdictAction.ts`, which is a
 * `.ts` module and therefore testable: this file is `.tsx` and the suite
 * collects `.test.ts` only, in a node environment with no DOM.
 */

/**
 * The trust register.
 *
 * Replaces the old Hedge, which said one fixed sentence about estimated give.
 * The library made that insufficient: a layout can now also contain sizes
 * nobody measured, sizes resting on one person's word, and brands that do not
 * physically join. Each is a different reason to discount the same verdict, so
 * each gets its own line rather than being averaged into a disclaimer.
 */
const isSerious = (t: TrustIssue) =>
  t.kind === 'unverified-size' || t.kind === 'brands-do-not-join';

/** At most this many disclosures are shown; the rest become a count (E7). */
const TRUST_INLINE_LIMIT = 2;

function Trust({ trust }: { trust: readonly TrustIssue[] }) {
  if (trust.length === 0) return null;

  /*
   * SERIOUS FIRST, then the rest, then a count (Y1 decision 4).
   *
   * With five trust kinds present the block was five lines of equal weight
   * above the action, and task T3b adds a fifth kind. Ordering by seriousness
   * means the two that make the verdict actively misleading are the two that
   * survive truncation.
   */
  const ordered = [...trust].sort(
    (a, b) => Number(isSerious(b)) - Number(isSerious(a)),
  );
  const shown = ordered.slice(0, TRUST_INLINE_LIMIT);
  const hidden = ordered.length - shown.length;

  return (
    <>
      {/*
        * SERIOUS IS PER ITEM, not per list, and the first version got that
        * wrong. The flag was computed with `shown.some(isSerious)` and consumed
        * by `.verdict-trust.is-serious li::before`, which repaints EVERY
        * marker. Since the sort puts serious kinds first and the limit is two,
        * the ordinary multi-brand case shows [unverified-size, estimated-give]
        * and the benign standing "give is estimated" note got a red
        * exclamation claiming the verdict is actively misleading. That is the
        * colour-plus-glyph channel over-claiming, against DESIGN.md rule 3.
        */}
      <ul className="verdict-trust">
        {shown.map((t) => (
          <li key={t.kind + t.detail} className={isSerious(t) ? 'is-serious' : undefined}>
            {t.detail}
          </li>
        ))}
      </ul>
      {/*
        * NON-INTERACTIVE TRUNCATION, not a "+N more" toggle (finding E7).
        *
        * A toggle implies state, activation and focus, and the harness task
        * X2b builds renders static markup and dispatches nothing, so the
        * expansion could never be asserted. That is the same error the T3
        * split and the U7a/U7b split each caught once already. A plain
        * sentence is assertable and needs no DOM. The full list is reachable
        * through U7a's graph listing.
        */}
      {hidden > 0 && (
        <p className="verdict-more">
          and <span className="num">{hidden}</span> more{' '}
          {hidden === 1 ? 'note' : 'notes'} about this layout.
        </p>
      )}
    </>
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
 * 1000px and up `.verdict` is a grid child of `.shell` (see the
 * `@media (min-width: 1000px)` block in app.css) and an extra wrapper would
 * have taken its placement. Cited by selector, not by line: a line number in a
 * cross-file comment goes stale on every edit above it, and this one already
 * did.
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
 * AND BECAUSE IT IS ATOMIC, IT HOLDS THE SENTENCE AND NOTHING ELSE (task X2a,
 * Y1 decision 2). Task W1 put `aria-atomic="true"` here and left `<Trust>` and
 * `<Action>` rendering inside it, so atomic did exactly what it says: a user
 * placing a piece heard the verdict plus every trust line, every time. Task
 * T3b adds a fifth trust kind. Those two facts together land on precisely the
 * user this a11y work exists for.
 *
 * The notes are now a SIBLING element, pointed at by `aria-describedby`, so
 * they are reachable on demand and never re-read on an edit. The id is a
 * constant rather than generated: there is exactly one verdict line on the
 * page, and `useId` would make the rendered markup unstable for X2b's
 * assertions without buying anything.
 *
 * gstack-shortcut(dec-cc66dbf5): the result is audible, the editor is not
 * operable, upgrade when U7 lands and the announcement policy has to cover
 * piece, end and weld actions.
 */
const NOTES_ID = 'verdict-notes';

/**
 * The notes node, or `undefined` when there would be nothing in it.
 *
 * `Boolean(notes)` on a ReactNode is not the same question: a fragment whose
 * children all render null is still truthy, which would leave
 * `aria-describedby` pointing at an empty element. That is worse than omitting
 * it, because a screen reader announces a description that is not there.
 *
 * Deciding it from the DATA rather than the node keeps the invariant checkable:
 * every non-empty verdict currently has an action (`verdictAction.ts` has no
 * null outside `ACTION_WHEN_EMPTY`), but relying on that silently is how the
 * live region ended up holding the trust list in the first place.
 */
function notesFor(trust: readonly TrustIssue[], action: string | null) {
  if (trust.length === 0 && !action) return undefined;
  return (
    <>
      <Trust trust={trust} />
      <Action action={action} />
    </>
  );
}

function Verdict({
  tone,
  notes,
  children,
}: {
  tone: string;
  /** Trust and action. Rendered OUTSIDE the live region, by contract. */
  notes?: ReactNode;
  children: ReactNode;
}) {
  const hasNotes = Boolean(notes);
  return (
    <>
      <div
        className={`verdict verdict-${tone}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-describedby={hasNotes ? NOTES_ID : undefined}
      >
        {children}
      </div>
      {hasNotes && (
        <div id={NOTES_ID} className="verdict-notes">
          {notes}
        </div>
      )}
    </>
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

  /*
   * EMPTY IS ITS OWN STATE (task X2a, Y1 decision 1, gate d5 = b).
   *
   * It used to render `verdict-unknown` with a `?` mark, identical to the
   * FailureKinds: "I have not started" and "the solver looked and this is
   * broken" were the same grey with the same glyph.
   *
   * NO MARK, because every glyph on this line means a verdict was reached.
   * NO ACTION LINE, and no instruction, because the gate kept design D10:
   * `verdictAction.ts` records that the empty state already carries the one
   * primary action on the CANVAS, and a second invitation here is exactly what
   * D10 removed. `ACTION_WHEN_EMPTY` stays null and is not rendered.
   *
   * What remains is a statement of fact, which is not an invitation.
   */
  if (e.kind === 'NOTHING') {
    return (
      <Verdict tone="empty">
        <span className="verdict-text">Nothing to check yet.</span>
      </Verdict>
    );
  }

  // Every failure is GREY. Never green, never styled as a near-pass.
  if (isFailure(e.kind)) {
    return (
      <Verdict
        tone="unknown"
        notes={notesFor([], ACTION_FOR_FAILURE[e.kind] ?? null)}
      >
        <Mark glyph="?" />
        <span className="verdict-text">
          {FAILURE_COPY[e.kind]}{' '}
          <span className="verdict-detail">{e.detail}</span>
        </span>
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
        <Verdict
          tone="fail"
          notes={notesFor(trust, ACTION_FOR_VERDICT.IMPOSSIBLE)}
        >
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
              {/*
                * `gapKnown` as well as rank, because `gapMm` is a FILLER zero
                * on every refusal. Keyed on rank and gap alone, this printed
                * "the loop does close" over a TOO_MANY_LOOPS, a
                * TOO_BIG_TO_CHECK, a NUMERIC and even a HEADING_MISMATCH --
                * where the engine had just determined the track does NOT come
                * back aligned. Measured through `viewOf` at rank 7 with one
                * clash: every one of them rendered the sentence.
                */}
              {e.rank > 0 && e.gapKnown && e.gapMm === 0 &&
                ' The loop does close; that does not help.'}
              <span className="verdict-detail">
                {' '}Only exact overlaps like this are checked. Pieces crossing mid-span are not.
              </span>
            </span>
          )}
        </Verdict>
      );

    case 'EXACT':
      return (
        <Verdict
          tone="pass"
          notes={notesFor(trust, ACTION_FOR_VERDICT[e.kind])}
        >
          <Mark glyph="O" />
          <span className="verdict-text">This works. Closes exactly, no give needed at any joint.</span>
        </Verdict>
      );

    case 'NEEDS_GIVE':
      return (
        <Verdict
          tone="tight"
          notes={notesFor(trust, ACTION_FOR_VERDICT[e.kind])}
        >
          <Mark glyph={'/\\'} />
          <span className="verdict-text">
            {/*
              * "Tight." leads, so severity survives the loss of colour.
              *
              * The mark is aria-hidden and `verdict-tight` against
              * `verdict-fail` may be a hue-only distinction for low colour
              * discrimination, which is WCAG 1.4.1. Every other kind already
              * states its severity in words ("This works", "Won't fit",
              * "Can't be built", "Could not check"); this one opened with a
              * measurement and left the reader to infer it.
              */}
            Tight. Needs <span className="num">{e.gapMm.toFixed(0)}mm</span> absorbed across{' '}
            <span className="num">{e.jointCount}</span> joints, which give{' '}
            <span className="num">{e.giveMm.toFixed(0)}mm</span> between them. That
            means the gap could fit inside the total give, not that it will.
          </span>
        </Verdict>
      );

    case 'EXCEEDS':
      return (
        <Verdict
          tone="fail"
          notes={notesFor(trust, ACTION_FOR_VERDICT[e.kind])}
        >
          <Mark glyph="X" />
          <span className="verdict-text">
            Won&rsquo;t fit. Needs <span className="num">{e.gapMm.toFixed(0)}mm</span>{' '}
            absorbed, but the joints give only{' '}
            <span className="num">{e.giveMm.toFixed(0)}mm</span> in total.{loopNote}
          </span>
        </Verdict>
      );

  }
}
