/**
 * The ACTION register, plus the failure HEADLINE copy that has nowhere else
 * testable to live: the third of the verdict's three (task K4).
 *
 * Strictly this file is now verdict copy AND actions. `FAILURE_COPY` and
 * `isFailure` are headline and branch selection rather than advice, and they
 * sit here because `vitest.config.ts` collects `.test.ts` only, so a `.tsx`
 * home for them is a home with no coverage. The honest options are to rename
 * this module for what it holds or to split them out; both are filed rather
 * than done, because moving them is a rename across three call sites and
 * this branch is already large.
 *
 * The three answer three different questions, and they were tangled:
 *
 *   VERDICT  does it work?            state, and the numbers behind it
 *   TRUST    is the verdict worth     what is estimated, unverified, or
 *            anything?                resting on one person's word
 *   ACTION   what do I do now?        one imperative
 *
 * Before this, the action hid inside the verdict sentence. NEEDS_GIVE ended
 * with "Seat the triangles firmly." and OPEN_CHAIN with "Close it to check
 * whether it works." Both are instructions wearing a verdict's clothes, and
 * the states that most need an instruction, EXCEEDS and IMPOSSIBLE, had none
 * at all: the product told you it was broken and stopped.
 *
 * WHAT AN ACTION MAY AND MAY NOT SAY.
 *
 * An action is a SUGGESTION. The engine has not checked that it works, and the
 * copy must never imply it has. "Change a straight for a different length" is
 * allowed; "change the 144 for a 108 and it will close" is not, because that
 * is a claim about a layout nobody evaluated. This is the same rule the verdict
 * copy lives under, applied to advice rather than to findings.
 *
 * The three registers are keyed by their unions, not by string. A new verdict state or a
 * new failure reason is a compile error here, so a state cannot ship with no
 * guidance attached.
 */

import type { VerdictKind } from './verdictView.js';

type OutcomeKind = Extract<VerdictKind, 'IMPOSSIBLE' | 'EXACT' | 'NEEDS_GIVE' | 'EXCEEDS'>;
export const ACTION_FOR_VERDICT: Record<OutcomeKind, string> = {
  IMPOSSIBLE:
    'Move one of the pieces that share a spot. Closing the loop will not fix this.',
  EXACT: 'Nothing to fix. Build it.',
  // Design 8A: no "gap is real" claim about a total that no longer exists.
  NEEDS_GIVE:
    'Seat each joint firmly as you go. The joints have to bend a little to close it.',
  /*
   * THE SECOND SENTENCE WAS DELETED, and it is the point of this entry.
   *
   * It read "The gap is larger than the joints can take up." That restates the
   * verdict's own claim as a fact and then tells the builder to pull track
   * apart on the strength of it. `solver/residual.ts:36-42` says the claim is
   * sound only if the give figure is an upper bound on the give really
   * available, and `residual.ts:110` builds that figure with `Math.max` over
   * two per-part summaries, which avoids the smaller estimate without
   * bounding anything. So the sentence asserted more than was checked, which
   * is DESIGN.md rule 3, in the one register whose whole job is to be a
   * suggestion rather than a claim.
   *
   * What remains is the suggestion, unchanged. The scoped version of the claim
   * lives in the verdict headline, where `VerdictLine.tsx` can say what the
   * number is and is not.
   */
  EXCEEDS:
    'Change a straight for a different length, or rearrange the curves.',
};

/**
 * IMPOSSIBLE's action when the cause is track crossing track mid-span
 * (overlap.ts) and nothing else. "Share a spot" is about ends piled up, and
 * read over a crossing it pointed at a spot the canvas never marked as one.
 */
export const ACTION_WHEN_CROSSING =
  'Move one of the crossing pieces so the two no longer touch, or raise one on ramps.';

/**
 * IMPOSSIBLE's actions when the cause is a level fault and nothing else
 * (two-layer plan, design decision 8A). The ends-share-a-spot fallback would
 * point at a spot no level fault has.
 */
export const ACTION_WHEN_LEVEL_MISMATCH =
  'Add a ramp so the loop comes back down to the level it left, or turn one ramp round.';
export const ACTION_WHEN_THIRD_LEVEL = 'Turn that ramp round or remove it.';

/**
 * EXACT's action when any track is raised (design decision 4A). "Nothing to
 * fix. Build it." would sit one line from a note saying supports and
 * clearance were not checked.
 */
export const ACTION_WHEN_RAISED =
  'The track fits. Check the supports and the clearance under each bridge before you build.';

/**
 * EXACT's action when another run of track is still open (TODO "Multiple
 * independent components"). "Nothing to fix. Build it." beside a run with two
 * loose ends told the builder the layout was done.
 */
export const actionWhenOpenRuns = (n: number): string =>
  n === 1 ? 'Join the free ends of the open run, or remove it.' : 'Join the free ends of each open run, or remove them.';

/**
 * The failure kinds, declared ONCE.
 *
 * This was declared identically here and in `VerdictLine.tsx`, and adding
 * TOO_BIG_TO_CHECK meant editing both in lockstep -- a cost the duplication
 * had already charged before anyone noticed it.
 */
type FailureKind = Extract<
  VerdictKind,
  'NO_CYCLE' | 'BEND_UNCHECKED' | 'TOO_MANY_LOOPS' | 'TOO_BIG_TO_CHECK' | 'NUMERIC'
>;

/**
 * The headline for each failure. Lives here rather than in `VerdictLine.tsx`
 * because `vitest.config.ts` collects `.test.ts` only, in a node environment
 * with no DOM: anything in a `.tsx` file is untestable, and this and
 * `isFailure` below were the one new user-facing branch in the
 * TOO_BIG_TO_CHECK change with no coverage at all.
 */
export const FAILURE_COPY: Record<FailureKind, string> = {
  NO_CYCLE: 'Not a loop yet.',
  // Design 1A: grey, and the detail says how far apart the ends still sit.
  BEND_UNCHECKED: 'Could not check the bend:',
  TOO_MANY_LOOPS: 'Too many loops in this layout to rank them.',
  TOO_BIG_TO_CHECK: 'Too much track here to check every loop.',
  NUMERIC: 'Could not check this layout.',
};

/**
 * DERIVED from the copy table, not hand-written beside it.
 *
 * This was a hand-maintained `||` chain kept in parallel with a Record that
 * tsc already keeps exhaustive, so a new kind needed three edits and the
 * compiler only checked two of them. With the arm missing, a refusal falls
 * past the grey failure branch and renders as a NEAR-PASS -- the same
 * hand-maintained-list defect that `verdictView.test.ts` fixed with a Record
 * in this very change, left standing one file over.
 */
export const isFailure = (k: VerdictKind): k is FailureKind => Object.hasOwn(FAILURE_COPY, k);

export const ACTION_FOR_FAILURE: Record<FailureKind, string> = {
  NO_CYCLE: 'Click the two free ends you want joined.',
  TOO_MANY_LOOPS: 'Break this into fewer loops, or check them a few at a time.',
  /*
   * ONLY LEVERS THAT EXIST. This said "or split this into separate layouts",
   * and there are none: one storage key, and the only layout controls are
   * Remove last, Clear and the three presets.
   */
  TOO_BIG_TO_CHECK: 'Remove some track.',
  BEND_UNCHECKED: 'Change a piece and check again, or build it and see.',
  /*
   * TWO CAUSES, so this cannot promise a pending check. `solve.ts` returns
   * NUMERIC both when a figure came out non-finite AND when rank says there
   * are loops but none traced -- and the second is deterministic and already
   * finished, so "until the check completes" would be telling the user to
   * wait for something that is over. Same one-reason-two-causes shape that
   * TOO_MANY_LOOPS carried until TOO_BIG_TO_CHECK was split out of it; this
   * one is worded to cover both rather than split, because the second cause
   * is not reachable today.
   */
  /*
   * An imperative, not the headline again. The headline already says "Could
   * not check this layout."; repeating it in the one register whose job is
   * "what do I do now?" leaves the builder with nothing. Both controls named
   * here exist.
   */
  NUMERIC: 'Remove the last piece you added, or clear the canvas and start again.',
};

/**
 * No action on a blank canvas. The empty state already carries the one primary
 * action, and a second invitation here is the exact thing design D10 removed.
 */
export const ACTION_WHEN_EMPTY: string | null = null;

/**
 * The actions that ask for a join (design review 28A): the verdict shows a
 * "Join two ends" button beside these, so the instruction is also the control.
 */
export function isJoinAction(action: string): boolean {
  return action === ACTION_FOR_FAILURE.NO_CYCLE || action === actionWhenOpenRuns(1) || action === actionWhenOpenRuns(2);
}
