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

import { Children, cloneElement, createContext, isValidElement, useContext, type ReactNode } from 'react';
import type { TrustIssue } from '../../engine/src/joints/trust.js';
import type { VerdictView } from './verdictView.js';
import type { BendWords } from '../../engine/src/joints/bendWords.js';
import { CLEARANCE } from '../../engine/data/rampSeeds.js';
import {
  ACTION_FOR_FAILURE,
  ACTION_FOR_VERDICT,
  ACTION_WHEN_CROSSING,
  ACTION_WHEN_LEVEL_MISMATCH,
  ACTION_WHEN_RAISED,
  ACTION_WHEN_THIRD_LEVEL,
  actionWhenOpenRuns,
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
  t.kind === 'unverified-size' ||
  t.kind === 'brands-do-not-join' ||
  // T3b's ruling, closed rather than conditional: a modelled switch is
  // strictly less grounded than an unverified published figure.
  t.kind === 'modelled-switch';

/** At most this many disclosures are shown; the rest become a count (E7). */
const TRUST_INLINE_LIMIT = 2;

function Trust({ trust }: { trust: readonly TrustIssue[] }) {
  if (trust.length === 0) return null;

  /*
   * SERIOUS FIRST, then the rest, then a count (Y1 decision 4).
   *
   * With five trust kinds present the block was five lines of equal weight
   * above the action. Ordering by seriousness means the two that make the
   * verdict actively misleading are the two that survive truncation.
   *
   * COUNT CORRECTED 2026-10-19. This read "task T3b adds a fifth kind", which
   * was true when `TrustIssue` carried four. The axial-only kind took the
   * fifth slot, so T3b's switch disclosure is the SIXTH. The ordinal is not
   * load-bearing for any behaviour here, which is exactly why it went stale
   * unnoticed: nothing reads it and no test could catch it. Stated as a count
   * rather than an ordinal below so the next addition does not repeat this.
   *
   * `TrustIssue` kinds today: `unverified-size`, `single-source`,
   * `brands-do-not-join`, `estimated-give`, `axial-only-give`,
   * `modelled-switch`. Three of them are serious, and `TRUST_INLINE_LIMIT` is
   * 2, so on a layout that trips two serious kinds nothing else is shown --
   * and every layout with a seed switch trips two, because the seeds are also
   * `unverified`. The give qualification no longer
   * depends on being shown: `verdictLine.test.ts` pins that the EXCEEDS
   * headline carries it even when this list is truncated to the two serious
   * lines.
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
 * The shortcut recorded here as dec-cc66dbf5 ("the result is audible, the
 * editor is not operable") was retired by U7b on 2026-10-22: the graph
 * listing is operable from the keyboard, and every piece, end and joint
 * action is announced in its own region (`announce.ts`, the `sr-only` status
 * in App.tsx), separate from this one.
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
function notesFor(
  trust: readonly TrustIssue[],
  action: string | null,
  basis = false,
  adapters = 0,
  unmarked = 0,
  raised: { readonly bridges: number } | null = null,
  bend: BendWords | null = null,
) {
  if (trust.length === 0 && !action && adapters === 0 && !raised && !bend) return undefined;
  return (
    <>
      {bend && <BendNotes words={bend} />}
      {basis && <Basis />}
      {adapters > 0 && <AdapterNote n={adapters} unmarked={unmarked} />}
      {raised && <RaisedNote bridges={raised.bridges} />}
      <Trust trust={trust} />
      <Action action={action} />
    </>
  );
}

/**
 * THE BEND HEADLINE, from the engine's parts (eng review D7). Joined, the
 * parts are exactly `BendWords.line`; numbers go in the number face (DESIGN.md
 * rule 4). The turned clause and the run count follow in the same live line
 * (design 2A, 9A, 3A).
 */
function BendLine({ words }: { words: BendWords | null }) {
  if (!words) return null;
  return (
    <>
      {words.segments.map((x, i) => (typeof x === 'string' ? x : <span key={i} className="num">{x.num}</span>))}
      {words.turned && <> {words.turned}</>}
      {words.runs && <> {words.runs}</>}
    </>
  );
}

/**
 * WHERE THE LIMITS COME FROM, first in the notes and outside the trust cap
 * (design 2A, 5A): BRIO's limit with its provenance, then each other brand's
 * estimate by part id, then the overlap note for a run that needs bend
 * (11A), which says the drawing is unbent whether or not anything overlaps.
 */
function BendNotes({ words }: { words: BendWords }) {
  if (words.limits.length === 0 && !words.overlapNote) return null;
  return (
    <>
      {words.limits.map((l) => (
        <p key={l.who} className="verdict-limits">
          {l.text}
        </p>
      ))}
      {words.overlapNote && <p className="verdict-limits">{words.overlapNote}</p>}
    </>
  );
}

/**
 * THE ADAPTER NOTE (socket adapter plan, R3). Two sockets meeting is
 * buildable with a male-male adapter, so the verdict keeps whatever kind it
 * would have and this line says what to have ready. On every verdict with a
 * layout, failures included: an adapter joint is a fact about the track
 * whatever else is wrong with it.
 */
/**
 * The note as markup (design review DR9, DR11, DR1): the counts in the number
 * face, led by the ◇ that keys the canvas mark (aria-hidden: the words say it),
 * and, when a red mark holds some adapter spots, how many are not drawn.
 */
function AdapterNote({ n, unmarked }: { n: number; unmarked: number }) {
  return (
    <p className="verdict-adapters">
      <span className="adapter-glyph" aria-hidden="true">◇</span> Needs <span className="num">{n}</span> male-male{' '}
      {n === 1 ? 'adapter' : 'adapters'}: two sockets meet at <span className="num">{n}</span>{' '}
      {n === 1 ? 'joint' : 'joints'}.
      {unmarked > 0 && (
        <>
          {' '}
          <span className="num">{unmarked}</span> {unmarked === 1 ? 'is' : 'are'} not marked, because{' '}
          {unmarked === 1 ? 'a clash is' : 'clashes are'} drawn there.
        </>
      )}
    </p>
  );
}

/**
 * THE RAISED-TRACK NOTE (two-layer plan, L3 and design decision 3A). Never
 * truncated, like the adapter note: it is a green verdict's only word on what
 * was NOT checked, and folding it into "and 1 more note" would claim more
 * than was checked (DESIGN.md rule 3). Supports whenever any track is
 * raised; the clearance figure, with the numbers it is made of, only where
 * raised track crosses floor track. Only the train's height is called an
 * estimate, and only until it is measured: the rise and the plank are
 * published (rampSeeds.ts `CLEARANCE`).
 * Every number in the number face (rule 4).
 */
function RaisedNote({ bridges }: { bridges: number }) {
  const { riseMm, plankMm, trainMm, trainMeasured } = CLEARANCE;
  return (
    <p className="verdict-raised">
      Raised track: supports are not checked.
      {bridges > 0 && (
        <>
          {' '}It crosses other track at <span className="num">{bridges}</span> {bridges === 1 ? 'place' : 'places'};
          clearance is about <span className="num">{riseMm - plankMm - trainMm}</span>mm (
          <span className="num">{riseMm}</span>mm rise, <span className="num">{plankMm}</span>mm plank,{' '}
          <span className="num">{trainMm}</span>mm train){trainMeasured ? '.' : <>; the train&rsquo;s height is an estimate.</>}
        </>
      )}
    </p>
  );
}

/**
 * IMPOSSIBLE's action, matched to the one cause the sentence names. The
 * sentence shows, in order, refused ends, then piled-up ends, then crossing
 * planks, then the two level faults; the action follows the same order.
 */
function impossibleAction(e: VerdictView): string {
  if (e.polarityCount > 0 || e.clashCount > 0) return ACTION_FOR_VERDICT.IMPOSSIBLE;
  if (e.overlapCount > 0) return ACTION_WHEN_CROSSING;
  if (e.levelMismatchCount > 0) return ACTION_WHEN_LEVEL_MISMATCH;
  if (e.thirdLevelCount > 0) return ACTION_WHEN_THIRD_LEVEL;
  return ACTION_FOR_VERDICT.IMPOSSIBLE;
}

/** "N is not marked, because a clash is drawn there", the adapter note's clause (DR1). */
function Unmarked({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <>
      {' '}
      <span className="num">{n}</span> {n === 1 ? 'is' : 'are'} not marked, because {n === 1 ? 'a clash is' : 'clashes are'}{' '}
      drawn there.
    </>
  );
}

/** The facts the raised-track note needs, or null when nothing is off the floor. */
const raisedOf = (e: VerdictView) => (e.raised ? { bridges: e.bridgeCount } : null);

export function adapterNote(n: number): string {
  return n === 1
    ? 'Needs 1 male-male adapter: two sockets meet at 1 joint.'
    : `Needs ${n} male-male adapters: two sockets meet at ${n} joints.`;
}

/**
 * WHAT THE VERDICT RESTS ON, stated once (task T3b).
 *
 * Every disclosure below it lowers confidence. This clause says what the
 * answer IS grounded in: the closure arithmetic is exact against the
 * catalogue's figures. It used to add "joint give estimated/measured"; that
 * compared a give TOTAL that is gone, and on a verdict that needs bend the
 * limits note now says where each joint's figure comes from (design 5A, 8A).
 * So this stays on the exact verdict only, where no give is needed.
 */
function Basis() {
  return <p className="verdict-basis">Exact to the catalogue.</p>;
}

/**
 * WHAT THE VERDICT IS ABOUT, when that is not obvious (decision 3A of the
 * 2026-10-22 editing plan). While a piece is being placed the verdict still
 * judges only the track already placed, and a green line beside a red preview
 * would read as a contradiction; the prefix "Placed track:" says which is
 * which. Provided by App; empty means no prefix.
 */
export const VerdictScope = createContext<string | null>(null);

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
  const scope = useContext(VerdictScope);
  /*
   * The scope goes INSIDE the sentence's own span, at its start, so it flows
   * as part of the sentence: "O Placed track: This works." As a sibling it
   * became its own cell of the verdict's grid and sat under the glyph (seen
   * in a browser, 2026-10-22).
   */
  let inserted = false;
  const parts = Children.toArray(children).map((child) => {
    if (inserted || !scope || !isValidElement<{ className?: string; children?: ReactNode }>(child)) return child;
    if (child.props.className !== 'verdict-text') return child;
    inserted = true;
    return cloneElement(
      child,
      {},
      <span className="verdict-scope" key="scope">
        {scope}{' '}
      </span>,
      ...Children.toArray(child.props.children),
    );
  });
  return (
    <>
      <div
        className={`verdict verdict-${tone}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-describedby={hasNotes ? NOTES_ID : undefined}
      >
        {parts}
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

/*
 * SEVERAL RUNS OF TRACK (TODO "Multiple independent components"). A layout can
 * hold runs that share no joint. Beside a loop's verdict, say how many other
 * runs are still open, so "This works" is never read as the whole layout, and
 * when several runs hold loops, name the one a figure is about by its lowest
 * piece number, as the layout list numbers them.
 */
function OpenRuns({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <>
      {' '}
      <span className="num">{n}</span> other {n === 1 ? 'run of track is' : 'runs of track are'} not a loop yet.
    </>
  );
}

function LoopAt({ at }: { at: number | null }) {
  if (at === null) return null;
  return (
    <>
      {' '}In the loop through piece <span className="num">{at}</span>.
    </>
  );
}

export function VerdictLine({
  view,
  trust = [],
  adaptersUnmarked = 0,
  levelUnmarked = 0,
  polarityUnmarked = 0,
}: {
  view: VerdictView;
  /** Why this verdict is worth less than it looks. See engine/joints/trust.ts. */
  trust?: readonly TrustIssue[];
  /** Adapter joints the canvas does not mark because a red mark holds the spot (DR1). */
  adaptersUnmarked?: number;
  /** Level faults the canvas does not mark because a clash holds the spot (eng re-run D4). */
  levelUnmarked?: number;
  /** Refused joints the canvas does not mark because a clash holds every end of them (`badJointMarks`). */
  polarityUnmarked?: number;
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
        notes={notesFor([], ACTION_FOR_FAILURE[e.kind] ?? null, false, e.adapterCount, adaptersUnmarked, raisedOf(e))}
      >
        <Mark glyph="?" />
        <span className="verdict-text">
          {FAILURE_COPY[e.kind]}{' '}
          <span className="verdict-detail">{e.detail}</span>
        </span>
      </Verdict>
    );
  }

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
          notes={notesFor(
            trust,
            impossibleAction(e),
            false,
            e.adapterCount,
            adaptersUnmarked,
            raisedOf(e),
            // A run that needs bend carries the overlap note (design 11A).
            e.bend && e.bend.tier !== 'exact' ? e.bend : null,
          )}
        >
          <Mark glyph="X" />
          {e.polarityCount > 0 ? (
            <span className="verdict-text">
              Can&rsquo;t be built. <span className="num">{e.polarityCount}</span>{' '}
              {e.polarityCount === 1 ? 'joint puts' : 'joints put'} two ends of
              the same kind together, and those do not fit.
              <Unmarked n={polarityUnmarked} />
              {/*
                * The clashes and crossings too, when there are both: the
                * canvas draws every kind of red mark, and the words used to
                * account for one (brio-TODOS.md P2, the polarity marker's
                * limit 2).
                */}
              {e.clashCount > 0 && (
                <>
                  {' '}And <span className="num">{e.clashCount}</span>{' '}
                  {e.clashCount === 1
                    ? 'spot has two or more track ends on top of each other.'
                    : 'spots have two or more track ends on top of each other.'}
                </>
              )}
              {e.overlapCount > 0 && (
                <>
                  {' '}And <span className="num">{e.overlapCount}</span>{' '}
                  {e.overlapCount === 1 ? 'place has track running over other track.' : 'places have track running over other track.'}
                </>
              )}
            </span>
          ) : e.clashCount === 0 && e.overlapCount > 0 ? (
            <span className="verdict-text">
              {/*
                * Planks crossing mid-span (overlap.ts). One record per PAIR
                * of pieces, which is also what the canvas marks. Flat track
                * only crosses on a crossing piece or a bridge.
                */}
              {/*
                * Design 11A: overlaps are found on the DRAWN shape, which is
                * unbent. When the run needs bend the built track sits up to a
                * few mm from the drawing, so the headline says where the
                * overlap was found instead of "can't be built"; the notes give
                * the distance. Exact runs keep the plain claim.
                */}
              {e.bend && e.bend.tier !== 'exact' ? 'Track overlaps in the drawn shape.' : <>Can&rsquo;t be built.</>}{' '}
              <span className="num">{e.overlapCount}</span>{' '}
              {e.overlapCount === 1
                ? 'place has track running over other track. Track can only cross on a crossing piece, or raised on ramps over the other track.'
                : 'places have track running over other track. Track can only cross on a crossing piece, or raised on ramps over the other track.'}
            </span>
          ) : e.clashCount === 0 && e.levelMismatchCount > 0 ? (
            <span className="verdict-text">
              {/* Design decision 8A; the unmarked clause is eng re-run D4. */}
              Can&rsquo;t be built. <span className="num">{e.levelMismatchCount}</span>{' '}
              {e.levelMismatchCount === 1 ? 'joint joins' : 'joints join'} track at two different levels: the loop
              climbs and never comes back down.
              <Unmarked n={levelUnmarked} />
            </span>
          ) : e.clashCount === 0 && e.thirdLevelCount > 0 ? (
            <span className="verdict-text">
              Can&rsquo;t be built. <span className="num">{e.thirdLevelCount}</span>{' '}
              {e.thirdLevelCount === 1 ? 'ramp' : 'ramps'} would lift track to a third level. Only two levels are
              supported.
              <Unmarked n={levelUnmarked} />
            </span>
          ) : (
            <span className="verdict-text">
              {/*
                * SPOTS, because that is what is counted. `findVertexClashes`
                * reports one record per PLACE where ends land together, which
                * is also what `clashMarkers` draws, so the number and the
                * picture agree. It used to count pairs of joined-up ends,
                * which matched the dots only when each spot held exactly two
                * of them; `graph/feasible.ts` records how the count got
                * from ports to pairs to places, with the fixtures and
                * the figures.
                */}
              Can&rsquo;t be built. <span className="num">{e.clashCount}</span>{' '}
              {e.clashCount === 1
                ? 'spot has two or more track ends on top of each other, so pieces would have to share it.'
                : 'spots have two or more track ends on top of each other, so pieces would have to share them.'}
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
              {e.rank > 0 &&
                e.gapKnown &&
                e.gapMm === 0 &&
                (e.rank === 1
                  ? ' The loop does close; that does not help.'
                  : ' The loops do close; that does not help.')}
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
          notes={notesFor(
            trust,
            e.openRuns > 0 ? actionWhenOpenRuns(e.openRuns) : e.raised ? ACTION_WHEN_RAISED : ACTION_FOR_VERDICT.EXACT,
            true,
            e.adapterCount,
            adaptersUnmarked,
            raisedOf(e),
          )}
        >
          <Mark glyph="O" />
          <span className="verdict-text">
            This works.{' '}
            {e.loopRuns > 2 ? (
              <>
                All <span className="num">{e.loopRuns}</span> loops close
              </>
            ) : e.loopRuns === 2 ? (
              'Both loops close'
            ) : (
              'Closes'
            )}{' '}
            exactly, no give needed at any joint.
            <OpenRuns n={e.openRuns} />
          </span>
        </Verdict>
      );

    case 'NEEDS_GIVE':
      return (
        <Verdict
          tone="tight"
          notes={notesFor(trust, ACTION_FOR_VERDICT[e.kind], false, e.adapterCount, adaptersUnmarked, raisedOf(e), e.bend)}
        >
          <Mark glyph={'/\\'} />
          <span className="verdict-text">
            {/*
              * "Tight." leads, so severity survives the loss of colour.
              *
              * The mark is aria-hidden and `verdict-tight` against
              * `verdict-fail` may be a hue-only distinction for low colour
              * discrimination, which is WCAG 1.4.1. Every other kind already
              * states its severity in words ("This works", "Exceeds the
              * modelled give", "Can't be built", "Could not check"); this one
              * opened with a measurement and left the reader to infer it.
              */}
            <BendLine words={e.bend} />
            <LoopAt at={e.loopAt} />
            <OpenRuns n={e.openRuns} />
          </span>
        </Verdict>
      );

    case 'EXCEEDS':
      return (
        /*
         * THE GLYPH AND TONE STAY `X` AND `fail`, and that was reviewed rather
         * than left alone. Recorded so it is not reopened every time the
         * sentence below changes.
         *
         * The worry: `X` shares both glyph and tone with IMPOSSIBLE, which IS
         * a definite refusal, while this verdict no longer claims to be one.
         * Does the glyph then overclaim for a reader who cannot use colour?
         *
         * No, because DESIGN.md rule 2's channels are CUMULATIVE, not
         * fallbacks: "The glyph shapes `O`, `/\`, `X` and `?` carry the entire
         * signal, and the sentence beside them says it in words." The glyph
         * exists because the four verdict colours flatten into one greyscale
         * band, so a printed plan or a colour-blind reader loses the COLOUR,
         * never the text. They read "Exceeds the modelled give" too. The glyph
         * separates refusals from passes in greyscale; the words carry which
         * kind of refusal and how certain it is. Encoding certainty in the
         * glyph would need a fifth shape, and rule 2 enumerates four.
         *
         * And rule 3 points the other way from the worry: it forbids
         * UNDERSTATING ("it never renders as a pass, and it never renders as a
         * near-pass"). `tight` is NEEDS_GIVE's near-pass tone, so moving this
         * verdict to it would break rule 3. `fail` is what rule 3 requires;
         * what rule 3 forbade was the CLAIM, which the sentence below fixes.
         */
        <Verdict
          tone="fail"
          notes={notesFor(trust, ACTION_FOR_VERDICT[e.kind], false, e.adapterCount, adaptersUnmarked, raisedOf(e), e.bend)}
        >
          <Mark glyph="X" />
          <span className="verdict-text">
            {/*
              * "BEYOND THE TESTED BEND", NOT "WON'T FIT" (design 1A). The
              * limit is a LOWER bound on what joints do: the Q1 loop showed
              * real joints bending at least that far and carrying a train
              * (`engine/data/bendLimit.ts`). Past it the model has stopped
              * vouching, which is all this says; the hedge in the same line
              * says building it is the test. DESIGN.md rule 3.
              */}
            <BendLine words={e.bend} />
            <LoopAt at={e.loopAt} />
            {/*
              * THE GAP IN PIECES (task X6), only when `repair.ts` proved it
              * exactly. It sits AFTER the measurement rather than replacing
              * it: the plan's frozen copy opened "Won't fit.", which is the
              * overclaim the headline above was rewritten to remove, so the
              * pieces sentence joins the scoped claim instead of displacing
              * it. What it says is geometry, not give: adding or removing
              * that straight closes the loop exactly.
              */}
            {e.pieces && (
              <>
                {' '}This loop is one {e.pieces.name} (
                <span className="num">{e.pieces.lengthMm}mm</span>
                {e.pieces.partNumber && (
                  <>
                    , part <span className="num">{e.pieces.partNumber}</span>
                  </>
                )}
                ) {e.pieces.direction === 'short' ? 'short: add it and the loop closes exactly.' : 'too long: take it out and the loop closes exactly.'}
              </>
            )}
            <OpenRuns n={e.openRuns} />
          </span>
        </Verdict>
      );

  }
}
