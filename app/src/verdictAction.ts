/**
 * The ACTION register: the third of the verdict's three (task K4).
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
 * Both maps are keyed by their union, not by string. A new verdict state or a
 * new failure reason is a compile error here, so a state cannot ship with no
 * guidance attached.
 */

import type { VerdictKind } from './verdictView.js';

type OutcomeKind = Extract<VerdictKind, 'IMPOSSIBLE' | 'EXACT' | 'NEEDS_GIVE' | 'EXCEEDS'>;
export const ACTION_FOR_VERDICT: Record<OutcomeKind, string> = {
  IMPOSSIBLE:
    'Move one of the pieces that share a spot. Closing the loop will not fix this.',
  EXACT: 'Nothing to fix. Build it.',
  NEEDS_GIVE:
    'Seat each triangle firmly as you go. If the last piece fights you, the gap is real.',
  EXCEEDS:
    'Change a straight for a different length, or rearrange the curves. The gap is larger than the joints can take up.',
};

type FailureKind = Extract<
  VerdictKind,
  'NO_CYCLE' | 'HEADING_MISMATCH' | 'TOO_MANY_LOOPS' | 'TOO_BIG_TO_CHECK' | 'NUMERIC'
>;
export const ACTION_FOR_FAILURE: Record<FailureKind, string> = {
  NO_CYCLE: 'Click the two free ends you want joined.',
  TOO_MANY_LOOPS: 'Break this into fewer loops, or check them a few at a time.',
  TOO_BIG_TO_CHECK: 'Remove some track, or split this into separate layouts.',
  HEADING_MISMATCH:
    'The curves need to add up to a whole turn. Add one, remove one, or mirror one.',
  NUMERIC: 'Nothing to act on until the check completes.',
};

/**
 * No action on a blank canvas. The empty state already carries the one primary
 * action, and a second invitation here is the exact thing design D10 removed.
 */
export const ACTION_WHEN_EMPTY: string | null = null;
