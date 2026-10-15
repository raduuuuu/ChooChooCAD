import { describe, expect, it } from 'vitest';
import { ACTION_FOR_FAILURE, ACTION_FOR_VERDICT } from './verdictAction.js';

const all = [...Object.entries(ACTION_FOR_VERDICT), ...Object.entries(ACTION_FOR_FAILURE)];

describe('the action register', () => {
  it('every state has a non-empty action', () => {
    for (const [state, action] of all) {
      expect(action.trim(), state).not.toBe('');
    }
  });

  /*
   * Catches the copy-paste placeholder. Two states sharing an action means one
   * of them was never written, and a reviewer reading the map would not
   * notice. The two deliberate duplicates are the states where there is
   * genuinely nothing to do yet, so they are named here rather than exempted
   * by a rule that would also hide an accident.
   */
  it('no two states share an action, except the two that cannot act', () => {
    const byAction = new Map<string, string[]>();
    for (const [state, action] of all) {
      byAction.set(action, [...(byAction.get(action) ?? []), state]);
    }
    const shared = [...byAction.entries()].filter(([, s]) => s.length > 1);
    // No duplicates at all now: UNKNOWN folded into the failure kinds, so the
    // one deliberate pair this previously exempted no longer exists.
    expect(shared.map(([, s]) => s.sort())).toEqual([]);
  });

  /*
   * An action is a SUGGESTION. The engine has not evaluated the layout the
   * advice would produce, so no action may promise an outcome. This catches
   * the drift where helpful copy turns into an unchecked claim.
   */
  it('no action promises that following it will work', () => {
    const promises = /\b(will close|will fit|will work|guarantee|this fixes)\b/i;
    for (const [state, action] of all) {
      expect(promises.test(action), `${state}: ${action}`).toBe(false);
    }
  });

  /*
   * AN ACTION MAY NOT TELL THE USER TO WAIT FOR A CHECK THAT IS OVER.
   *
   * Value: protects=no action points at a check still in progress, because
   * every refusal the engine returns is deterministic and already finished
   * Value: fails_when=an action promises a pending result, which leaves the
   * user waiting instead of acting -- NUMERIC said "Nothing to act on until
   * the check completes." and `solve.ts` now returns NUMERIC for a rank with
   * no traced cycles, a refusal that has already finished
   * Value: why_new=the register's own rule is that an action must not claim an
   * outcome, and the `promises` spec above enforces that for FUTURE outcomes
   * ("will close", "will fit"). A promise about the CHECK rather than the
   * layout slips past it: all five specs in this file passed on the old
   * wording.
   * Value: seam=none
   * Value: no_claim=nothing about whether the advice is good advice, and
   * nothing about the headline, which `verdictView.test.ts` owns.
   *
   * MUTATION PROOF, run against a relocated copy of `verdictAction.ts` --
   * imports rewritten, nothing else touched -- because this audit may not
   * write to `app/src/verdictAction.ts`: restore NUMERIC's old
   * `'Nothing to act on until the check completes.'` and this fails with
   * `NUMERIC: Nothing to act on until the check completes.: expected true to
   * be false // Object.is equality`. Exactly one spec fails; the other five
   * accept that sentence, verified by running their four assertions over the
   * mutated register, which is how it shipped.
   */
  it('no action tells the user to wait for a check that has already finished', () => {
    const pending =
      /\b(until the check completes|when the check (completes|finishes)|still (running|checking)|check is (running|in progress)|in progress)\b/i;
    for (const [state, action] of all) {
      expect(pending.test(action), `${state}: ${action}`).toBe(false);
    }
  });

  it('every action is a finished sentence', () => {
    for (const [state, action] of all) {
      expect(action, state).toMatch(/^[A-Z].*\.$/s);
    }
  });

  /*
   * The two states that used to carry no action at all. Pinned by name because
   * "the product tells you it is broken and stops" was the actual defect K4
   * was raised for, and a future edit could quietly restore it by emptying
   * these two without failing any other test here.
   */
  it('the two states that used to go unadvised now advise', () => {
    expect(ACTION_FOR_VERDICT.EXCEEDS).toMatch(/\w/);
    expect(ACTION_FOR_VERDICT.IMPOSSIBLE).toMatch(/\w/);
    expect(ACTION_FOR_VERDICT.EXCEEDS).not.toBe(ACTION_FOR_VERDICT.EXACT);
    expect(ACTION_FOR_VERDICT.IMPOSSIBLE).not.toBe(ACTION_FOR_VERDICT.EXACT);
  });
});
