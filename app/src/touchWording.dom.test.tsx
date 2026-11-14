/**
 * NO KEY NAMES ON A TOUCH SCREEN (plan 2026-11-14, design DD8).
 *
 * Value: protects=on a touch screen the placing, joining and selection
 * strips, the verdict's join instruction and what is read out on a pick say
 * what to do with no key name and no "Click"; with a mouse the same places
 * keep their keys
 * Value: fails_when=a strip button or sentence is written in place with its
 * key again, the verdict tells a phone to click, or a pick reads "Press R"
 * to a screen reader on a tablet
 * Value: why_new=the editor is coming to phones, where "Cancel (Esc)" and
 * "Click another free end" name things that are not there
 * Value: seam=App under jsdom, mounted in StrictMode; `matchMedia` stubbed
 * so only `(pointer: coarse)` matches. The strips are read as rendered, not
 * from the words file
 * Value: no_claim=which devices report a coarse pointer; how the strips look
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

const KEY_NAMES = /\((R|F|Esc|Enter)\)|\b(Esc|Escape|Enter|Delete|Press|press|Click|click)\b|\bR to\b|\bF to\b/;

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const group = (name: string) => screen.getByRole('group', { name });
/** The verdict's one instruction, and the button beside it. */
const action = () => document.querySelector<HTMLElement>('.verdict-action')!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const labels = (el: HTMLElement) => [...el.querySelectorAll('button')].map((b) => b.textContent);

function mount(touch: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: touch && q === '(pointer: coarse)',
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return user;
}

/** Near miss with its closing joint broken: not a loop, so the verdict asks for a join. */
async function openLoop(touch: boolean) {
  const user = mount(touch);
  await user.click(button('Near miss'));
  const joints = screen.getAllByRole('button', { name: 'Break this joint' });
  await user.click(joints[joints.length - 1]!);
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('on a touch screen', () => {
  /*
   * MUTATION PROOFS, run:
   * - the placing strip's Place written `Place (Enter)` again: `expected
   *   [ 'Other end on', 'Bend the other way', 'Cancel', 'Place (Enter)' ] to
   *   deeply equal [ …, 'Place' ]`.
   * - `touchNow.current` not handed to `describeAction`: `expected 'Placing
   *   Large curve. Press F to bend …' to be 'Placing Large curve.'`.
   */
  it('the placing strip has bare buttons, and a pick reads out no keys', async () => {
    const user = mount(true);
    await user.dblClick(button(/^Add Medium straight\. Measured\.$/));
    await user.click(button('Add Large curve'));

    const strip = group('Placing a piece');
    expect(labels(strip)).toEqual(['Other end on', 'Bend the other way', 'Cancel', 'Place']);
    expect(strip.textContent).not.toMatch(KEY_NAMES);
    expect(announced().textContent).toBe('Placing Large curve.');
  });

  /*
   * MUTATION PROOFS, run:
   * - `Action` showing `action` whatever the pointer: `expected 'Click the two free ends you want joined.Join two ends' to
   *   contain 'Tap the two free ends you want joined.'`.
   * - the joining strip's first sentence taken from the keyboard's words:
   *   `expected 'Joining two ends. Click the first free end.Cancel' to
   *   contain 'Joining two ends. Tap the first free end.'`.
   */
  it('the verdict and the joining strip say Tap, and Cancel has no key', async () => {
    const user = await openLoop(true);
    expect(action().textContent).toContain('Tap the two free ends you want joined.');
    expect(action().textContent).not.toMatch(KEY_NAMES);

    // The instruction is still the control that starts a join (design review 28A).
    await user.click(button('Join two ends'));
    const strip = group('Joining two ends');
    expect(strip.textContent).toContain('Joining two ends. Tap the first free end.');
    expect(labels(strip)).toEqual(['Cancel']);

    await user.click(button(/free socket end/i));
    expect(strip.textContent).toContain('Joining from the start of piece 1. Tap another free end to join it.');
    expect(strip.textContent).not.toMatch(KEY_NAMES);
  });

  /*
   * MUTATION PROOFS, run:
   * - the selection strip's turn button written `Rotate run (R)` again:
   *   `expected [ …, 'Rotate run (R)', 'Remove piece' ] to include 'Rotate
   *   run'`.
   * - the pier sentence taken from the keyboard's words: `expected 'Riser
   *   placed. Move it with the arrows, R to turn, or drag it.…' to contain
   *   'Track support placed. Move it with the arrow buttons, Rotate run to turn, or
   *   drag it.'`.
   */
  it('the selection strip names its own buttons, not R', async () => {
    const user = mount(true);
    await user.dblClick(button(/^Add Track support\./));
    const strip = group('Selected piece');
    expect(strip.textContent).toContain('Track support placed. Move it with the arrow buttons, Rotate run to turn, or drag it.');
    expect(labels(strip)).toContain('Rotate run');
    expect(strip.textContent).not.toMatch(KEY_NAMES);
  });
});

describe('with a mouse', () => {
  /*
   * The other half of DD8: the keys stay where there is a keyboard. The
   * placing and joining strips' keyboard wording is pinned in
   * placing.dom.test.tsx and joining.dom.test.tsx; these are the two
   * sentences nothing else read as rendered.
   *
   * MUTATION PROOF, run: `stripWords` always returning the touch words:
   * `expected 'Tap the two free ends you want joined.Join two ends' to contain 'Click the two free ends you want
   * joined.'`.
   */
  it('the verdict says Click and a pier names R', async () => {
    const user = await openLoop(false);
    expect(action().textContent).toContain('Click the two free ends you want joined.');
    await user.click(button('Clear'));
    await user.dblClick(button(/^Add Track support\./));
    const strip = group('Selected piece');
    expect(strip.textContent).toContain('Track support placed. Move it with the arrows, R to turn, or drag it.');
    expect(labels(strip)).toContain('Rotate run (R)');
  });
});
