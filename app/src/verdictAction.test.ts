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
    expect(shared.map(([, s]) => s.sort())).toEqual([['NUMERIC', 'UNKNOWN']]);
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
    expect(ACTION_FOR_VERDICT.EXCEEDS).not.toBe(ACTION_FOR_VERDICT.UNKNOWN);
    expect(ACTION_FOR_VERDICT.IMPOSSIBLE).not.toBe(ACTION_FOR_VERDICT.UNKNOWN);
  });
});
